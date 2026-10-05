const Task = require('../models/Task');
const Project = require('../models/Project');
const Team = require('../models/Team');
const ActivityEvent = require('../models/ActivityEvent');

const ASSUMED_WEEKLY_CAPACITY_MINUTES = 2400; // 40 hours
const ASSUMED_DAILY_CAPACITY_MINUTES = 480;  // 8 hours
const CAPACITY_LABEL = "Assumed Capacity (Default 40h/wk)";

/**
 * Calculate deterministic workload metrics and utilization for a single user.
 */
async function getUserWorkload(userId, options = {}) {
  if (!userId) return null;

  const now = options.now ? new Date(options.now) : new Date();

  const tasks = await Task.find({
    assignedTo: userId,
    deletedAt: null
  });

  const activeTasks = tasks.filter(t => !t.completed && t.status !== 'Done' && t.status !== 'COMPLETED');
  const completedTasks = tasks.filter(t => t.completed || t.status === 'Done' || t.status === 'COMPLETED');

  let totalEstimatedWorkloadMinutes = 0;
  let overdueWorkloadMinutes = 0;
  let overdueCount = 0;
  let highPriorityCount = 0;
  let overdueHighPriorityCount = 0;

  activeTasks.forEach(task => {
    // Effort estimation with 60 minute default fallback for calculation
    const taskMinutes = (task.estimatedMinutes && task.estimatedMinutes > 0)
      ? task.estimatedMinutes
      : 60;

    totalEstimatedWorkloadMinutes += taskMinutes;

    const isOverdue = task.dueDate && new Date(task.dueDate) < now;
    const isHighPriority = task.priority === 'High';

    if (isOverdue) {
      overdueWorkloadMinutes += taskMinutes;
      overdueCount++;
    }

    if (isHighPriority) {
      highPriorityCount++;
      if (isOverdue) {
        overdueHighPriorityCount++;
      }
    }
  });

  // Calculate Capacity Utilization
  const capacityUtilizationPercentage = Math.round((totalEstimatedWorkloadMinutes / ASSUMED_WEEKLY_CAPACITY_MINUTES) * 100);

  // Determine Overload Status & Load Level
  const isOverloaded = capacityUtilizationPercentage > 130 || overdueHighPriorityCount > 3;

  let loadLevel = 'NORMAL';
  if (isOverloaded || capacityUtilizationPercentage > 130) {
    loadLevel = 'OVERLOADED';
  } else if (capacityUtilizationPercentage > 110) {
    loadLevel = 'HIGH_LOAD';
  } else if (capacityUtilizationPercentage >= 90) {
    loadLevel = 'MODERATE_LOAD';
  }

  return {
    userId,
    activeTaskCount: activeTasks.length,
    completedTaskCount: completedTasks.length,
    totalEstimatedWorkloadMinutes,
    totalEstimatedWorkloadHours: Math.round((totalEstimatedWorkloadMinutes / 60) * 10) / 10,
    overdueWorkloadMinutes,
    overdueWorkloadHours: Math.round((overdueWorkloadMinutes / 60) * 10) / 10,
    overdueCount,
    highPriorityCount,
    overdueHighPriorityCount,
    assumedCapacityMinutes: ASSUMED_WEEKLY_CAPACITY_MINUTES,
    assumedCapacityHours: 40,
    capacityLabel: CAPACITY_LABEL,
    capacityUtilizationPercentage,
    loadLevel,
    isOverloaded,
    advisoryMessage: isOverloaded
      ? 'Workload exceeds assumed capacity (130% utilization threshold) or has multiple overdue high-priority tasks.'
      : 'Workload is within healthy operating boundaries.'
  };
}

/**
 * Aggregate project workload metrics grouped by assigned members.
 */
