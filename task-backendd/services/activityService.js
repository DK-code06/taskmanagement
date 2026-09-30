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

module.exports = { logActivityEvent };
