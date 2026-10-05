import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { TaskStatusBadge } from './TaskStatusBadge';
import { TaskPriorityBadge } from './TaskPriorityBadge';
import { SubtaskList } from './SubtaskList';

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
  teamMembers = [],
  currentUserId,
}) => {
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

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
        {/* Status & Priority */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TaskStatusBadge status={status} size="md" />
            <TaskPriorityBadge priority={priority} size="md" />
          </div>

          <Button variant={status === 'Done' ? 'outline' : 'primary'} size="sm" onClick={() => onToggleComplete && onToggleComplete(task)}>
            {status === 'Done' ? '↩ Reopen Task' : '✅ Mark as Done'}
          </Button>
        </div>

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

        {/* Subtasks Section */}
        <div>
          <h5 style={{ fontSize: 'var(--font-size-sm)', fontWeight: '600', marginBottom: '0.25rem' }}>Subtasks</h5>
          <SubtaskList parentTaskId={_id || task.id} authAxios={authAxios} teamMembers={teamMembers} />
        </div>

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