async function getProjectWorkload(projectId, options = {}) {
  const tasks = await Task.find({ projectId, deletedAt: null }).populate('assignedTo', 'username');

  const now = options.now ? new Date(options.now) : new Date();

  const activeTasks = tasks.filter(t => !t.completed && t.status !== 'Done' && t.status !== 'COMPLETED');
  const completedTasks = tasks.filter(t => t.completed || t.status === 'Done' || t.status === 'COMPLETED');

  let totalProjectWorkloadMinutes = 0;
  let totalOverdueWorkloadMinutes = 0;

  const memberWorkloadMap = {};

  activeTasks.forEach(task => {
    const taskMinutes = (task.estimatedMinutes && task.estimatedMinutes > 0) ? task.estimatedMinutes : 60;
    totalProjectWorkloadMinutes += taskMinutes;

    const isOverdue = task.dueDate && new Date(task.dueDate) < now;
    if (isOverdue) {
      totalOverdueWorkloadMinutes += taskMinutes;
    }

    const assignee = task.assignedTo;
    const assigneeId = assignee ? assignee._id.toString() : 'UNASSIGNED';
    const username = assignee ? assignee.username : 'Unassigned';

    if (!memberWorkloadMap[assigneeId]) {
      memberWorkloadMap[assigneeId] = {
        userId: assigneeId,
        username,
        activeTaskCount: 0,
        estimatedWorkloadMinutes: 0,
        overdueTaskCount: 0,
        highPriorityCount: 0
      };
    }

    memberWorkloadMap[assigneeId].activeTaskCount++;
    memberWorkloadMap[assigneeId].estimatedWorkloadMinutes += taskMinutes;
    if (isOverdue) memberWorkloadMap[assigneeId].overdueTaskCount++;
    if (task.priority === 'High') memberWorkloadMap[assigneeId].highPriorityCount++;
  });

  const memberWorkloads = Object.values(memberWorkloadMap).map(m => ({
    ...m,
    estimatedWorkloadHours: Math.round((m.estimatedWorkloadMinutes / 60) * 10) / 10,
    capacityUtilizationPercentage: m.userId !== 'UNASSIGNED'
      ? Math.round((m.estimatedWorkloadMinutes / ASSUMED_WEEKLY_CAPACITY_MINUTES) * 100)
      : null,
    capacityLabel: CAPACITY_LABEL
  }));

  return {
    projectId,
    totalTasksCount: tasks.length,
    activeTasksCount: activeTasks.length,
    completedTasksCount: completedTasks.length,
    totalProjectWorkloadMinutes,
    totalProjectWorkloadHours: Math.round((totalProjectWorkloadMinutes / 60) * 10) / 10,
    totalOverdueWorkloadMinutes,
    memberWorkloads,
    assumedCapacityLabel: CAPACITY_LABEL
  };
}

/**
 * Aggregate team workload metrics grouped by team members.
 */
async function getTeamWorkload(teamId, options = {}) {
  const team = await Team.findById(teamId).populate('members.user', 'username');
  if (!team) return null;

  const memberIds = team.members.map(m => m.user._id);

  const memberWorkloads = await Promise.all(
    memberIds.map(async (uid) => {
      const userWl = await getUserWorkload(uid, options);
      const memberObj = team.members.find(m => m.user._id.equals(uid));
      return {
        ...userWl,
        username: memberObj ? memberObj.user.username : 'User',
        role: memberObj ? memberObj.role : 'Member'
      };
    })
  );

  let teamTotalWorkloadMinutes = 0;
  let teamOverloadedCount = 0;

  memberWorkloads.forEach(mw => {
    teamTotalWorkloadMinutes += mw.totalEstimatedWorkloadMinutes;
    if (mw.isOverloaded) teamOverloadedCount++;
  });

  return {
    teamId: team._id,
    teamName: team.name,
    totalMembers: memberIds.length,
    teamTotalWorkloadMinutes,
    teamTotalWorkloadHours: Math.round((teamTotalWorkloadMinutes / 60) * 10) / 10,
    teamOverloadedCount,
    memberWorkloads,
    assumedCapacityLabel: CAPACITY_LABEL
  };
}

module.exports = {
  getUserWorkload,
  getProjectWorkload,
  getTeamWorkload,
  ASSUMED_WEEKLY_CAPACITY_MINUTES,
  ASSUMED_DAILY_CAPACITY_MINUTES,
  CAPACITY_LABEL
};
