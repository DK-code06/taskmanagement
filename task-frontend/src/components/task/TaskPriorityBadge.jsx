import React from 'react';
import { Badge } from '../ui/Badge';

/**
 * TaskPriorityBadge Component (M4.3)
 * Renders priority for Task ("High", "Medium", "Low", "No Priority")
 */
export const TaskPriorityBadge = ({ priority = 'No Priority', size = 'sm' }) => {
  const priorityMap = {
    High: { variant: 'danger', label: '🔥 High' },
    Medium: { variant: 'warning', label: '⚡ Medium' },
    Low: { variant: 'success', label: '🌱 Low' },
    'No Priority': { variant: 'neutral', label: 'No Priority' },
  };

  const current = priorityMap[priority] || priorityMap['No Priority'];

  return (
    <Badge variant={current.variant} size={size}>
      {current.label}
    </Badge>
  );
};
