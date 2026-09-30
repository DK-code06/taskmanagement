const Task = require('../models/Task');
const Category = require('../models/Category');
const Team = require('../models/Team');
const { logAuditEvent } = require('../services/auditService');

/**
 * Check if the authenticated user has access to a Category.
 */
async function canAccessCategory(userId, categoryId) {
  const category = await Category.findById(categoryId);
  if (!category) return { allowed: false, reason: 'NOT_FOUND' };

  if (category.ownerType === 'User') {
    if (category.ownerId.equals(userId)) {
      return { allowed: true, category };
    }
  } else if (category.ownerType === 'Team') {
    const team = await Team.findById(category.ownerId);
    if (team && team.members.some(m => m.user.equals(userId))) {
      return { allowed: true, category, team };
    }
  }

  return { allowed: false, reason: 'FORBIDDEN' };
}

/**
 * Check if the authenticated user has access to a Task.
 */
async function canAccessTask(userId, taskId) {
  const task = await Task.findById(taskId);
  if (!task) return { allowed: false, reason: 'NOT_FOUND' };

  // 1. Direct creator or assigned user
  if (task.user.equals(userId) || (task.assignedTo && task.assignedTo.equals(userId))) {
    return { allowed: true, task };
  }

  // 2. Access via Category ownership (User or Team)
  if (task.category) {
    const catCheck = await canAccessCategory(userId, task.category);
    if (catCheck.allowed) {
      return { allowed: true, task, category: catCheck.category };
    }
  }

  return { allowed: false, reason: 'FORBIDDEN' };
}

/**
 * Middleware requiring task access.
 */
function authorizeTask(req, res, next) {
  const taskId = req.params.id || req.params.taskId;
  if (!taskId) return res.status(400).json({ error: "Task ID parameter is required." });

  canAccessTask(req.user.id, taskId).then(({ allowed, reason, task }) => {
    if (!allowed) {
      logAuditEvent({ userId: req.user.id, action: 'PERMISSION_DENIED', req, details: { resource: 'task', taskId } });
      if (reason === 'NOT_FOUND') return res.status(404).json({ error: "Task not found" });
      return res.status(403).json({ error: "Access denied: You do not have permission for this task." });
    }
    req.task = task;
    next();
  }).catch(err => {
    console.error("Authorization error:", err);
    res.status(500).json({ error: "Authorization error" });
  });
}

/**
 * Middleware requiring category access.
 */
function authorizeCategory(req, res, next) {
  const categoryId = req.params.categoryId || req.params.id;
  if (!categoryId) return res.status(400).json({ error: "Category ID parameter is required." });

  canAccessCategory(req.user.id, categoryId).then(({ allowed, reason, category }) => {
    if (!allowed) {
      logAuditEvent({ userId: req.user.id, action: 'PERMISSION_DENIED', req, details: { resource: 'category', categoryId } });
      if (reason === 'NOT_FOUND') return res.status(404).json({ error: "Category not found" });
      return res.status(403).json({ error: "Access denied: You do not have permission for this category." });
    }
    req.category = category;
    next();
  }).catch(err => {
    console.error("Authorization error:", err);
    res.status(500).json({ error: "Authorization error" });
  });
}

/**
 * Middleware requiring team membership & role checks.
 */
function authorizeTeam(requiredRole = 'Member') {
  return async (req, res, next) => {
    const teamId = req.params.teamId || req.params.id;
    if (!teamId) return res.status(400).json({ error: "Team ID parameter is required." });

    try {
      const team = await Team.findById(teamId);
      if (!team) return res.status(404).json({ error: "Team not found." });

      const member = team.members.find(m => m.user.equals(req.user.id));
      if (!member) {
        logAuditEvent({ userId: req.user.id, action: 'PERMISSION_DENIED', req, details: { resource: 'team', teamId } });
        return res.status(403).json({ error: "You are not a member of this team." });
      }

      if (requiredRole === 'Admin' && member.role !== 'Admin' && !team.createdBy.equals(req.user.id)) {
        logAuditEvent({ userId: req.user.id, action: 'PERMISSION_DENIED', req, details: { resource: 'team', teamId, requiredRole } });
        return res.status(403).json({ error: "Admin permissions required for this team action." });
      }

      req.team = team;
      req.teamMemberRole = member.role;
      next();
    } catch (err) {
      console.error("Team authorization error:", err);
      res.status(500).json({ error: "Authorization error" });
    }
  };
}

module.exports = {
  canAccessCategory,
  canAccessTask,
  authorizeTask,
  authorizeCategory,
  authorizeTeam
};
