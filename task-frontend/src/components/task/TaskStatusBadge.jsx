import React from 'react';
import { Badge } from '../ui/Badge';

/**
 * TaskStatusBadge Component (M4.3)
 * Renders status for Task/Subtask ("To Do", "In Progress", "Done")
 */
export const TaskStatusBadge = ({ status = 'To Do', size = 'sm' }) => {
  const statusMap = {
    'To Do': { variant: 'neutral', label: 'To Do', dot: false },
    'In Progress': { variant: 'warning', label: 'In Progress', dot: true },
    Done: { variant: 'success', label: 'Done', dot: true },
  };

  const current = statusMap[status] || statusMap['To Do'];

  return (
    <Badge variant={current.variant} size={size} dot={current.dot}>
      {current.label}
    </Badge>
  );
};
