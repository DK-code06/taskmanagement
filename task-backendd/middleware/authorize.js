const mongoose = require('mongoose');
const Project = require('../models/Project');
const Milestone = require('../models/Milestone');
const Task = require('../models/Task');
const Category = require('../models/Category');
const Team = require('../models/Team');
const { logAuditEvent } = require('../services/auditService');

/**
 * Helper: Check if user has access to a Project.
 */
async function canAccessProject(userId, projectId) {
  if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) return { allowed: false, reason: 'NOT_FOUND' };
  const project = await Project.findById(projectId);
  if (!project || project.deletedAt) return { allowed: false, reason: 'NOT_FOUND' };

  if (project.ownerType === 'User') {
    if (project.ownerId.equals(userId)) {
      return { allowed: true, project, role: 'OWNER' };
    }
  } else if (project.ownerType === 'Team') {
    const team = await Team.findById(project.ownerId);
    if (team) {
      const member = team.members.find(m => m.user.equals(userId));
      if (member) {
        return { allowed: true, project, team, role: member.role };
      }
    }
  }

  // Check explicit project members list if defined
  if (project.members && project.members.length > 0) {
    const member = project.members.find(m => m.user.equals(userId));
    if (member) {
      return { allowed: true, project, role: member.role };
    }
  }

  return { allowed: false, reason: 'FORBIDDEN' };
}

/**
 * Helper: Check if user has access to a Milestone via its parent Project.
 */
async function canAccessMilestone(userId, milestoneId) {
  if (!milestoneId || !mongoose.Types.ObjectId.isValid(milestoneId)) return { allowed: false, reason: 'NOT_FOUND' };
  const milestone = await Milestone.findById(milestoneId);
  if (!milestone || milestone.deletedAt) return { allowed: false, reason: 'NOT_FOUND' };

  const projectCheck = await canAccessProject(userId, milestone.projectId);
  if (!projectCheck.allowed) {
    return { allowed: false, reason: projectCheck.reason };
  }

  return { allowed: true, milestone, project: projectCheck.project, role: projectCheck.role };
}

/**
 * Helper: Check if user has access to a Task or Subtask through hierarchy.
 */
async function canAccessTask(userId, taskId) {
  if (!taskId || !mongoose.Types.ObjectId.isValid(taskId)) return { allowed: false, reason: 'NOT_FOUND' };
  const task = await Task.findById(taskId);
  if (!task || task.deletedAt) return { allowed: false, reason: 'NOT_FOUND' };

  // 1. Direct creator or assigned user
  if (task.user.equals(userId) || (task.assignedTo && task.assignedTo.equals(userId))) {
    return { allowed: true, task };
  }

  // 2. Parent Project access
  if (task.projectId) {
    const projectCheck = await canAccessProject(userId, task.projectId);
    if (projectCheck.allowed) {
      return { allowed: true, task, project: projectCheck.project };
    }
  }

  // 3. Parent Task access (for subtasks)
  if (task.parentTaskId) {
    const parentCheck = await canAccessTask(userId, task.parentTaskId);
    if (parentCheck.allowed) {
      return { allowed: true, task, parentTask: parentCheck.task };
    }
  }

  // 4. Legacy Category access fallback
  if (task.category) {
    const category = await Category.findById(task.category);
    if (category) {
      if (category.ownerType === 'User' && category.ownerId.equals(userId)) {
        return { allowed: true, task, category };
      }
      if (category.ownerType === 'Team') {
        const team = await Team.findById(category.ownerId);
        if (team && team.members.some(m => m.user.equals(userId))) {
          return { allowed: true, task, category, team };
        }
      }
    }
  }

  return { allowed: false, reason: 'FORBIDDEN' };
}

/**
 * Middleware requiring Project access.
 */
