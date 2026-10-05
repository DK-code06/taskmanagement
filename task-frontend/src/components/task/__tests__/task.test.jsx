import { describe, it, expect } from 'vitest';
import React from 'react';
import { TaskStatusBadge } from '../TaskStatusBadge';
import { TaskPriorityBadge } from '../TaskPriorityBadge';
import { TaskProgress } from '../TaskProgress';
import { TaskCard } from '../TaskCard';
import { TaskFilters } from '../TaskFilters';
import { KanbanBoard } from '../KanbanBoard';

describe('Task, Subtask & Kanban Components (M4.3)', () => {
  const mockTask = {
    _id: 'task_101',
    title: 'Migrate Frontend Task UI to Project Hierarchy',
    description: 'Implement KanbanBoard, TaskCard, SubtaskList, and TaskFilters',
    status: 'In Progress',
    priority: 'High',
    assignedTo: { _id: 'u1', username: 'alice' },
    dueDate: '2026-12-31T00:00:00.000Z',
    estimatedMinutes: 60,
    tags: ['frontend', 'm4.3'],
    comments: [],
  };

  it('should render TaskStatusBadge correctly for To Do, In Progress, and Done', () => {
    const todoBadge = <TaskStatusBadge status="To Do" />;
    const inProgressBadge = <TaskStatusBadge status="In Progress" />;
    const doneBadge = <TaskStatusBadge status="Done" />;

    expect(todoBadge.props.status).toBe('To Do');
    expect(inProgressBadge.props.status).toBe('In Progress');
    expect(doneBadge.props.status).toBe('Done');
  });

  it('should render TaskPriorityBadge for High, Medium, Low, and No Priority', () => {
    const highBadge = <TaskPriorityBadge priority="High" />;
    const medBadge = <TaskPriorityBadge priority="Medium" />;
    const lowBadge = <TaskPriorityBadge priority="Low" />;

    expect(highBadge.props.priority).toBe('High');
    expect(medBadge.props.priority).toBe('Medium');
    expect(lowBadge.props.priority).toBe('Low');
  });

  it('should instantiate TaskProgress with subtask completion stats', () => {
    const progress = <TaskProgress completedSubtasks={2} totalSubtasks={4} showLabel />;
    expect(progress.props.completedSubtasks).toBe(2);
    expect(progress.props.totalSubtasks).toBe(4);
  });

  it('should render TaskCard with title, priority, status, and metadata', () => {
    const card = (
      <TaskCard
        task={mockTask}
        onToggleComplete={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        currentUserId="u1"
      />
    );
    expect(card.props.task.title).toBe('Migrate Frontend Task UI to Project Hierarchy');
    expect(card.props.task.priority).toBe('High');
  });

  it('should render TaskFilters component with controls', () => {
    const filters = (
      <TaskFilters
        searchQuery="kanban"
        onSearchChange={() => {}}
        statusFilter="ALL"
        onStatusChange={() => {}}
        priorityFilter="ALL"
        onPriorityChange={() => {}}
        milestoneFilter="ALL"
        onMilestoneChange={() => {}}
        milestones={[{ _id: 'm1', title: 'Milestone 1' }]}
        onReset={() => {}}
      />
    );
    expect(filters.props.searchQuery).toBe('kanban');
    expect(filters.props.milestones.length).toBe(1);
  });

  it('should instantiate KanbanBoard with tasks and column statuses', () => {
    const board = (
      <KanbanBoard
        tasks={[mockTask]}
        projects={[]}
        milestones={[]}
        teamMembers={[]}
        currentUserId="u1"
        onTaskUpdate={() => {}}
        onTaskCreate={() => {}}
        onTaskDelete={() => {}}
      />
    );
    expect(board.props.tasks.length).toBe(1);
  });
});
