import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { TaskStatusBadge } from './TaskStatusBadge';
import { TaskPriorityBadge } from './TaskPriorityBadge';
import { SubtaskList } from './SubtaskList';
import { AIDecomposeModal } from '../ai/AIDecomposeModal';
import { AISummarizeWidget } from '../ai/AISummarizeWidget';

/**
 * TaskDetails Component (M4.3)
 * Full modal for viewing task description, comments thread, and subtasks
 */
export const TaskDetails = ({
  isOpen,
  onClose,
  task,
  authAxios,
  onAddComment,
  onToggleComplete,
  onStartFocus,
  teamMembers = [],
  currentUserId,
}) => {
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [aiConsentEnabled, setAiConsentEnabled] = useState(false);
  const [showDecomposeModal, setShowDecomposeModal] = useState(false);
  const [subtaskRefreshKey, setSubtaskRefreshKey] = useState(0);
  const [startingFocus, setStartingFocus] = useState(false);
  const [focusError, setFocusError] = useState(null);

  useEffect(() => {
    if (isOpen && authAxios) {
      authAxios.get('/ai/status')
        .then((res) => setAiConsentEnabled(Boolean(res.data?.userConsentEnabled)))
        .catch(() => setAiConsentEnabled(false));
    }
  }, [isOpen, authAxios]);

  if (!task) return null;

  const {
    _id,
    title,
    description,
    status = 'To Do',
    priority = 'No Priority',
    assignedTo,
    dueDate,
    estimatedMinutes,
    comments = [],
    tags = [],
  } = task;

  const isAssignedToMe = assignedTo && (assignedTo._id === currentUserId || assignedTo.id === currentUserId || assignedTo === currentUserId);
  const assigneeName = assignedTo ? (isAssignedToMe ? 'You' : assignedTo.username || assignedTo.name || 'Assignee') : 'Unassigned';

  const formattedDueDate = dueDate
    ? new Date(dueDate).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  const handleStartFocusClick = async () => {
    const targetTaskId = _id || task.id;
    if (onStartFocus) {
      return onStartFocus(targetTaskId);
    }
    if (!authAxios || !targetTaskId) return;

    setStartingFocus(true);
    setFocusError(null);
    try {
      await authAxios.post('/focus/sessions', { taskId: targetTaskId });
      onClose();
    } catch (err) {
      console.error('Failed to start focus session:', err);
      if (err.response?.status === 409) {
        setFocusError('An active focus session already exists. Complete or cancel it first.');
      } else {
        setFocusError(err.response?.data?.error || 'Failed to start focus session.');
      }
    } finally {
      setStartingFocus(false);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmittingComment(true);
    try {
      await onAddComment(_id || task.id, newComment.trim());
      setNewComment('');
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="600px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        {/* Status & Priority & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TaskStatusBadge status={status} size="md" />
            <TaskPriorityBadge priority={priority} size="md" />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Button variant="outline" size="sm" onClick={handleStartFocusClick} loading={startingFocus}>
              🎯 Start Focus
            </Button>
            <Button variant={status === 'Done' ? 'outline' : 'primary'} size="sm" onClick={() => onToggleComplete && onToggleComplete(task)}>
              {status === 'Done' ? '↩ Reopen Task' : '✅ Mark as Done'}
            </Button>
          </div>
        </div>

        {focusError && (
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger, #ef4444)', padding: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-md)' }}>
            ⚠️ {focusError}
          </div>
        )}

        {/* Metadata Details */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)', fontSize: 'var(--font-size-sm)', backgroundColor: 'var(--color-bg-subtle)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
          <div>👤 Assignee: <strong>{assigneeName}</strong></div>
          {formattedDueDate && <div>🗓️ Due: <strong>{formattedDueDate}</strong></div>}
          {estimatedMinutes > 0 && <div>⏱️ Estimated: <strong>{estimatedMinutes} min</strong></div>}
          {tags.length > 0 && (
            <div>
              🏷️ Tags: {tags.map((t) => `#${t}`).join(', ')}
            </div>
          )}
        </div>

        {/* Description */}
        {description && (
          <div>
            <h5 style={{ fontSize: 'var(--font-size-sm)', fontWeight: '600', marginBottom: '0.25rem' }}>Description</h5>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', margin: 0 }}>
              {description}
            </p>
          </div>
        )}

        {/* AI Summary Widget */}
        <AISummarizeWidget
          task={task}
          authAxios={authAxios}
          userConsentEnabled={aiConsentEnabled}
          onConsentEnable={() => setShowDecomposeModal(true)}
        />

        {/* Subtasks Section */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <h5 style={{ fontSize: 'var(--font-size-sm)', fontWeight: '600', margin: 0 }}>Subtasks</h5>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDecomposeModal(true)}
              style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px' }}
            >
              ✨ AI Subtask Suggestions
            </Button>
          </div>
          <SubtaskList key={subtaskRefreshKey} parentTaskId={_id || task.id} authAxios={authAxios} teamMembers={teamMembers} />
        </div>

        {/* AI Decompose Modal */}
        <AIDecomposeModal
          isOpen={showDecomposeModal}
          onClose={() => setShowDecomposeModal(false)}
          task={task}
          authAxios={authAxios}
          userConsentEnabled={aiConsentEnabled}
          onSubtasksAdded={() => setSubtaskRefreshKey((k) => k + 1)}
          onConsentEnable={async () => {
            try {
              await authAxios.put('/user/preferences/ai', { aiConsent: true });
              setAiConsentEnabled(true);
            } catch (err) {
              console.error('Failed to enable AI consent:', err);
            }
          }}
        />

        {/* Comments Section */}
        <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-md)' }}>
          <h5 style={{ fontSize: 'var(--font-size-sm)', fontWeight: '600', marginBottom: '0.5rem' }}>
            💬 Comments ({comments.length})
          </h5>

          <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {comments.length === 0 ? (
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                No comments yet. Be the first to comment!
              </span>
            ) : (
              comments.map((c, idx) => (
                <div
                  key={c._id || idx}
                  style={{
                    backgroundColor: 'var(--color-bg-subtle)',
                    padding: '0.5rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-size-xs)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                    <span>{c.user?.username || 'User'}</span>
                    <span style={{ color: 'var(--color-text-muted)', fontWeight: 'normal' }}>
                      {c.createdAt ? new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <p style={{ margin: '0.25rem 0 0 0', color: 'var(--color-text-secondary)' }}>{c.content}</p>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleCommentSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
            <Input
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              style={{ minHeight: '36px', fontSize: 'var(--font-size-sm)' }}
            />
            <Button variant="primary" size="sm" type="submit" loading={submittingComment}>
              Send
            </Button>
          </form>
        </div>
      </div>
    </Modal>
  );
};
