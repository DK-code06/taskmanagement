import React from 'react';
import { Progress } from '../ui/Progress';

/**
 * TaskProgress Component (M4.3)
 * Displays subtask progress or timer progress
 */
export const TaskProgress = ({ completedSubtasks = 0, totalSubtasks = 0, size = 'sm', showLabel = true }) => {
  if (totalSubtasks === 0) return null;

  const percentage = (completedSubtasks / totalSubtasks) * 100;
  const variant = percentage === 100 ? 'success' : 'primary';

  return (
    <div style={{ width: '100%' }}>
      {showLabel && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-muted)',
            marginBottom: '0.25rem',
          }}
        >
          <span>Subtasks</span>
          <span>{completedSubtasks}/{totalSubtasks} ({Math.round(percentage)}%)</span>
        </div>
      )}
      <Progress value={completedSubtasks} max={totalSubtasks} variant={variant} size={size} />
    </div>
  );
};
