const express = require("express");
const router = express.Router();
const Task = require("../models/Task");
const Team = require("../models/Team");
const Category = require("../models/Category");
const Project = require("../models/Project");
const Milestone = require("../models/Milestone");
const User = require("../models/User");
const { authorizeTeam, canAccessProject } = require("../middleware/authorize");
const { isDateInCurrentWeek } = require("../services/timezoneService");
const mongoose = require('mongoose');

// GET /api/analytics - Get personal productivity stats for the logged-in user (timezone-aware)
router.get("/", async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.user.id);
        const userDoc = await User.findById(req.user.id).select('timezone');
        const userTimezone = (userDoc && userDoc.timezone) ? userDoc.timezone : (req.user.timezone || 'UTC');

        const tasks = await Task.find({
            $or: [{ user: userId }, { assignedTo: userId }],
            deletedAt: null
        });

        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.completed || t.status === 'Done');
        const totalCompleted = completedTasks.length;
        const completionRate = totalTasks > 0 ? (totalCompleted / totalTasks) * 100 : 0;

        const completedByPriority = {};
        let completedThisWeek = 0;
        const now = new Date();

        completedTasks.forEach(task => {
            const prio = task.priority || 'No Priority';
            completedByPriority[prio] = (completedByPriority[prio] || 0) + 1;

            if (task.completedAt && isDateInCurrentWeek(task.completedAt, now, userTimezone)) {
                completedThisWeek++;
            }
        });

        const formattedStats = {
            totalTasks,
            totalCompleted,
            completionRate,
            completedByPriority,
            completedThisWeek
        };

        res.json(formattedStats);
    } catch (err) {
        console.error("Failed to fetch analytics:", err);
        res.status(500).json({ error: "Failed to fetch analytics" });
    }
});

// GET /api/analytics/team/:id - Get team productivity stats
router.get("/team/:id", authorizeTeam('Member'), async (req, res) => {
    try {
        const team = req.team;
        const teamId = team._id;

        const teamCategories = await Category.find({ ownerType: 'Team', ownerId: teamId }).select('_id');
        const categoryIds = teamCategories.map(c => c._id);
        const memberIds = team.members.map(m => m.user);

        const tasks = await Task.find({
            $or: [
                { category: { $in: categoryIds } },
                { assignedTo: { $in: memberIds } }
            ],
            deletedAt: null
        }).populate('assignedTo', 'username');

        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.completed || t.status === 'Done').length;
        const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

        const completedByMemberMap = {};
        team.members.forEach(m => {
            const username = m.user.username || 'User';
            completedByMemberMap[username] = 0;
        });

        tasks.filter(t => (t.completed || t.status === 'Done') && t.assignedTo).forEach(t => {
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

// GET /api/analytics/project/:id - Get project-level analytics (M4.5-B)
router.get("/project/:id", async (req, res) => {
    try {
        const { id: projectId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return res.status(400).json({ error: "Invalid project ID format" });
        }

        const accessCheck = await canAccessProject(req.user.id, projectId);
        if (!accessCheck.allowed) {
            if (accessCheck.reason === 'NOT_FOUND') {
                return res.status(404).json({ error: "Project not found" });
            }
            return res.status(403).json({ error: "Access denied for this project" });
        }

        const project = accessCheck.project;
        const tasks = await Task.find({ projectId, deletedAt: null });
        const milestones = await Milestone.find({ projectId }).sort({ order: 1 });

        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.completed || t.status === 'Done').length;
        const incompleteTasks = totalTasks - completedTasks;
        const completionPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

        const tasksByStatus = {};
        const tasksByPriority = {};
        let overdueTasks = 0;
        let upcomingTasks = 0;
        const now = new Date();

        tasks.forEach(task => {
            const status = task.status || 'To Do';
            tasksByStatus[status] = (tasksByStatus[status] || 0) + 1;

            const priority = task.priority || 'No Priority';
            tasksByPriority[priority] = (tasksByPriority[priority] || 0) + 1;

            if (!task.completed && task.status !== 'Done' && task.dueDate) {
                if (new Date(task.dueDate) < now) {
                    overdueTasks++;
                } else {
                    upcomingTasks++;
                }
            }
        });

        const milestoneProgress = milestones.map(m => {
            const mTasks = tasks.filter(t => t.milestoneId && t.milestoneId.toString() === m._id.toString());
            const mCompleted = mTasks.filter(t => t.completed || t.status === 'Done').length;
            return {
                milestoneId: m._id,
                title: m.title,
                status: m.status,
                totalTasks: mTasks.length,
                completedTasks: mCompleted,
                completionPercentage: mTasks.length > 0 ? (mCompleted / mTasks.length) * 100 : 0
            };
        });

        res.json({
            projectId: project._id,
            projectName: project.name,
            status: project.status,
            totalTasks,
            completedTasks,
            incompleteTasks,
            completionPercentage,
            tasksByStatus,
            tasksByPriority,
            overdueTasks,
            upcomingTasks,
            milestoneProgress
        });
    } catch (err) {
        console.error("Failed to fetch project analytics:", err);
        res.status(500).json({ error: "Failed to fetch project analytics" });
    }
});

module.exports = router;
