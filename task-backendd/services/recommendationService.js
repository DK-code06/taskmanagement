const Task = require('../models/Task');
const Project = require('../models/Project');
const RecommendationState = require('../models/RecommendationState');
const { calculateTaskDebt } = require('./taskDebtService');
const { getProjectWorkload } = require('./workloadIntelligenceService');

/**
 * Generate 100% deterministic, advisory project recommendations based on Phase 2-C intelligence.
 */
async function generateProjectRecommendations(projectId, requestingUserId, options = {}) {
  const project = await Project.findById(projectId);
  if (!project || project.deletedAt) {
    return [];
  }

  const now = options.now ? new Date(options.now) : new Date();

  // Retrieve stored dismissals for this project
  const dismissedStates = await RecommendationState.find({
    projectId,
    status: 'DISMISSED'
  });

  const dismissedSet = new Set(
    dismissedStates.map(s => `${s.ruleType}:${s.entityId || projectId}:${s.targetUserId || ''}`)
  );

  const rawRecommendations = [];

  // Fetch project tasks
  const tasks = await Task.find({ projectId, deletedAt: null });
  const activeTasks = tasks.filter(t => !t.completed && t.status !== 'Done' && t.status !== 'COMPLETED');

  // RULE 1: REALLOCATE_WORKLOAD
  try {
    const workloadInfo = await getProjectWorkload(projectId, { now });
    if (workloadInfo && workloadInfo.memberWorkloads && workloadInfo.memberWorkloads.length > 1) {
      const memberWorkloads = workloadInfo.memberWorkloads.filter(m => m.userId !== 'UNASSIGNED');

      const overburdened = memberWorkloads.find(m => m.capacityUtilizationPercentage > 130);
      const available = memberWorkloads.find(m => m.capacityUtilizationPercentage < 60);

      if (overburdened && available) {
        const entityId = projectId.toString();
        const key = `REALLOCATE_WORKLOAD:${entityId}:${overburdened.userId}`;

        if (!dismissedSet.has(key)) {
          rawRecommendations.push({
            id: `rec_${projectId}_REALLOCATE_WORKLOAD_${overburdened.userId}`,
            projectId: projectId.toString(),
            ruleType: 'REALLOCATE_WORKLOAD',
            entityId,
            targetUserId: overburdened.userId,
            title: 'Reallocate Project Workload',
            description: `Team member ${overburdened.username} is at ${overburdened.capacityUtilizationPercentage}% capacity utilization while ${available.username} is at ${available.capacityUtilizationPercentage}%.`,
            reason: 'Excessive workload disparity detected across project team members.',
            suggestedAction: `Consider reassigning tasks from ${overburdened.username} to ${available.username} to balance project workload.`,
            confidence: 0.90,
            priority: 'HIGH',
            status: 'ACTIVE',
            createdAt: now.toISOString(),
            isAdvisoryOnly: true
          });
        }
      }
    }
  } catch (err) {
    console.error('Error evaluating REALLOCATE_WORKLOAD rule:', err);
  }

  // Evaluate Task-Level Rules (RULE 2, RULE 3, RULE 4)
  for (const task of activeTasks) {
    try {
      const debtInfo = await calculateTaskDebt(task, { now });
      const entityId = task._id.toString();

      // RULE 2: REBREAKDOWN_STAGNANT_TASK
      const isCriticalDebt = debtInfo && debtInfo.debtScore >= 75;
      const isStagnant5Days = debtInfo && debtInfo.signals && debtInfo.signals.daysStagnant > 5;

      if (isCriticalDebt || isStagnant5Days) {
        const key = `REBREAKDOWN_STAGNANT_TASK:${entityId}:`;
        if (!dismissedSet.has(key)) {
          const reasonMsg = isCriticalDebt
            ? `Task Debt Score is ${debtInfo.debtScore}/100 (CRITICAL).`
            : `Task has been stagnant in ${task.status} status for ${debtInfo.signals.daysStagnant} days.`;

          rawRecommendations.push({
            id: `rec_${projectId}_REBREAKDOWN_STAGNANT_TASK_${entityId}`,
            projectId: projectId.toString(),
            ruleType: 'REBREAKDOWN_STAGNANT_TASK',
            entityId,
            targetUserId: task.assignedTo ? task.assignedTo.toString() : null,
            title: `Review/Rebreakdown Stagnant Task: "${task.title}"`,
            description: `Task "${task.title}" requires attention due to high debt or prolonged stagnation.`,
            reason: reasonMsg,
            suggestedAction: 'Consider breaking this task down into smaller subtasks or updating its scope/status.',
            confidence: 0.85,
            priority: 'HIGH',
            status: 'ACTIVE',
            createdAt: now.toISOString(),
            isAdvisoryOnly: true
          });
        }
      }

      // RULE 3: RESOLVE_BLOCKER
      const isBlocked = task.status === 'BLOCKED';
      const isBlockedOver48h = debtInfo && debtInfo.signals && debtInfo.signals.daysStagnant > 2;

      if (isBlocked && isBlockedOver48h) {
        const key = `RESOLVE_BLOCKER:${entityId}:`;
        if (!dismissedSet.has(key)) {
          rawRecommendations.push({
            id: `rec_${projectId}_RESOLVE_BLOCKER_${entityId}`,
            projectId: projectId.toString(),
            ruleType: 'RESOLVE_BLOCKER',
            entityId,
            targetUserId: task.assignedTo ? task.assignedTo.toString() : null,
            title: `Resolve Blocker for Task: "${task.title}"`,
            description: `Task "${task.title}" has been BLOCKED for ${debtInfo.signals.daysStagnant} days.`,
            reason: 'Task is blocked beyond 48 hours threshold.',
            suggestedAction: 'Follow up on blocker dependencies with project members or unblock task status.',
            confidence: 0.85,
            priority: 'MEDIUM',
            status: 'ACTIVE',
            createdAt: now.toISOString(),
            isAdvisoryOnly: true
          });
        }
      }

      // RULE 4: ADJUST_DUE_DATE
      if (task.dueDate) {
        const diffMs = new Date(task.dueDate).getTime() - now.getTime();
        const hoursRemaining = diffMs / (1000 * 60 * 60);
        const isUrgent = hoursRemaining >= 0 && hoursRemaining < 24;
        const hasHighDebt = debtInfo && debtInfo.debtScore >= 25;

        if (isUrgent && hasHighDebt) {
          const key = `ADJUST_DUE_DATE:${entityId}:`;
          if (!dismissedSet.has(key)) {
            rawRecommendations.push({
              id: `rec_${projectId}_ADJUST_DUE_DATE_${entityId}`,
              projectId: projectId.toString(),
              ruleType: 'ADJUST_DUE_DATE',
              entityId,
              targetUserId: task.assignedTo ? task.assignedTo.toString() : null,
              title: `Review Impending Deadline: "${task.title}"`,
              description: `Task "${task.title}" is due in ${Math.round(hoursRemaining)} hours and has a high Task Debt Score (${debtInfo.debtScore}/100).`,
              reason: 'Deadline is approaching within 24 hours while task accumulated significant debt.',
              suggestedAction: 'Consider adjusting the due date or prioritizing immediate execution.',
              confidence: 0.80,
              priority: 'MEDIUM',
              status: 'ACTIVE',
              createdAt: now.toISOString(),
              isAdvisoryOnly: true
            });
          }
        }
      }
    } catch (err) {
      console.error(`Error evaluating task rules for task ${task._id}:`, err);
    }
  }

  // RULE 5: ARCHIVE_COMPLETED_PROJECT
  if (project.status === 'ACTIVE' && tasks.length > 0 && activeTasks.length === 0) {
    const entityId = projectId.toString();
    const key = `ARCHIVE_COMPLETED_PROJECT:${entityId}:`;

    if (!dismissedSet.has(key)) {
      rawRecommendations.push({
        id: `rec_${projectId}_ARCHIVE_COMPLETED_PROJECT_${entityId}`,
        projectId: projectId.toString(),
        ruleType: 'ARCHIVE_COMPLETED_PROJECT',
        entityId,
        targetUserId: null,
        title: `Archive Completed Project: "${project.name}"`,
        description: `All ${tasks.length} task(s) in project "${project.name}" are 100% completed.`,
        reason: 'Project has reached 100% task completion while remaining in ACTIVE status.',
        suggestedAction: 'Consider updating project status to ARCHIVED or COMPLETED.',
        confidence: 0.95,
        priority: 'LOW',
        status: 'ACTIVE',
        createdAt: now.toISOString(),
        isAdvisoryOnly: true
      });
    }
  }

  return rawRecommendations;
}

/**
 * Dismiss a recommendation by storing a RecommendationState record.
 */
async function dismissRecommendation({ projectId, ruleType, entityId, targetUserId = null, userId }) {
  if (!projectId || !ruleType) {
    throw new Error('projectId and ruleType are required for dismissal');
  }

  const dismissal = await RecommendationState.findOneAndUpdate(
    {
      projectId,
      ruleType,
      entityId: entityId || projectId.toString(),
      targetUserId: targetUserId || null
    },
    {
      projectId,
      ruleType,
      entityId: entityId || projectId.toString(),
      targetUserId: targetUserId || null,
      status: 'DISMISSED',
      dismissedAt: new Date()
    },
    { upsert: true, new: true }
  );

  return dismissal;
}

module.exports = {
  generateProjectRecommendations,
  dismissRecommendation
};
