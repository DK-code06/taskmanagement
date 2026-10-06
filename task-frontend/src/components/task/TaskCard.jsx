import React, { useState } from 'react';
import { Card, CardHeader, CardBody, CardFooter } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { TaskStatusBadge } from './TaskStatusBadge';
import { TaskPriorityBadge } from './TaskPriorityBadge';
import { SubtaskList } from './SubtaskList';
import { ConfirmDialog } from '../ui/ConfirmDialog';

/**
 * TaskCard Component (M4.3)
 * Comprehensive task card with accessibility, priority, status, subtasks & actions
 */
export const TaskCard = ({
  task,
  onToggleComplete,
  onEdit,
  onDelete,
  onOpenDetails,
  onStartFocus,
  authAxios,
  teamMembers = [],
  currentUserId,
  provided,
  isDragging = false,
}) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    actualMinutes,
    tags = [],
    comments = [],
  } = task;

  const isAssignedToMe = assignedTo && (assignedTo._id === currentUserId || assignedTo.id === currentUserId || assignedTo === currentUserId);
  const assigneeName = assignedTo ? (isAssignedToMe ? 'You' : assignedTo.username || assignedTo.name || 'Assignee') : 'Unassigned';

  const isOverdue = dueDate && status !== 'Done' && new Date(dueDate).getTime() < Date.now();
  const formattedDueDate = dueDate
    ? new Date(dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(_id || task.id, status);
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <div
      ref={provided?.innerRef}
      {...provided?.draggableProps}
      {...provided?.dragHandleProps}
      className={`task-card-wrapper ${isDragging ? 'is-dragging' : ''}`}
      style={{
        userSelect: 'none',
        marginBottom: '0.75rem',
        ...provided?.draggableProps?.style,
      }}
    >
      <Card variant="default" className="task-card" style={{ borderLeft: isOverdue ? '4px solid var(--color-danger)' : '1px solid var(--color-border)' }}>
        <CardHeader style={{ padding: '0.75rem 1rem', paddingBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', width: '100%', minWidth: 0 }}>
            {/* Completion Checkbox */}
            <input
              type="checkbox"
              checked={status === 'Done'}
              onChange={() => onToggleComplete && onToggleComplete(task)}
              aria-label={`Mark task ${title} as ${status === 'Done' ? 'incomplete' : 'done'}`}
              style={{ width: '20px', height: '20px', marginTop: '2px', cursor: 'pointer', accentColor: 'var(--color-primary)' }}
            />

            <div style={{ flexGrow: 1, minWidth: 0 }}>
              <h4
                style={{
                  fontSize: 'var(--font-size-md)',
                  fontWeight: '600',
                  color: 'var(--color-text-primary)',
                  margin: 0,
                  textDecoration: status === 'Done' ? 'line-through' : 'none',
                  wordBreak: 'break-word',
                }}
              >
                {title}
              </h4>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap', marginTop: '0.375rem' }}>
                <TaskPriorityBadge priority={priority} size="sm" />
                <TaskStatusBadge status={status} size="sm" />
                {isAssignedToMe && (
                  <Badge variant="primary" size="sm">
                    Assigned to You
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardBody style={{ padding: '0.5rem 1rem 0.75rem 1rem' }}>
          {description && (
            <p
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                margin: '0 0 0.5rem 0',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {description}
            </p>
          )}

          {/* Task Metadata */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            <span>👤 {assigneeName}</span>
            {formattedDueDate && (
              <span style={{ color: isOverdue ? 'var(--color-danger)' : 'inherit', fontWeight: isOverdue ? '600' : 'normal' }}>
                🗓️ {formattedDueDate} {isOverdue && '(Overdue)'}
              </span>
            )}
            {estimatedMinutes > 0 && <span>⏱️ {estimatedMinutes} min</span>}
          </div>

          {/* SubtaskList */}
          <SubtaskList parentTaskId={_id || task.id} authAxios={authAxios} teamMembers={teamMembers} />
        </CardBody>

        <CardFooter style={{ padding: '0.5rem 1rem', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {onOpenDetails && (
              <Button variant="ghost" size="sm" onClick={() => onOpenDetails(task)} aria-label={`View comments for ${title}`}>
                💬 {comments.length || 0}
              </Button>
            )}
            {onStartFocus && (
              <Button variant="ghost" size="sm" onClick={() => onStartFocus(_id || task.id)} aria-label={`Start focus on ${title}`}>
                🎯 Focus
              </Button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                aria-label={`Edit task ${title}`}
                onClick={() => onEdit(task)}
              >
                ✏️
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                aria-label={`Delete task ${title}`}
                onClick={() => setDeleteDialogOpen(true)}
              >
                🗑️
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Task?"
        description={`Are you sure you want to delete "${title}"? This cannot be undone.`}
        confirmText="Delete Task"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
};
