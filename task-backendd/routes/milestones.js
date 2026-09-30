const express = require("express");
const router = express.Router();
const Milestone = require("../models/Milestone");
const { authorizeProject, authorizeMilestone } = require("../middleware/authorize");
const { logActivityEvent } = require("../services/activityService");

// GET /api/milestones/project/:projectId - Get milestones for a project
router.get("/project/:projectId", authorizeProject('MEMBER'), async (req, res) => {
  try {
    const milestones = await Milestone.find({
      projectId: req.project._id,
      deletedAt: null
    }).sort({ order: 1 });

    res.json(milestones);
  } catch (err) {
    console.error("Error fetching milestones:", err);
    res.status(500).json({ error: "Failed to fetch milestones" });
  }
});

// POST /api/milestones - Create a milestone inside a project
router.post("/", async (req, res) => {
  try {
    const { projectId, title, description = "", dueDate = null, order = 0 } = req.body;
    if (!projectId || !title || !title.trim()) {
      return res.status(400).json({ error: "projectId and title are required" });
    }

    // Verify user access to project
    const { canAccessProject } = require("../middleware/authorize");
    const check = await canAccessProject(req.user.id, projectId);
    if (!check.allowed) {
      return res.status(403).json({ error: "Access denied for this project" });
    }

    const milestone = new Milestone({
      projectId,
      title: title.trim(),
      description: description.trim(),
      dueDate: dueDate || null,
      order,
      status: "PLANNED"
    });

    await milestone.save();

    await logActivityEvent({
      eventType: "MILESTONE_CREATED",
      actorId: req.user.id,
      projectId,
      milestoneId: milestone._id,
      metadata: { title: milestone.title }
    });

    res.status(201).json(milestone);
  } catch (err) {
    console.error("Error creating milestone:", err);
    res.status(500).json({ error: "Failed to create milestone" });
  }
});

// PUT /api/milestones/:id - Update milestone
router.put("/:id", authorizeMilestone, async (req, res) => {
  try {
    const { title, description, status, dueDate, order } = req.body;
    const milestone = req.milestone;

    if (title !== undefined) milestone.title = title.trim();
    if (description !== undefined) milestone.description = description.trim();
    if (dueDate !== undefined) milestone.dueDate = dueDate;
    if (order !== undefined) milestone.order = order;

    if (status !== undefined) {
      milestone.status = status;
      if (status === "COMPLETED") {
        await logActivityEvent({
          eventType: "MILESTONE_COMPLETED",
          actorId: req.user.id,
          projectId: milestone.projectId,
          milestoneId: milestone._id,
          metadata: { title: milestone.title }
        });
      }
    }

    await milestone.save();
    res.json(milestone);
  } catch (err) {
    console.error("Error updating milestone:", err);
    res.status(500).json({ error: "Failed to update milestone" });
  }
});

// DELETE /api/milestones/:id - Soft delete milestone
router.delete("/:id", authorizeMilestone, async (req, res) => {
  try {
    const milestone = req.milestone;
    milestone.deletedAt = new Date();
    await milestone.save();

    res.json({ message: "Milestone deleted successfully" });
  } catch (err) {
    console.error("Error deleting milestone:", err);
    res.status(500).json({ error: "Failed to delete milestone" });
  }
});

module.exports = router;
