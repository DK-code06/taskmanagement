const express = require("express");
const router = express.Router();
const Task = require("../models/Task");
const Team = require("../models/Team");
const Category = require("../models/Category");
const { authorizeTeam } = require("../middleware/authorize");
const mongoose = require('mongoose');

// GET /api/analytics - Get personal productivity stats for the logged-in user
router.get("/", async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.user.id);

        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const stats = await Task.aggregate([
            { $match: { user: userId, deletedAt: null } },
            {
                $facet: {
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
                    priorityStats: [
                        { $match: { completed: true } },
                        { $group: { _id: "$priority", count: { $sum: 1 } } }
                    ],
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

// GET /api/analytics/team/:id - Get team productivity stats (Resolves Bug 10)
router.get("/team/:id", authorizeTeam('Member'), async (req, res) => {
    try {
        const team = req.team;
        const teamId = team._id;

        // Find categories belonging to this team
        const teamCategories = await Category.find({ ownerType: 'Team', ownerId: teamId }).select('_id');
        const categoryIds = teamCategories.map(c => c._id);

        // Aggregate tasks belonging to team categories or assigned to team members
        const memberIds = team.members.map(m => m.user);

        const tasks = await Task.find({
            $or: [
                { category: { $in: categoryIds } },
                { assignedTo: { $in: memberIds } }
            ],
            deletedAt: null
        }).populate('assignedTo', 'username');

        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.completed).length;
        const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

        // Breakdown of completed tasks per member
        const completedByMemberMap = {};
        team.members.forEach(m => {
            const username = m.user.username || 'User';
            completedByMemberMap[username] = 0;
        });

        tasks.filter(t => t.completed && t.assignedTo).forEach(t => {
            const uname = t.assignedTo.username;
            if (uname) {
                completedByMemberMap[uname] = (completedByMemberMap[uname] || 0) + 1;
            }
        });

        const completedByMember = Object.entries(completedByMemberMap).map(([username, count]) => ({
            username,
            count
        }));

        res.json({
            teamId: team._id,
            teamName: team.name,
            totalTasks,
            completedTasks,
            completionRate,
            completedByMember
        });
    } catch (err) {
        console.error("Failed to fetch team analytics:", err);
        res.status(500).json({ error: "Failed to fetch team analytics" });
    }
});

module.exports = router;