function authorizeProject(requiredRole = 'MEMBER') {
  return async (req, res, next) => {
    const projectId = req.params.projectId || req.params.id;
    if (!projectId) return res.status(400).json({ error: "Project ID parameter is required." });

    const check = await canAccessProject(req.user.id, projectId);
    if (!check.allowed) {
      logAuditEvent({ userId: req.user.id, action: 'PERMISSION_DENIED', req, details: { resource: 'project', projectId } });
      if (check.reason === 'NOT_FOUND') return res.status(404).json({ error: "Project not found" });
      return res.status(403).json({ error: "Access denied for this project." });
    }

    if (requiredRole === 'ADMIN' && check.role !== 'OWNER' && check.role !== 'ADMIN') {
      logAuditEvent({ userId: req.user.id, action: 'PERMISSION_DENIED', req, details: { resource: 'project', projectId, requiredRole } });
      return res.status(403).json({ error: "Admin permissions required for this project action." });
    }

    req.project = check.project;
    req.projectRole = check.role;
    next();
  };
}

/**
 * Middleware requiring Milestone access.
 */
function authorizeMilestone(req, res, next) {
  const milestoneId = req.params.milestoneId || req.params.id;
  if (!milestoneId) return res.status(400).json({ error: "Milestone ID parameter is required." });

  canAccessMilestone(req.user.id, milestoneId).then(check => {
    if (!check.allowed) {
      logAuditEvent({ userId: req.user.id, action: 'PERMISSION_DENIED', req, details: { resource: 'milestone', milestoneId } });
      if (check.reason === 'NOT_FOUND') return res.status(404).json({ error: "Milestone not found" });
      return res.status(403).json({ error: "Access denied for this milestone." });
    }

    req.milestone = check.milestone;
    req.project = check.project;
    next();
  }).catch(err => {
    console.error("Milestone auth error:", err);
    res.status(500).json({ error: "Authorization error" });
  });
}

/**
 * Middleware requiring Task access.
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
    console.error("Task auth error:", err);
    res.status(500).json({ error: "Authorization error" });
  });
}

/**
 * Middleware requiring Team access.
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
      console.error("Team auth error:", err);
      res.status(500).json({ error: "Authorization error" });
    }
  };
}

/**
 * Middleware requiring Category access.
 */
async function authorizeCategory(req, res, next) {
  const categoryId = req.params.id || req.params.categoryId;
  if (!categoryId) return res.status(400).json({ error: "Category ID parameter is required." });

  try {
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    if (category.ownerType === 'User' && category.ownerId.equals(req.user.id)) {
      req.category = category;
      return next();
    }

    if (category.ownerType === 'Team') {
      const team = await Team.findById(category.ownerId);
      if (team && team.members.some(m => m.user.equals(req.user.id))) {
        req.category = category;
        return next();
      }
    }

    logAuditEvent({ userId: req.user.id, action: 'PERMISSION_DENIED', req, details: { resource: 'category', categoryId } });
    return res.status(403).json({ error: "Access denied for this category." });
  } catch (err) {
    console.error("Category auth error:", err);
    res.status(500).json({ error: "Authorization error" });
  }
}

/**
 * Helper: Check if user has access to a Category.
 */
async function canAccessCategory(userId, categoryId) {
  if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) return { allowed: false, reason: 'NOT_FOUND' };
  const category = await Category.findById(categoryId);
  if (!category) return { allowed: false, reason: 'NOT_FOUND' };

  if (category.ownerType === 'User' && category.ownerId.equals(userId)) {
    return { allowed: true, category };
  }

  if (category.ownerType === 'Team') {
    const team = await Team.findById(category.ownerId);
    if (team && team.members.some(m => m.user.equals(userId))) {
      return { allowed: true, category, team };
    }
  }

  return { allowed: false, reason: 'FORBIDDEN' };
}

module.exports = {
  canAccessProject,
  canAccessMilestone,
  canAccessTask,
  canAccessCategory,
  authorizeProject,
  authorizeMilestone,
  authorizeTask,
  authorizeTeam,
  authorizeCategory
};
