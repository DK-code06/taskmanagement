const Task = require('../models/Task');
const Project = require('../models/Project');
const ActivityEvent = require('../models/ActivityEvent');

/**
 * Calculate deterministic Task Debt Score (0 - 100) and signal breakdown for a single task.
 */
async function calculateTaskDebt(taskIdOrDoc, options = {}) {
  let task = taskIdOrDoc;
  if (typeof taskIdOrDoc === 'string' || taskIdOrDoc instanceof require('mongoose').Types.ObjectId) {
    task = await Task.findById(taskIdOrDoc);
  }

  if (!task) {
    return null;
  }

  // Check if project is archived
  let isProjectArchived = false;
  if (task.projectId) {
    const project = await Project.findById(task.projectId).select('status');
    if (project && project.status === 'ARCHIVED') {
      isProjectArchived = true;
    }
  }

  // Exclusion Rules: Completed, Soft-deleted, or Archived project tasks -> Debt = 0
  const isCompleted = task.completed || task.status === 'Done' || task.status === 'COMPLETED';
  const isDeleted = Boolean(task.deletedAt);

  if (isCompleted || isDeleted || isProjectArchived) {
    let exclusionReason = null;
    if (isCompleted) exclusionReason = 'Task is completed';
    else if (isDeleted) exclusionReason = 'Task is deleted';
    else if (isProjectArchived) exclusionReason = 'Project is archived';

    return {
      taskId: task._id,
      title: task.title,
      debtScore: 0,
      classification: 'LOW',
      isExcluded: true,
      exclusionReason,
      priority: task.priority || 'No Priority',
      priorityMultiplier: getPriorityMultiplier(task.priority),
      breakdown: {
        overdueScore: 0,
        proximityScore: 0,
        stagnationScore: 0,
        churnScore: 0,
        rawTotal: 0,
        boundedScore: 0
      },
      signals: {
        daysOverdue: 0,
        hoursRemaining: null,
        daysStagnant: 0,
        reopenCount: 0,
        dueDateChangeCount: 0
      },
      updatedAt: new Date().toISOString()
    };
  }

  const now = options.now ? new Date(options.now) : new Date();

  // 1. Overdue Duration Severity (Max 40 pts, 8 pts/day overdue)
  let overdueScore = 0;
  let daysOverdue = 0;
  if (task.dueDate && new Date(task.dueDate) < now) {
    const diffMs = now.getTime() - new Date(task.dueDate).getTime();
    daysOverdue = Math.max(0, diffMs / (1000 * 60 * 60 * 24));
    overdueScore = Math.min(40, Math.floor(daysOverdue * 8));
  }

  // 2. Due Date Proximity (Max 15 pts, unstarted task within 48h deadline)
  let proximityScore = 0;
  let hoursRemaining = null;
  const isUnstarted = task.status === 'READY' || task.status === 'To Do';
  if (task.dueDate && new Date(task.dueDate) >= now && isUnstarted) {
    const diffMs = new Date(task.dueDate).getTime() - now.getTime();
    hoursRemaining = Math.max(0, diffMs / (1000 * 60 * 60));
    if (hoursRemaining <= 48) {
      proximityScore = Math.min(15, Math.floor((48 - hoursRemaining) / 3.2));
    }
  }

  // 3. Status Stagnation (Max 20 pts, in progress/blocked > 3 days without update)
  let stagnationScore = 0;
  let daysStagnant = 0;
  const isStagnationEligible = task.status === 'IN_PROGRESS' || task.status === 'In Progress' || task.status === 'BLOCKED';
  if (isStagnationEligible) {
    let lastActiveDate = task.startedAt || task.updatedAt || task.createdAt;
    const latestEvent = await ActivityEvent.findOne({ taskId: task._id }).sort({ createdAt: -1 });
    if (latestEvent && latestEvent.createdAt) {
      lastActiveDate = latestEvent.createdAt;
    }

    const diffMs = now.getTime() - new Date(lastActiveDate).getTime();
    daysStagnant = Math.max(0, diffMs / (1000 * 60 * 60 * 24));
    if (daysStagnant > 3) {
      stagnationScore = Math.min(20, Math.floor((daysStagnant - 3) * 4));
    }
  }

  // 4. Event Churn (Max 15 pts, derived from ActivityEvents)
  let churnScore = 0;
  let reopenCount = 0;
  let dueDateChangeCount = 0;

  const activityEvents = await ActivityEvent.find({
    taskId: task._id,
    eventType: { $in: ['TASK_REOPENED', 'TASK_DUE_DATE_CHANGED', 'TASK_POSTPONED'] }
  }).select('eventType');

  activityEvents.forEach((evt) => {
    if (evt.eventType === 'TASK_REOPENED') reopenCount++;
    if (evt.eventType === 'TASK_DUE_DATE_CHANGED' || evt.eventType === 'TASK_POSTPONED') dueDateChangeCount++;
  });

  churnScore = Math.min(15, (reopenCount * 6) + (dueDateChangeCount * 3));

  // Priority Multiplier
  const priorityMultiplier = getPriorityMultiplier(task.priority);

  // Raw Total & Final Bounded Score
  const rawTotal = (overdueScore + proximityScore + stagnationScore + churnScore) * priorityMultiplier;
  const boundedScore = Math.min(100, Math.max(0, Math.round(rawTotal)));
  const classification = getClassification(boundedScore);

  return {
    taskId: task._id,
    title: task.title,
    debtScore: boundedScore,
    classification,
    isExcluded: false,
    exclusionReason: null,
    priority: task.priority || 'No Priority',
    priorityMultiplier,
    breakdown: {
      overdueScore,
      proximityScore,
      stagnationScore,
      churnScore,
      rawTotal: Math.round(rawTotal * 100) / 100,
      boundedScore
    },
    signals: {
      daysOverdue: Math.round(daysOverdue * 10) / 10,
      hoursRemaining: hoursRemaining !== null ? Math.round(hoursRemaining * 10) / 10 : null,
      daysStagnant: Math.round(daysStagnant * 10) / 10,
      reopenCount,
      dueDateChangeCount
    },
    updatedAt: new Date().toISOString()
  };
}

