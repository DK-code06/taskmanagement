const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Message = require('../models/Message');

module.exports = function(io) {
    // Escape special characters for safe regular expression matching
    const escapeRegex = (string) => {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    // Search for users to add as friends
    router.get('/search', async (req, res) => {
        try {
            const { query } = req.query;
            if (!query || !query.trim()) return res.json([]);

            const sanitizedQuery = escapeRegex(query.trim());
            const currentUser = await User.findById(req.user.id);
            const friendUserIds = currentUser.friends.map(f => f.user);

            const users = await User.find({
                username: { $regex: sanitizedQuery, $options: 'i' },
                _id: { $ne: req.user.id, $nin: friendUserIds }
            }).select('username').limit(10);

            res.json(users);
        } catch (err) {
            console.error("User search error:", err);
            res.status(500).json({ error: "Server error during user search" });
        }
    });

    // Send a friend request
    router.post('/request/:userId', async (req, res) => {
        try {
            const recipientId = req.params.userId;
            const senderId = req.user.id;

            // Reject self-request
            if (recipientId === senderId) {
                return res.status(400).json({ error: "You cannot send a friend request to yourself." });
            }
            
            const recipient = await User.findById(recipientId);
            if (!recipient) {
                return res.status(404).json({ error: "Recipient user not found." });
            }

            const sender = await User.findById(senderId);

            // Guard rail against uncontrolled document growth (Max 500 friends)
            if (sender.friends && sender.friends.length >= 500) {
                return res.status(400).json({ error: "Maximum friend limit (500) reached." });
            }
            if (recipient.friends && recipient.friends.length >= 500) {
                return res.status(400).json({ error: "Recipient user has reached maximum friend limit (500)." });
            }

            // Check if request or friendship already exists in recipient's OR sender's list
            const recipientAlreadyLinked = recipient.friends.some(f => f.user.equals(senderId));
            const senderAlreadyLinked = sender.friends.some(f => f.user.equals(recipientId));

            if (recipientAlreadyLinked || senderAlreadyLinked) {
                return res.status(400).json({ error: "Request already sent or you are already friends." });
            }

            await User.findByIdAndUpdate(senderId, { $push: { friends: { user: recipientId, status: 'sent' } } });
            await User.findByIdAndUpdate(recipientId, { $push: { friends: { user: senderId, status: 'pending' } } });

            // Emit targeted real-time notification to recipient's room
            io.to(`user:${recipientId}`).emit('friendRequest', {
                fromUser: { _id: sender._id, username: sender.username }
            });

            res.json({ message: "Friend request sent successfully" });
        } catch (err) {
            console.error("Error sending friend request:", err);
            res.status(500).json({ error: "Failed to send friend request" });
        }
    });

    // Accept a friend request (requires current status === 'pending')
    router.put('/accept/:userId', async (req, res) => {
        try {
            const senderId = req.params.userId;
            const recipientId = req.user.id;

            const recipient = await User.findById(recipientId);
            const pendingRequest = recipient.friends.find(f => f.user.equals(senderId) && f.status === 'pending');

            if (!pendingRequest) {
                return res.status(400).json({ error: "No pending friend request found from this user." });
            }

            await User.updateOne(
                { _id: recipientId, 'friends.user': senderId },
                { $set: { 'friends.$.status': 'accepted' } }
            );
            await User.updateOne(
                { _id: senderId, 'friends.user': recipientId },
                { $set: { 'friends.$.status': 'accepted' } }
            );

            io.to(`user:${senderId}`).emit('friendRequestAccepted', {
                byUser: { _id: recipient._id, username: recipient.username }
            });

            res.json({ message: "Friend request accepted" });
        } catch (err) {
            console.error("Error accepting friend request:", err);
            res.status(500).json({ error: "Failed to accept request" });
        }
    });
    
    // Get friends list and pending requests
    router.get('/', async (req, res) => {
        try {
            const user = await User.findById(req.user.id).populate('friends.user', 'username');
            if (!user) return res.status(404).json({ error: "User not found" });

            res.json({
                friends: user.friends.filter(f => f && f.user && f.status === 'accepted'),
                pendingRequests: user.friends.filter(f => f && f.user && f.status === 'pending')
            });
        } catch (err) {
            console.error("Error fetching friends:", err);
            res.status(500).json({ error: "Failed to fetch friends" });
        }
    });

    // Get friends' daily progress (completed tasks today)
    router.get('/progress', async (req, res) => {
        try {
            const Task = require('../models/Task');
            const currentUser = await User.findById(req.user.id);
            if (!currentUser) return res.json([]);

            const acceptedFriendIds = currentUser.friends
                .filter(f => f && f.user && f.status === 'accepted')
                .map(f => f.user);

            if (!acceptedFriendIds.length) return res.json([]);

            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);

            const progress = await Task.aggregate([
                {
                    $match: {
                        userId: { $in: acceptedFriendIds },
                        completed: true,
                        updatedAt: { $gte: startOfDay, $lte: endOfDay }
                    }
                },
                {
                    $group: {
                        _id: "$userId",
                        dailyCompleted: { $sum: 1 }
                    }
                }
            ]);

            res.json(progress);
        } catch (err) {
            console.error("Error fetching friends progress:", err);
            res.json([]);
        }
    });

    // Mark messages from a friend as read
    router.put('/read-messages/:friendId', async (req, res) => {
        try {
            await User.updateOne(
                { _id: req.user.id, 'friends.user': req.params.friendId },
                { $set: { 'friends.$.unreadCount': 0 } }
            );
            res.status(200).json({ message: "Messages marked as read." });
        } catch (err) {
            res.status(500).json({ error: "Failed to mark messages as read" });
        }
    });

    // Get chat history with a specific friend with pagination limit
    router.get('/chat/:friendId', async (req, res) => {
        try {
            const friendId = req.params.friendId;
            const currentUser = await User.findById(req.user.id);
            const isFriend = currentUser.friends.some(f => f.user.equals(friendId) && f.status === 'accepted');

            if (!isFriend) {
                return res.status(403).json({ error: "You can only view chat history with accepted friends." });
            }

            const limit = parseInt(req.query.limit) || 50;
            const messages = await Message.find({
                $or: [
                    { fromUser: req.user.id, toUser: friendId },
                    { fromUser: friendId, toUser: req.user.id },
                ]
            })
            .sort({ createdAt: -1 })
            .limit(limit);

            res.json(messages.reverse());
        } catch (err) {
            console.error("Error fetching chat history:", err);
            res.status(500).json({ error: "Failed to fetch chat history" });
        }
    });

    return router;
};
