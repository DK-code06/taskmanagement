const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Task = require('../models/Task');
const Project = require('../models/Project');
const User = require('../models/User');
const { authorizeProject, canAccessProject, canAccessTask } = require('../middleware/authorize');
const { calculateTaskDebt, getProjectDebtSummary } = require('../services/taskDebtService');
const { getUserWorkload, getProjectWorkload, getTeamWorkload } = require('../services/workloadIntelligenceService');

// GET /api/intelligence/tasks/:id/debt - Get task debt score & signal breakdown
router.get('/tasks/:id/debt', async (req, res) => {
  try {
    const taskId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID format' });
    }

    const taskCheck = await canAccessTask(req.user.id, taskId);
    if (!taskCheck.allowed) {
      if (taskCheck.reason === 'NOT_FOUND') {
        return res.status(404).json({ error: 'Task not found' });
      }
      return res.status(403).json({ error: 'Access denied for this task' });
    }

    const debtInfo = await calculateTaskDebt(taskCheck.task);
    if (!debtInfo) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(debtInfo);
  } catch (err) {
    console.error('Failed to calculate task debt:', err);
    res.status(500).json({ error: 'Failed to calculate task debt' });
  }
});

// GET /api/intelligence/projects/:id/debt - Get project task debt summary & high debt tasks
router.get('/projects/:id/debt', authorizeProject('MEMBER'), async (req, res) => {
  try {
    const projectId = req.project._id;
    const debtSummary = await getProjectDebtSummary(projectId);

    res.json({
      projectId,
      projectName: req.project.name,
      ...debtSummary
    });
  } catch (err) {
    console.error('Failed to fetch project debt summary:', err);
    res.status(500).json({ error: 'Failed to fetch project debt summary' });
  }
});

// GET /api/intelligence/projects/:id/workload - Get project workload breakdown
router.get('/projects/:id/workload', authorizeProject('MEMBER'), async (req, res) => {
  try {
    const projectId = req.project._id;
    const workloadInfo = await getProjectWorkload(projectId);

    res.json({
      projectId,
      projectName: req.project.name,
      ...workloadInfo
    });
  } catch (err) {
    console.error('Failed to fetch project workload:', err);
    res.status(500).json({ error: 'Failed to fetch project workload' });
  }
});

// GET /api/intelligence/users/:id/workload - Get user workload metrics & capacity utilization
router.get('/users/:id/workload', async (req, res) => {
  try {
    const targetUserId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    // Access control: User can access own workload, or check if they share a team/project
    if (req.user.id !== targetUserId) {
      const requestingUserId = new mongoose.Types.ObjectId(req.user.id);
      const targetObjId = new mongoose.Types.ObjectId(targetUserId);

      // Check if target user exists
      const targetUser = await User.findById(targetUserId);
      if (!targetUser || targetUser.deletedAt) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check shared project access
      const sharedProjects = await Project.find({
        $or: [
          { ownerType: 'User', ownerId: requestingUserId },
          { 'members.user': requestingUserId }
        ],
        $and: [
          {
            $or: [
              { ownerType: 'User', ownerId: targetObjId },
              { 'members.user': targetObjId }
            ]
          }
        ],
        deletedAt: null
      });

      if (sharedProjects.length === 0) {
        return res.status(403).json({ error: 'Access denied to user workload information' });
      }
    }

    const workload = await getUserWorkload(targetUserId);
    if (!workload) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(workload);
  } catch (err) {
    console.error('Failed to fetch user workload:', err);
    res.status(500).json({ error: 'Failed to fetch user workload' });
  }
});

// GET /api/intelligence/users/:id/overview - Get personal intelligence overview
router.get('/users/:id/overview', async (req, res) => {
  try {
    const targetUserId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    if (req.user.id !== targetUserId) {
      return res.status(403).json({ error: 'Access denied to personal overview' });
    }

    const workload = await getUserWorkload(targetUserId);

    // Calculate user's assigned tasks debt distribution
    const assignedTasks = await Task.find({
      assignedTo: targetUserId,
      deletedAt: null
    });

    const debtCalculations = await Promise.all(
      assignedTasks.map(t => calculateTaskDebt(t))
    );

    const activeDebts = debtCalculations.filter(d => !d.isExcluded);
    const distribution = { LOW: 0, MODERATE: 0, HIGH: 0, CRITICAL: 0 };
    let totalScoreSum = 0;

    activeDebts.forEach(calc => {
      distribution[calc.classification] = (distribution[calc.classification] || 0) + 1;
      totalScoreSum += calc.debtScore;
    });

    const averageTaskDebt = activeDebts.length > 0
      ? Math.round(totalScoreSum / activeDebts.length)
      : 0;

    res.json({
      userId: targetUserId,
      workload,
      debtOverview: {
        activeTasksCount: activeDebts.length,
        averageTaskDebt,
        distribution,
        highDebtTasks: activeDebts.sort((a, b) => b.debtScore - a.debtScore).slice(0, 5)
      },
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Failed to fetch user intelligence overview:', err);
    res.status(500).json({ error: 'Failed to fetch user intelligence overview' });
  }
});

module.exports = router;
