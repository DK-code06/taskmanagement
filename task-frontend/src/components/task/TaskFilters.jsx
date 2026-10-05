import React from 'react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';

/**
 * TaskFilters Component (M4.3)
 * Filter bar for searching, status, priority, and milestone filtering
 */
export const TaskFilters = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  priorityFilter,
  onPriorityChange,
  milestoneFilter,
  onMilestoneChange,
  milestones = [],
  onReset,
}) => {
  return (
    <div
      className="task-filters-bar"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 'var(--space-md)',
        backgroundColor: 'var(--color-surface)',
        padding: 'var(--space-md)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-subtle)',
        alignItems: 'center',
      }}
    >
      <Input
        placeholder="Search tasks..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
      />

      <Select value={statusFilter} onChange={(e) => onStatusChange(e.target.value)}>
        <option value="ALL">All Statuses</option>
        <option value="To Do">To Do</option>
        <option value="In Progress">In Progress</option>
        <option value="Done">Done</option>
      </Select>

      <Select value={priorityFilter} onChange={(e) => onPriorityChange(e.target.value)}>
        <option value="ALL">All Priorities</option>
        <option value="High">High</option>
        <option value="Medium">Medium</option>
        <option value="Low">Low</option>
        <option value="No Priority">No Priority</option>
      </Select>

      {milestones.length > 0 && (
        <Select value={milestoneFilter} onChange={(e) => onMilestoneChange(e.target.value)}>
          <option value="ALL">All Milestones</option>
          {milestones.map((m) => (
            <option key={m._id || m.id} value={m._id || m.id}>
              {m.title}
            </option>
          ))}
        </Select>
      )}

      {onReset && (
        <Button variant="outline" size="sm" onClick={onReset} style={{ height: '44px' }}>
          Reset Filters
        </Button>
      )}
    </div>
  );
};
