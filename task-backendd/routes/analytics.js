const express = require("express");
const router = express.Router();
const Task = require("../models/Task");
const mongoose = require('mongoose');

// GET /api/analytics - Get personal productivity stats for the logged-in user
router.get("/", async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.user.id);

        // Get the date for the start of the current week (assuming Sunday is the first day)
        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const stats = await Task.aggregate([
            // 1. Match all tasks created by the current user
            { $match: { user: userId } },
            
            // 2. Use $facet to run multiple aggregation pipelines at once for efficiency
            {
                $facet: {
                    // Pipeline 1: Calculate total tasks and total completed
                    generalStats: [
                        {
                            $group: {
                                _id: null,
                                totalTasks: { $sum: 1 },
                                totalCompleted: {
                                    $sum: { $cond: [{ $eq: ["$completed", true] }, 1, 0] }
                                }
                            }
                        }
                    ],
                    // Pipeline 2: Count how many completed tasks fall into each priority
                    priorityStats: [
                        { $match: { completed: true } },
                        { $group: { _id: "$priority", count: { $sum: 1 } } }
                    ],
                    // Pipeline 3: Count how many tasks were completed this week
                    weeklyStats: [
                        { 
                            $match: { 
                                completed: true,
                                completedAt: { $gte: startOfWeek }
                            } 
                        },
                        { $count: "completedThisWeek" }
                    ]
                }
            }
        ]);

        // 3. Format the raw aggregation results into a clean object
        const general = stats[0].generalStats[0] || { totalTasks: 0, totalCompleted: 0 };
        const priorities = stats[0].priorityStats || [];
        const weekly = stats[0].weeklyStats[0] || { completedThisWeek: 0 };

        const formattedStats = {
            totalTasks: general.totalTasks,
            totalCompleted: general.totalCompleted,
            completionRate: general.totalTasks > 0 ? (general.totalCompleted / general.totalTasks) * 100 : 0,
            completedByPriority: priorities.reduce((acc, p) => {
                acc[p._id] = p.count;
                return acc;
            }, {}),
            completedThisWeek: weekly.completedThisWeek
        };

        res.json(formattedStats);
    } catch (err) {
        console.error("Failed to fetch analytics:", err);
        res.status(500).json({ error: "Failed to fetch analytics" });
    }
});

module.exports = router;

