const express = require("express");
const mongoose = require("mongoose");
const FocusSession = require("../models/FocusSession");
const Task = require("../models/Task");
const { canAccessTask } = require("../middleware/authorize");

module.exports = function createFocusRoutes(io) {
  const router = express.Router();

  // Helper: Compute server-authoritative elapsed focus seconds
  function calculateElapsedSeconds(session, now = new Date()) {
    if (!session) return 0;
    const accumulated = session.accumulatedFocusedSeconds || 0;
    if (session.status === "ACTIVE" && session.lastResumedAt) {
      const activeSegment = Math.max(
        0,
        Math.floor((now.getTime() - new Date(session.lastResumedAt).getTime()) / 1000)
      );
      return accumulated + activeSegment;
    }
    return accumulated;
  }

  // Helper: Broadcast focus session updates via Socket.IO
  function broadcastSessionUpdate(userId, event, sessionData) {
    if (io && userId) {
      io.to(`user:${userId.toString()}`).emit(event, sessionData);
    }
  }

  // POST /api/focus/sessions - Start a new Focus Session
  router.post("/sessions", async (req, res) => {
    try {
      const { taskId, notes } = req.body;

      if (!taskId || !mongoose.Types.ObjectId.isValid(taskId)) {
        return res.status(400).json({ error: "Valid task ID is required" });
      }

      // Check Task Access (IDOR protection)
      const accessCheck = await canAccessTask(req.user.id, taskId);
      if (!accessCheck.allowed) {
        if (accessCheck.reason === "NOT_FOUND") {
          return res.status(404).json({ error: "Task not found" });
        }
        return res.status(403).json({ error: "Access denied for this task" });
      }

      const task = accessCheck.task;

      // Check if user already has an active or paused session
      const existingSession = await FocusSession.findOne({
        userId: req.user.id,
        status: { $in: ["ACTIVE", "PAUSED"] }
      }).populate("taskId", "title priority status");

      if (existingSession) {
        return res.status(409).json({
          error: "An active focus session already exists.",
          activeSession: existingSession,
          elapsedSeconds: calculateElapsedSeconds(existingSession)
        });
      }

      const now = new Date();
      const newSession = new FocusSession({
        userId: req.user.id,
        taskId: task._id,
        projectId: task.projectId || null,
        status: "ACTIVE",
        startedAt: now,
        lastResumedAt: now,
        notes: notes ? String(notes).trim() : ""
      });

      await newSession.save();
      await newSession.populate("taskId", "title priority status");
      if (newSession.projectId) {
        await newSession.populate("projectId", "name");
      }

      broadcastSessionUpdate(req.user.id, "FOCUS_SESSION_STARTED", newSession);

      res.status(201).json({
        session: newSession,
        elapsedSeconds: 0
      });
    } catch (err) {
      if (err.code === 11000) {
        // Mongoose partial unique index duplicate key protection
        const activeSession = await FocusSession.findOne({
          userId: req.user.id,
          status: { $in: ["ACTIVE", "PAUSED"] }
        }).populate("taskId", "title priority status");

        return res.status(409).json({
          error: "An active focus session already exists.",
          activeSession,
          elapsedSeconds: calculateElapsedSeconds(activeSession)
        });
      }
      console.error("Failed to start focus session:", err);
      res.status(500).json({ error: "Failed to start focus session" });
    }
  });

  // GET /api/focus/sessions/active - Get current user's active/paused focus session
  router.get("/sessions/active", async (req, res) => {
    try {
      const activeSession = await FocusSession.findOne({
        userId: req.user.id,
        status: { $in: ["ACTIVE", "PAUSED"] }
      })
        .populate("taskId", "title priority status estimatedMinutes")
        .populate("projectId", "name");

      if (!activeSession) {
        return res.json({ activeSession: null, elapsedSeconds: 0 });
      }

      // Verify task still exists and user still has access
      const accessCheck = await canAccessTask(req.user.id, activeSession.taskId._id || activeSession.taskId);
      if (!accessCheck.allowed) {
        // Task deleted or access revoked -> auto-cancel session
        activeSession.status = "CANCELLED";
        activeSession.endedAt = new Date();
        await activeSession.save();
        broadcastSessionUpdate(req.user.id, "FOCUS_SESSION_CANCELLED", activeSession);
        return res.json({ activeSession: null, elapsedSeconds: 0 });
      }

      const elapsedSeconds = calculateElapsedSeconds(activeSession);

      res.json({
        activeSession,
        elapsedSeconds
      });
    } catch (err) {
      console.error("Failed to fetch active focus session:", err);
      res.status(500).json({ error: "Failed to fetch active focus session" });
    }
  });

  // POST /api/focus/sessions/:id/pause - Pause an active focus session
  router.post("/sessions/:id/pause", async (req, res) => {
    try {
      const sessionId = req.params.id;

      if (!mongoose.Types.ObjectId.isValid(sessionId)) {
        return res.status(400).json({ error: "Invalid session ID format" });
      }

      const session = await FocusSession.findById(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Focus session not found" });
      }

      // Ownership Check
      if (!session.userId.equals(req.user.id)) {
        return res.status(403).json({ error: "Access denied for this focus session" });
      }

      if (session.status !== "ACTIVE") {
        return res.status(400).json({ error: `Cannot pause a session with status '${session.status}'` });
      }

      const now = new Date();
      const segmentSeconds = Math.max(
        0,
        Math.floor((now.getTime() - new Date(session.lastResumedAt).getTime()) / 1000)
      );

      session.accumulatedFocusedSeconds += segmentSeconds;
      session.pausedAt = now;
      session.status = "PAUSED";
      session.pauseCount += 1;

      await session.save();
      await session.populate("taskId", "title priority status");
      if (session.projectId) await session.populate("projectId", "name");

      broadcastSessionUpdate(req.user.id, "FOCUS_SESSION_PAUSED", session);

      res.json({
        session,
        elapsedSeconds: session.accumulatedFocusedSeconds
      });
    } catch (err) {
      console.error("Failed to pause focus session:", err);
      res.status(500).json({ error: "Failed to pause focus session" });
    }
  });

  // POST /api/focus/sessions/:id/resume - Resume a paused focus session
  router.post("/sessions/:id/resume", async (req, res) => {
    try {
      const sessionId = req.params.id;

      if (!mongoose.Types.ObjectId.isValid(sessionId)) {
        return res.status(400).json({ error: "Invalid session ID format" });
      }

      const session = await FocusSession.findById(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Focus session not found" });
      }

      // Ownership Check
      if (!session.userId.equals(req.user.id)) {
        return res.status(403).json({ error: "Access denied for this focus session" });
      }

      if (session.status !== "PAUSED") {
        return res.status(400).json({ error: `Cannot resume a session with status '${session.status}'` });
      }

      const now = new Date();
      session.lastResumedAt = now;
      session.pausedAt = null;
      session.status = "ACTIVE";

      await session.save();
      await session.populate("taskId", "title priority status");
      if (session.projectId) await session.populate("projectId", "name");

      broadcastSessionUpdate(req.user.id, "FOCUS_SESSION_RESUMED", session);

      res.json({
        session,
        elapsedSeconds: calculateElapsedSeconds(session, now)
      });
    } catch (err) {
      console.error("Failed to resume focus session:", err);
      res.status(500).json({ error: "Failed to resume focus session" });
    }
  });

  // POST /api/focus/sessions/:id/complete - Complete focus session & update Task.actualMinutes
  router.post("/sessions/:id/complete", async (req, res) => {
    try {
      const sessionId = req.params.id;

      if (!mongoose.Types.ObjectId.isValid(sessionId)) {
        return res.status(400).json({ error: "Invalid session ID format" });
      }

      const session = await FocusSession.findById(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Focus session not found" });
      }

      // Ownership Check
      if (!session.userId.equals(req.user.id)) {
        return res.status(403).json({ error: "Access denied for this focus session" });
      }

      // Idempotency / State Check
      if (session.status === "COMPLETED") {
        return res.status(400).json({ error: "Focus session has already been completed" });
      }

      if (session.status === "CANCELLED") {
        return res.status(400).json({ error: "Cannot complete a cancelled focus session" });
      }

      const now = new Date();
      if (session.status === "ACTIVE" && session.lastResumedAt) {
        const segmentSeconds = Math.max(
          0,
          Math.floor((now.getTime() - new Date(session.lastResumedAt).getTime()) / 1000)
        );
        session.accumulatedFocusedSeconds += segmentSeconds;
      }

      session.endedAt = now;
      session.status = "COMPLETED";

      await session.save();

      // Atomic & Idempotent Update to Task.actualMinutes
      const totalFocusedSeconds = session.accumulatedFocusedSeconds;
      const addedMinutes = Math.round(totalFocusedSeconds / 60);

      if (addedMinutes > 0) {
        await Task.findByIdAndUpdate(session.taskId, {
          $inc: { actualMinutes: addedMinutes }
        });
      }

      await session.populate("taskId", "title priority status actualMinutes");
      if (session.projectId) await session.populate("projectId", "name");

      broadcastSessionUpdate(req.user.id, "FOCUS_SESSION_COMPLETED", session);

      res.json({
        session,
        elapsedSeconds: totalFocusedSeconds,
        addedMinutes
      });
    } catch (err) {
      console.error("Failed to complete focus session:", err);
      res.status(500).json({ error: "Failed to complete focus session" });
    }
  });

  // POST /api/focus/sessions/:id/cancel - Cancel a focus session
  router.post("/sessions/:id/cancel", async (req, res) => {
    try {
      const sessionId = req.params.id;

      if (!mongoose.Types.ObjectId.isValid(sessionId)) {
        return res.status(400).json({ error: "Invalid session ID format" });
      }

      const session = await FocusSession.findById(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Focus session not found" });
      }

      // Ownership Check
      if (!session.userId.equals(req.user.id)) {
        return res.status(403).json({ error: "Access denied for this focus session" });
      }

      if (session.status === "COMPLETED" || session.status === "CANCELLED") {
        return res.status(400).json({ error: `Cannot cancel a session with status '${session.status}'` });
      }

      session.status = "CANCELLED";
      session.endedAt = new Date();

      await session.save();

      broadcastSessionUpdate(req.user.id, "FOCUS_SESSION_CANCELLED", session);

      res.json({
        session,
        message: "Focus session cancelled successfully."
      });
    } catch (err) {
      console.error("Failed to cancel focus session:", err);
      res.status(500).json({ error: "Failed to cancel focus session" });
    }
  });

  // GET /api/focus/sessions/history - Query user's past focus sessions
  router.get("/sessions/history", async (req, res) => {
    try {
      const sessions = await FocusSession.find({ userId: req.user.id })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate("taskId", "title priority status")
        .populate("projectId", "name");

      res.json(sessions);
    } catch (err) {
      console.error("Failed to fetch focus session history:", err);
      res.status(500).json({ error: "Failed to fetch focus session history" });
    }
  });

  return router;
};
