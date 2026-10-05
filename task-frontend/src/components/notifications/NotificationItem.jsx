import React from 'react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

/**
 * NotificationItem Component (M4.4)
 * Renders an individual notification with type icon, actor info, entity context, timestamp, and mark-read action
 */
export const NotificationItem = ({ notification, onMarkRead }) => {
  if (!notification) return null;

  const { _id, type, title, message, read, createdAt, actor, projectId, taskId } = notification;

  const typeIcons = {
    taskReminders: '⏰',
    taskAssignment: '📋',
    taskCompletion: '✅',
    projectActivity: '📁',
    teamActivity: '👥',
    friendActivity: '🤝',
    chatMessages: '💬',
    systemSecurity: '🔐',
  };

  const icon = typeIcons[type] || '🔔';
  const formattedTime = createdAt
    ? new Date(createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div
      className={`notification-item ${read ? 'read' : 'unread'}`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        borderRadius: 'var(--radius-md)',
        backgroundColor: read ? 'var(--color-surface)' : 'var(--color-primary-light)',
        border: `1px solid ${read ? 'var(--color-border-subtle)' : 'var(--color-primary-border)'}`,
        transition: 'background-color var(--transition-fast)',
      }}
    >
      <span style={{ fontSize: '1.25rem', lineHeight: 1 }} aria-hidden="true">
        {icon}
      </span>

      <div style={{ flexGrow: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
            {title || (actor?.username ? `${actor.username}` : 'System Notification')}
          </strong>

          {!read && (
            <Badge variant="primary" size="sm">
              New
            </Badge>
          )}
        </div>

        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0' }}>
          {message}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          <span>{formattedTime}</span>

          {projectId && <span>📁 {projectId.name || 'Project'}</span>}
          {taskId && <span>📋 {taskId.title || 'Task'}</span>}
        </div>
      </div>

      {!read && onMarkRead && (
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          aria-label="Mark notification as read"
          onClick={() => onMarkRead(_id)}
          style={{ minHeight: '24px', minWidth: '24px', padding: '0' }}
        >
          ✓
        </Button>
      )}
    </div>
  );
};
