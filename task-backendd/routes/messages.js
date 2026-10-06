const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Message = require('../models/Message');

module.exports = function createMessageRoutes(io) {
    const router = express.Router();

    // GET /api/messages/search - Secure message search using native MongoDB $text index
    router.get('/search', async (req, res) => {
        try {
            const { q, friendId, limit: reqLimit, before } = req.query;

            // 1. Search Query Validation
            if (!q || typeof q !== 'string' || !q.trim()) {
                return res.status(400).json({ error: "Search query 'q' is required." });
            }

            const trimmedQuery = q.trim();
            if (trimmedQuery.length < 2) {
                return res.status(400).json({ error: "Search query must be at least 2 characters long." });
            }
            if (trimmedQuery.length > 100) {
                return res.status(400).json({ error: "Search query cannot exceed 100 characters." });
            }

            // 2. Query Limits
            let limit = parseInt(reqLimit, 10);
            if (isNaN(limit) || limit < 1) limit = 20;
            if (limit > 50) limit = 50;

            // 3. Database-Constrained Authorization Query Framing
            // The current authenticated user MUST be a participant (fromUser or toUser)
            const authConstraint = {
                $or: [
                    { fromUser: req.user.id },
                    { toUser: req.user.id }
                ]
            };

            const queryConditions = [authConstraint];

            // 4. Optional friendId Filter Scoping
            if (friendId) {
                if (!mongoose.Types.ObjectId.isValid(friendId)) {
                    return res.status(400).json({ error: "Invalid friendId format." });
                }
                const friendObjId = new mongoose.Types.ObjectId(friendId);
                // Constrain query to messages between req.user.id AND friendId
                queryConditions.push({
                    $or: [
                        { fromUser: req.user.id, toUser: friendObjId },
                        { fromUser: friendObjId, toUser: req.user.id }
                    ]
                });
            }

            // 5. Native MongoDB $text Search Condition
            queryConditions.push({ $text: { $search: trimmedQuery } });

            // 6. Cursor Pagination (before ISO date string)
            if (before) {
                const beforeDate = new Date(before);
                if (isNaN(beforeDate.getTime())) {
                    return res.status(400).json({ error: "Invalid 'before' cursor date format." });
                }
                queryConditions.push({ createdAt: { $lt: beforeDate } });
            }

            const mongoQuery = { $and: queryConditions };

            // 7. Execute Query with Data Minimization & Text Score Sorting
            const messages = await Message.find(
                mongoQuery,
                { score: { $meta: "textScore" } }
            )
                .sort({ score: { $meta: "textScore" }, createdAt: -1 })
                .limit(limit)
                .populate("fromUser", "username")
                .populate("toUser", "username");

            // Format minimum required fields for frontend
            const results = messages.map(m => ({
                _id: m._id,
                fromUser: m.fromUser ? { _id: m.fromUser._id, username: m.fromUser.username } : null,
                toUser: m.toUser ? { _id: m.toUser._id, username: m.toUser.username } : null,
                content: m.content,
                createdAt: m.createdAt,
                score: m._doc?.score || 0
            }));

            res.json({
                query: trimmedQuery,
                count: results.length,
                hasMore: results.length === limit,
                results
            });
        } catch (err) {
            console.error("Error during message search:", err);
            res.status(500).json({ error: "Failed to perform message search" });
        }
    });

    return router;
};
