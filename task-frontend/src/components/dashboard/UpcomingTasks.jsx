import React from 'react';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { TaskCard } from '../task/TaskCard';
import { EmptyState } from '../ui/EmptyState';

/**
 * UpcomingTasks Component (M4.5-B)
 * Displays upcoming and active tasks requiring user focus.
 */
export const UpcomingTasks = ({ tasks = [], onToggleComplete, onEdit, onDelete, currentUserId }) => {
  const activeTasks = tasks
    .filter((t) => !t.completed && t.status !== 'Done')
    .slice(0, 5);

  return (
    <Card className="upcoming-tasks-card">
      <CardHeader>
        <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          📋 Upcoming & Active Tasks
        </h3>
      </CardHeader>

      <CardBody>
        {activeTasks.length === 0 ? (
          <EmptyState title="All Caught Up!" description="No upcoming or pending tasks found." icon="✅" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {activeTasks.map((t) => (
              <TaskCard
                key={t._id}
                task={t}
                onToggleComplete={onToggleComplete}
                onEdit={onEdit}
                onDelete={onDelete}
                currentUserId={currentUserId}
              />
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
};
