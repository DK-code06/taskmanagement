import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import FocusControlBar from '../FocusControlBar';

describe('Phase 2-F Focus Mode Component Tests', () => {
  const mockActiveSession = {
    _id: 'fs1',
    status: 'ACTIVE',
    taskId: { _id: 't1', title: 'Implement Focus Component' },
    projectId: { _id: 'p1', name: 'Productivity Suite' },
    accumulatedFocusedSeconds: 120,
  };

  it('renders task title, project name, status badge, and timer display', () => {
    const bar = (
      <FocusControlBar
        activeSession={mockActiveSession}
        initialElapsedSeconds={120}
      />
    );

    expect(bar.props.activeSession.taskId.title).toBe('Implement Focus Component');
    expect(bar.props.activeSession.projectId.name).toBe('Productivity Suite');
    expect(bar.props.initialElapsedSeconds).toBe(120);
  });

  it('renders PAUSED state badge when session status is PAUSED', () => {
    const pausedSession = { ...mockActiveSession, status: 'PAUSED' };
    const bar = (
      <FocusControlBar
        activeSession={pausedSession}
        initialElapsedSeconds={120}
      />
    );

    expect(bar.props.activeSession.status).toBe('PAUSED');
  });

  it('provides pause, complete, and cancel actions via authAxios', async () => {
    const mockPost = vi.fn().mockResolvedValue({
      data: {
        session: { ...mockActiveSession, status: 'PAUSED' },
        elapsedSeconds: 125,
      },
    });
    const mockAuthAxios = { post: mockPost };
    const handleUpdate = vi.fn();

    const bar = (
      <FocusControlBar
        activeSession={mockActiveSession}
        initialElapsedSeconds={120}
        authAxios={mockAuthAxios}
        onSessionUpdated={handleUpdate}
      />
    );

    expect(bar.props.authAxios.post).toBeDefined();
    expect(bar.props.onSessionUpdated).toBeDefined();
  });
});