/**
 * Get project-level task debt summary and top high-debt tasks.
 */
async function getProjectDebtSummary(projectId, options = {}) {
  const tasks = await Task.find({ projectId, deletedAt: null });

  if (!tasks || tasks.length === 0) {
    return {
      projectId,
      totalTasks: 0,
      activeTasksCount: 0,
      averageDebtScore: 0,
      classification: 'LOW',
      distribution: { LOW: 0, MODERATE: 0, HIGH: 0, CRITICAL: 0 },
      highDebtTasks: []
    };
  }

  const debtCalculations = await Promise.all(
    tasks.map(t => calculateTaskDebt(t, options))
  );

  const activeCalculations = debtCalculations.filter(d => !d.isExcluded);

  const distribution = { LOW: 0, MODERATE: 0, HIGH: 0, CRITICAL: 0 };
  let totalScoreSum = 0;

  activeCalculations.forEach(calc => {
    distribution[calc.classification] = (distribution[calc.classification] || 0) + 1;
    totalScoreSum += calc.debtScore;
  });

  const averageDebtScore = activeCalculations.length > 0
    ? Math.round(totalScoreSum / activeCalculations.length)
    : 0;

  const projectClassification = getClassification(averageDebtScore);

  // Sort tasks by debt score descending
  const sortedTasks = [...debtCalculations].sort((a, b) => b.debtScore - a.debtScore);

  return {
    projectId,
    totalTasks: tasks.length,
    activeTasksCount: activeCalculations.length,
    averageDebtScore,
    classification: projectClassification,
    distribution,
    highDebtTasks: sortedTasks.slice(0, 5)
  };
}

function getPriorityMultiplier(priority) {
  switch (priority) {
    case 'High':
      return 1.5;
    case 'Medium':
      return 1.0;
    case 'Low':
      return 0.7;
    case 'No Priority':
    default:
      return 0.5;
  }
}

function getClassification(score) {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MODERATE';
  return 'LOW';
}

module.exports = {
  calculateTaskDebt,
  getProjectDebtSummary,
  getPriorityMultiplier,
  getClassification
};
