import React from 'react';
import { Badge } from '../ui/Badge';

/**
 * ProjectStatusBadge Component (M4.2)
 * Renders status for Project (ACTIVE, COMPLETED, ARCHIVED)
 */
export const ProjectStatusBadge = ({ status = 'ACTIVE', size = 'md' }) => {
  const statusMap = {
    ACTIVE: { variant: 'primary', label: 'Active', dot: true },
    COMPLETED: { variant: 'success', label: 'Completed', dot: true },
    ARCHIVED: { variant: 'neutral', label: 'Archived', dot: false },
  };

  const current = statusMap[status] || statusMap.ACTIVE;

  return (
    <Badge variant={current.variant} size={size} dot={current.dot}>
      {current.label}
    </Badge>
  );
};
