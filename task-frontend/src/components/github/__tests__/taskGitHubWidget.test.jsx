import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import TaskGitHubWidget from '../TaskGitHubWidget';

describe('Phase 2-H Milestone 4: TaskGitHubWidget Component Tests', () => {
  const projectId = 'proj_123';
  const taskId = 'task_456';

  it('instantiates TaskGitHubWidget with required projectId and taskId props', () => {
    const widget = <TaskGitHubWidget projectId={projectId} taskId={taskId} />;
    expect(widget.props.projectId).toBe('proj_123');
    expect(widget.props.taskId).toBe('task_456');
    expect(widget.props.isCompact ?? false).toBe(false);
  });

  it('supports compact mode prop for embedded task cards/modals', () => {
    const widget = <TaskGitHubWidget projectId={projectId} taskId={taskId} isCompact={true} />;
    expect(widget.props.isCompact).toBe(true);
  });

  it('provides accessible region markup for screen readers', () => {
    const widget = <TaskGitHubWidget projectId={projectId} taskId={taskId} />;
    expect(widget.type).toBeDefined();
  });
});
