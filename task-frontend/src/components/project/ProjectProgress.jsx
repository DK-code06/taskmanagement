import React from 'react';
import { Progress } from '../ui/Progress';

/**
 * ProjectProgress Component (M4.2)
 * Deterministically calculates progress based on actual completed / total tasks
 */
export const ProjectProgress = ({ completedTasks = 0, totalTasks = 0, size = 'md', showLabel = true }) => {
  const percentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  const variant = percentage === 100 ? 'success' : percentage > 50 ? 'primary' : 'warning';

  return (
    <div style={{ width: '100%' }}>
      {showLabel && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-secondary)',
            marginBottom: '0.25rem',
            fontWeight: '500',
          }}
        >
          <span>Progress ({completedTasks}/{totalTasks} tasks)</span>
          <span>{Math.round(percentage)}%</span>
        </div>
      )}
      <Progress value={completedTasks} max={totalTasks > 0 ? totalTasks : 1} variant={variant} size={size} />
    </div>
  );
};
