const express = require("express");
const router = express.Router();
const Project = require("../models/Project");
const Team = require("../models/Team");
const { authorizeProject } = require("../middleware/authorize");
const { logActivityEvent, getActivitySummary, getProjectActivityMetrics } = require("../services/activityService");
const mongoose = require("mongoose");

// GET /api/projects - Get all projects accessible to the logged-in user
router.get("/", async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const userTeams = await Team.find({ 'members.user': userId }).select('_id');
    const teamIds = userTeams.map(t => t._id);

    const projects = await Project.find({
      $or: [
        { ownerType: 'User', ownerId: userId },
        { ownerType: 'Team', ownerId: { $in: teamIds } },
        { 'members.user': userId }
      ],
      deletedAt: null
    }).populate('ownerId', 'name username').sort({ updatedAt: -1 });

    res.json(projects);
  } catch (err) {
    console.error("Error fetching projects:", err);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

// POST /api/projects - Create a new Project
router.post("/", async (req, res) => {
  try {
    const { name, description = "", ownerType = "User", ownerId, deadline = null, tags = [] } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Project name is required" });
    }

    const targetOwnerId = ownerId || req.user.id;

    if (ownerType === "Team") {
      const team = await Team.findById(targetOwnerId);
      if (!team) return res.status(404).json({ error: "Team not found" });
      if (!team.members.some(m => m.user.equals(req.user.id))) {
        return res.status(403).json({ error: "You are not a member of this team" });
      }
    } else if (ownerType === "User" && targetOwnerId !== req.user.id) {
      return res.status(403).json({ error: "You can only create personal projects for yourself" });
    }

    const project = new Project({
      name: name.trim(),
      description: description.trim(),
      ownerType,
      ownerId: targetOwnerId,
      deadline: deadline || null,
      tags: tags.map(t => t.trim()).filter(Boolean),
      members: [{ user: req.user.id, role: "OWNER" }]
    });

    await project.save();

    await logActivityEvent({
      eventType: "PROJECT_CREATED",
      actorId: req.user.id,
      projectId: project._id,
      metadata: { name: project.name, ownerType, ownerId: targetOwnerId }
    });

    res.status(201).json(project);
  } catch (err) {
    console.error("Error creating project:", err);
    res.status(500).json({ error: "Failed to create project" });
  }
});

// GET /api/projects/:id - Get single project by ID with authorization
router.get("/:id", authorizeProject('MEMBER'), async (req, res) => {
  res.json(req.project);
});

// GET /api/projects/:id/activity-summary - Get project activity summary and metrics (Phase 2-B)
router.get("/:id/activity-summary", authorizeProject('MEMBER'), async (req, res) => {
  try {
    const { timeWindowDays = 30, limit = 50, startDate, endDate, eventTypes } = req.query;
    const projectId = req.project._id;

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const parsedDays = Math.min(Math.max(parseInt(timeWindowDays, 10) || 30, 1), 365);
    const parsedEventTypes = eventTypes ? (Array.isArray(eventTypes) ? eventTypes : eventTypes.split(',')) : null;

    const metrics = await getProjectActivityMetrics({
      projectId,
      timeWindowDays: parsedDays
    });

    const recentActivity = await getActivitySummary({
      projectId,
      startDate,
      endDate,
      eventTypes: parsedEventTypes,
      limit: parsedLimit
    });

    res.json({
      projectId,
      projectName: req.project.name,
      metrics,
      recentActivity
    });
  } catch (err) {
    console.error("Error fetching project activity summary:", err);
    res.status(500).json({ error: "Failed to fetch project activity summary" });
  }
});

// PUT /api/projects/:id - Update project
router.put("/:id", authorizeProject('ADMIN'), async (req, res) => {
  try {
    const { name, description, status, deadline, tags } = req.body;
    const project = req.project;

    if (name !== undefined) project.name = name.trim();
    if (description !== undefined) project.description = description.trim();
    if (status !== undefined) project.status = status;
    if (deadline !== undefined) project.deadline = deadline;
    if (tags !== undefined) project.tags = tags.map(t => t.trim()).filter(Boolean);

    await project.save();

    await logActivityEvent({
      eventType: "PROJECT_UPDATED",
      actorId: req.user.id,
      projectId: project._id,
      metadata: { name: project.name, status: project.status }
    });

    res.json(project);
  } catch (err) {
    console.error("Error updating project:", err);
    res.status(500).json({ error: "Failed to update project" });
  }
});

// DELETE /api/projects/:id - Soft delete project
router.delete("/:id", authorizeProject('ADMIN'), async (req, res) => {
  try {
    const project = req.project;
    project.deletedAt = new Date();
    project.status = "ARCHIVED";
    await project.save();

    await logActivityEvent({
      eventType: "PROJECT_ARCHIVED",
      actorId: req.user.id,
      projectId: project._id,
      metadata: { name: project.name }
    });

    res.json({ message: "Project archived successfully" });
  } catch (err) {
    console.error("Error archiving project:", err);
    res.status(500).json({ error: "Failed to archive project" });
  }
});

module.exports = router;
