const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Task = require('../models/Task');
const Message = require('../models/Message');
const mongoose = require('mongoose');

// This function exports a router that has access to the io instance and userSockets map
module.exports = function(io, userSockets) {
    // Search for users to add as friends
    router.get('/search', async (req, res) => {
        try {
            const { query } = req.query;
            if (!query) return res.json([]);

            const currentUser = await User.findById(req.user.id);
            const friendUserIds = currentUser.friends.map(f => f.user);

            const users = await User.find({
                username: { $regex: query, $options: 'i' },
                _id: { $ne: req.user.id, $nin: friendUserIds } // Exclude self and existing friends/requests
            }).select('username').limit(10);

            res.json(users);
        } catch (err) {
            res.status(500).json({ error: "Server error during user search" });
        }
    });

    // Send a friend request and emit a real-time event
    router.post('/request/:userId', async (req, res) => {
        try {
            const recipientId = req.params.userId;
            const senderId = req.user.id;
            
            // Check if a request already exists
            const recipient = await User.findById(recipientId);
            if (recipient.friends.some(f => f.user.equals(senderId))) {
                return res.status(400).json({ error: "Request already sent or you are already friends." });
            }

            // Update both users in the database
            await User.findByIdAndUpdate(senderId, { $push: { friends: { user: recipientId, status: 'sent' } } });
            await User.findByIdAndUpdate(recipientId, { $push: { friends: { user: senderId, status: 'pending' } } });

            // Emit a notification to the recipient if they are currently online
            const recipientSocketId = userSockets[recipientId];
            if (recipientSocketId) {
                const sender = await User.findById(senderId).select('username');
                io.to(recipientSocketId).emit('friendRequest', {
                    fromUser: sender,
                });
                console.log(`[Socket.IO] Sent friend request notification to User ${recipientId}`);
            }

            res.json({ message: "Friend request sent" });
        } catch (err) {
            res.status(500).json({ error: "Failed to send friend request" });
        }
    });

    // Accept a friend request
    router.put('/accept/:userId', async (req, res) => {
        try {
            const senderId = req.params.userId;
            const recipientId = req.user.id;
            await User.updateOne({ _id: recipientId, 'friends.user': senderId }, { $set: { 'friends.$.status': 'accepted' } });
            await User.updateOne({ _id: senderId, 'friends.user': recipientId }, { $set: { 'friends.$.status': 'accepted' } });
            res.json({ message: "Friend request accepted" });
        } catch (err) { res.status(500).json({ error: "Failed to accept request" }); }
    });
    
    // Get friends list and pending requests, including unread counts
    router.get('/', async (req, res) => {
        try {
            const user = await User.findById(req.user.id).populate('friends.user', 'username');
            res.json({
                friends: user.friends.filter(f => f.status === 'accepted'),
                pendingRequests: user.friends.filter(f => f.status === 'pending')
            });
        } catch (err) { res.status(500).json({ error: "Failed to fetch friends" }); }
    });

    // Route to mark messages from a friend as read
    router.put('/read-messages/:friendId', async (req, res) => {
        try {
            await User.updateOne(
                { _id: req.user.id, 'friends.user': req.params.friendId },
                { $set: { 'friends.$.unreadCount': 0 } }
            );
            res.status(200).send({ message: "Messages marked as read." });
        } catch (err) {
            res.status(500).json({ error: "Failed to mark messages as read" });
        }
    });

    // Get daily progress for all friends
    router.get('/progress', async (req, res) => {
        try {
            const user = await User.findById(req.user.id);
            const friendIds = user.friends.filter(f => f.status === 'accepted').map(f => f.user);
            if (friendIds.length === 0) return res.json([]);

            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);

            const progressData = await User.aggregate([
                { $match: { _id: { $in: friendIds } } },
                { $lookup: { from: 'tasks', localField: '_id', foreignField: 'user', as: 'tasks' } },
                {
                    $project: {
                        username: 1,
                        dailyCompleted: {
                            $size: {
                                $filter: {
                                    input: '$tasks', as: 'task',
                                    cond: { $and: [
                                        { $eq: ['$$task.completed', true] },
                                        { $gte: ['$$task.completedAt', startOfDay] },
                                        { $lte: ['$$task.completedAt', endOfDay] }
                                    ]}
                                }
                            }
                        }
                    }
                }
            ]);
            res.json(progressData);
        } catch (err) {
            res.status(500).json({ error: "Failed to get friend progress" });
        }
    });

    // Get chat history with a specific friend
    router.get('/chat/:friendId', async (req, res) => {
        try {
            const messages = await Message.find({
                $or: [
                    { fromUser: req.user.id, toUser: req.params.friendId },
                    { fromUser: req.params.friendId, toUser: req.user.id },
                ]
            }).sort({ createdAt: 1 });
            res.json(messages);
        } catch (err) { res.status(500).json({ error: "Failed to fetch chat history" }); }
    });

    return router;
};

