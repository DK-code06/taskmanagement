import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

/**
 * Format seconds into mm:ss or hh:mm:ss string
 */
function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  const pad = (n) => String(n).padStart(2, '0');
  if (hrs > 0) {
    return `${hrs}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * FocusControlBar Component (Phase 2-F)
 * Floating/docked control bar displayed globally when a user has an active or paused focus session.
 */
export const FocusControlBar = ({
  activeSession,
  initialElapsedSeconds = 0,
  authAxios,
  onSessionUpdated,
}) => {
  const [elapsed, setElapsed] = useState(initialElapsedSeconds);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  const isPaused = activeSession?.status === 'PAUSED';

  // Local ticker for live UI timer display
  useEffect(() => {
    setElapsed(initialElapsedSeconds);
  }, [initialElapsedSeconds, activeSession?._id, activeSession?.status]);

  useEffect(() => {
    if (!activeSession || isPaused) return;

    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession?._id, isPaused]);

  if (!activeSession) return null;

  const sessionId = activeSession._id;
  const taskTitle = activeSession.taskId?.title || 'Active Task';
  const projectName = activeSession.projectId?.name || activeSession.taskId?.projectId?.name;

  const handlePause = async () => {
    if (!authAxios || !sessionId) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await authAxios.post(`/focus/sessions/${sessionId}/pause`);
      if (onSessionUpdated) onSessionUpdated(res.data.session, res.data.elapsedSeconds);
    } catch (err) {
      console.error('Failed to pause focus session:', err);
      setError('Failed to pause session.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    if (!authAxios || !sessionId) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await authAxios.post(`/focus/sessions/${sessionId}/resume`);
      if (onSessionUpdated) onSessionUpdated(res.data.session, res.data.elapsedSeconds);
    } catch (err) {
      console.error('Failed to resume focus session:', err);
      setError('Failed to resume session.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!authAxios || !sessionId) return;
    setActionLoading(true);
    setError(null);
    try {
      await authAxios.post(`/focus/sessions/${sessionId}/complete`);
      if (onSessionUpdated) onSessionUpdated(null, 0);
    } catch (err) {
      console.error('Failed to complete focus session:', err);
      setError('Failed to complete session.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!authAxios || !sessionId) return;
    setActionLoading(true);
    setError(null);
    try {
      await authAxios.post(`/focus/sessions/${sessionId}/cancel`);
      if (onSessionUpdated) onSessionUpdated(null, 0);
    } catch (err) {
      console.error('Failed to cancel focus session:', err);
      setError('Failed to cancel session.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div
      className="focus-control-bar"
      role="region"
      aria-label="Active Focus Session Control"
      style={{
        position: 'fixed',
        bottom: '1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        backgroundColor: 'var(--color-surface, #ffffff)',
        color: 'var(--color-text-primary, #1e293b)',
        border: '1.5px solid var(--color-primary, #3b82f6)',
        borderRadius: 'var(--radius-lg, 12px)',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        padding: '0.625rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        maxWidth: 'calc(100vw - 2rem)',
        width: 'auto',
        minWidth: '300px',
        flexWrap: 'wrap',
      }}
    >
      {/* Session Title & Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexGrow: 1, minWidth: '160px' }}>
        <span style={{ fontSize: '1.25rem' }}>🎯</span>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                fontWeight: '700',
                fontSize: 'var(--font-size-sm, 14px)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '200px',
              }}
              title={taskTitle}
            >
              {taskTitle}
            </span>
            <Badge variant={isPaused ? 'warning' : 'success'} size="sm">
              {isPaused ? 'PAUSED' : 'FOCUSING'}
            </Badge>
          </div>
          {projectName && (
            <span style={{ fontSize: 'var(--font-size-xs, 12px)', color: 'var(--color-text-muted, #64748b)' }}>
              📁 {projectName}
            </span>
          )}
        </div>
      </div>

      {/* Timer Display */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          fontFamily: 'monospace',
          fontSize: '1.35rem',
          fontWeight: '700',
          color: isPaused ? 'var(--color-text-muted, #64748b)' : 'var(--color-primary, #3b82f6)',
          letterSpacing: '1px',
          minWidth: '80px',
          textAlign: 'center',
        }}
      >
        {formatTime(elapsed)}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
        {isPaused ? (
          <Button
            variant="primary"
            size="sm"
            onClick={handleResume}
            loading={actionLoading}
            aria-label="Resume Focus Session"
          >
            ▶ Resume
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={handlePause}
            loading={actionLoading}
            aria-label="Pause Focus Session"
          >
            ⏸ Pause
          </Button>
        )}

        <Button
          variant="primary"
          size="sm"
          onClick={handleComplete}
          loading={actionLoading}
          aria-label="Complete Focus Session"
          style={{ backgroundColor: 'var(--color-success, #10b981)', borderColor: 'var(--color-success, #10b981)' }}
        >
          ✅ Complete
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          loading={actionLoading}
          aria-label="Cancel Focus Session"
          style={{ color: 'var(--color-danger, #ef4444)', padding: '0 6px' }}
        >
          ✕
        </Button>
      </div>

      {error && (
        <div style={{ width: '100%', fontSize: 'var(--font-size-xs, 12px)', color: 'var(--color-danger, #ef4444)', marginTop: '-4px' }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  );
};

export default FocusControlBar;
