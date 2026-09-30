const mongoose = require('mongoose');
const ActivityEvent = require('../models/ActivityEvent');
const { logActivityEvent } = require('../services/activityService');

require('./setup');

describe('ActivityEvent Service & Append-Only Store Tests', () => {
  it('should write append-only activity event to database', async () => {
    const actorId = new mongoose.Types.ObjectId();
    const taskId = new mongoose.Types.ObjectId();

    const event = await logActivityEvent({
      eventType: 'TASK_COMPLETED',
      actorId,
      taskId,
      metadata: { rewardGranted: 20 }
    });

    expect(event).toBeDefined();
    expect(event.eventType).toEqual('TASK_COMPLETED');
    expect(event.actorId.toString()).toEqual(actorId.toString());
    expect(event.taskId.toString()).toEqual(taskId.toString());
    expect(event.metadata.rewardGranted).toEqual(20);
    expect(event.createdAt).toBeDefined();
  });

  it('should support querying activity events by eventType and projectId', async () => {
    const actorId = new mongoose.Types.ObjectId();
    const projectId = new mongoose.Types.ObjectId();

    await logActivityEvent({
      eventType: 'PROJECT_CREATED',
      actorId,
      projectId
    });

    await logActivityEvent({
      eventType: 'PROJECT_UPDATED',
      actorId,
      projectId
    });

    const projectEvents = await ActivityEvent.find({ projectId }).sort({ createdAt: 1 });
    expect(projectEvents).toHaveLength(2);
    expect(projectEvents[0].eventType).toEqual('PROJECT_CREATED');
    expect(projectEvents[1].eventType).toEqual('PROJECT_UPDATED');
  });

  it('should ignore errors during activity event logging so core transactions do not crash', async () => {
    // Attempt logging with invalid data format (forcing error handling test)
    const result = await logActivityEvent({
      eventType: null // Invalid eventType violating enum
    });

    // logActivityEvent should catch error silently and return null without throwing
    expect(result).toBeNull();
  });
});
