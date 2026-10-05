const ActivityEvent = require("../models/ActivityEvent");

/**
 * Record an immutable activity event in the system.
 */
async function logActivityEvent({ eventType, actorId, projectId = null, milestoneId = null, taskId = null, metadata = {} }) {
  try {
    const event = await ActivityEvent.create({
      eventType,
      actorId,
      projectId,
      milestoneId,
      taskId,
      metadata
    });
    return event;
  } catch (err) {
    console.error(`❌ Failed to log ActivityEvent (${eventType}):`, err.message);
    return null;
  }
}

/**
 * Retrieve activity events for a project with date-range, eventType, and pagination options.
 */
async function getActivitySummary({ projectId, startDate = null, endDate = null, eventTypes = null, limit = 100 }) {
  if (!projectId) return [];

  const query = { projectId };

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  if (Array.isArray(eventTypes) && eventTypes.length > 0) {
    query.eventType = { $in: eventTypes };
  }

  return ActivityEvent.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("actorId", "username");
}

/**
 * Compute deterministic activity metrics for a project over a configurable time window.
 */
async function getProjectActivityMetrics({ projectId, timeWindowDays = 30 }) {
  if (!projectId) return null;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeWindowDays);

  const query = {
    projectId,
    createdAt: { $gte: startDate }
  };

  const events = await ActivityEvent.find(query).sort({ createdAt: -1 });

  const metrics = {
    totalEvents: events.length,
    tasksCreated: 0,
    tasksCompleted: 0,
    tasksReopened: 0,
    tasksAssigned: 0,
    subtasksCreated: 0,
    subtasksCompleted: 0,
    milestonesCompleted: 0,
    statusChanges: 0,
    dueDateChanges: 0,
    byEventType: {},
    activeActors: []
  };

  const actorSet = new Set();

  events.forEach((evt) => {
    const et = evt.eventType;
    metrics.byEventType[et] = (metrics.byEventType[et] || 0) + 1;

    if (evt.actorId) {
      actorSet.add(evt.actorId.toString());
    }

    switch (et) {
      case "TASK_CREATED":
        metrics.tasksCreated++;
        break;
      case "TASK_COMPLETED":
        metrics.tasksCompleted++;
        break;
      case "TASK_REOPENED":
        metrics.tasksReopened++;
        break;
      case "TASK_ASSIGNED":
        metrics.tasksAssigned++;
        break;
      case "SUBTASK_CREATED":
        metrics.subtasksCreated++;
        break;
      case "SUBTASK_COMPLETED":
        metrics.subtasksCompleted++;
        break;
      case "MILESTONE_COMPLETED":
        metrics.milestonesCompleted++;
        break;
      case "TASK_STATUS_CHANGED":
        metrics.statusChanges++;
        break;
      case "TASK_DUE_DATE_CHANGED":
        metrics.dueDateChanges++;
        break;
      default:
        break;
    }
  });

  metrics.activeActors = Array.from(actorSet);

  return metrics;
}

module.exports = {
  logActivityEvent,
  getActivitySummary,
  getProjectActivityMetrics
};
