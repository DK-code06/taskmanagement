import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { TaskCard } from './TaskCard';
import { TaskFormModal } from './TaskFormModal';
import { TaskDetails } from './TaskDetails';
import { TaskFilters } from './TaskFilters';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { EmptyState } from '../ui/EmptyState';

/**
 * KanbanBoard Component (M4.3)
 * Project/Milestone-aware responsive Kanban Board with drag-and-drop
 */
export const KanbanBoard = ({
  tasks = [],
  projects = [],
  milestones = [],
  teamMembers = [],
  currentUserId,
  currentProjectId,
  currentMilestoneId,
  authAxios,
  onTaskUpdate,
  onTaskCreate,
  onTaskDelete,
  onAddComment,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [milestoneFilter, setMilestoneFilter] = useState('ALL');

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [detailTask, setDetailTask] = useState(null);

  // Estimation Modal for moving to In Progress
  const [estimateModalOpen, setEstimateModalOpen] = useState(false);
  const [pendingDrag, setPendingDrag] = useState(null);
  const [estimatedTime, setEstimatedTime] = useState('');

  const statuses = ['To Do', 'In Progress', 'Done'];

  // Client-side task filtering
  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      !searchQuery.trim() ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    const matchesPriority = priorityFilter === 'ALL' || t.priority === priorityFilter;

    const taskMilestoneId = t.milestoneId?._id || t.milestoneId || t.milestone;
    const matchesMilestone = milestoneFilter === 'ALL' || taskMilestoneId === milestoneFilter;

    return matchesSearch && matchesStatus && matchesPriority && matchesMilestone;
  });

  // Toggle Complete (To Do / In Progress <-> Done)
  const handleToggleComplete = async (task) => {
    const nextStatus = task.status === 'Done' ? 'To Do' : 'Done';
    try {
      await onTaskUpdate(task._id || task.id, { status: nextStatus });
    } catch (err) {
      console.error('Failed to toggle completion:', err);
    }
  };

  // Drag and Drop Handler
  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const movedTask = tasks.find((t) => (t._id || t.id) === draggableId);
    if (!movedTask || movedTask.status === 'Done') return;

    const destStatus = destination.droppableId; // 'To Do' | 'In Progress' | 'Done'

    if (destStatus === 'In Progress' && movedTask.status !== 'In Progress') {
      setPendingDrag({ draggableId, destStatus });
      setEstimateModalOpen(true);
    } else {
      try {
        await onTaskUpdate(draggableId, { status: destStatus });
      } catch (err) {
        console.error('Failed to move task:', err);
      }
    }
  };

  const handleEstimateSubmit = async (e) => {
    e.preventDefault();
    if (!pendingDrag) return;

    const minutes = Number(estimatedTime) || 0;
    const { draggableId, destStatus } = pendingDrag;

    setEstimateModalOpen(false);
    setPendingDrag(null);
    setEstimatedTime('');

    try {
      await onTaskUpdate(draggableId, {
        status: destStatus,
        startedAt: new Date().toISOString(),
        estimatedCompletionTime: minutes,
      });
    } catch (err) {
      console.error('Failed to set estimation:', err);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setPriorityFilter('ALL');
    setMilestoneFilter('ALL');
  };

  return (
    <div className="kanban-board-container" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)', width: '100%' }}>
      {/* Filter Controls Bar */}
      <TaskFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        priorityFilter={priorityFilter}
        onPriorityChange={setPriorityFilter}
        milestoneFilter={milestoneFilter}
        onMilestoneChange={setMilestoneFilter}
        milestones={milestones}
        onReset={handleResetFilters}
      />

      {/* Header with Create Action */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 'var(--font-size-xl)', fontWeight: '600', color: 'var(--color-text-primary)', margin: 0 }}>
          📋 Kanban Task Board ({filteredTasks.length} tasks)
        </h3>

        <Button variant="primary" size="sm" onClick={() => setCreateModalOpen(true)}>
          + Create Task
        </Button>
      </div>

      {/* Drag Drop Kanban Columns */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div
          className="kanban-columns-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 'var(--space-lg)',
            alignItems: 'start',
          }}
        >
          {statuses.map((statusKey) => {
            const columnTasks = filteredTasks.filter((t) => t.status === statusKey);

            return (
              <Droppable key={statusKey} droppableId={statusKey}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`kanban-column ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                    style={{
                      backgroundColor: snapshot.isDraggingOver ? 'var(--color-primary-light)' : 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-lg)',
                      padding: 'var(--space-md)',
                      minHeight: '400px',
                      border: '1px solid var(--color-border)',
                      transition: 'background-color var(--transition-fast)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
                      <h4 style={{ fontSize: 'var(--font-size-md)', fontWeight: '600', color: 'var(--color-text-primary)', margin: 0 }}>
                        {statusKey}
                      </h4>
                      <span
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: '600',
                          color: 'var(--color-text-muted)',
                          backgroundColor: 'var(--color-surface)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-full)',
                        }}
                      >
                        {columnTasks.length}
                      </span>
                    </div>

                    {columnTasks.length === 0 ? (
                      <div style={{ padding: 'var(--space-lg)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                        No tasks in {statusKey}
                      </div>
                    ) : (
                      columnTasks.map((task, index) => (
                        <Draggable key={task._id || task.id} draggableId={task._id || task.id} index={index}>
                          {(provided, snapshot) => (
                            <TaskCard
                              task={task}
                              provided={provided}
                              isDragging={snapshot.isDragging}
                              onToggleComplete={handleToggleComplete}
                              onEdit={(t) => setEditingTask(t)}
                              onDelete={onTaskDelete}
                              onOpenDetails={(t) => setDetailTask(t)}
                              authAxios={authAxios}
                              teamMembers={teamMembers}
                              currentUserId={currentUserId}
                            />
                          )}
                        </Draggable>
                      ))
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>

      {/* Task Creation Modal */}
      <TaskFormModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={onTaskCreate}
        projects={projects}
        milestones={milestones}
        teamMembers={teamMembers}
        currentProjectId={currentProjectId}
        currentMilestoneId={currentMilestoneId}
      />

      {/* Task Edit Modal */}
      {editingTask && (
        <TaskFormModal
          isOpen={Boolean(editingTask)}
          onClose={() => setEditingTask(null)}
          onSubmit={(payload, id) => onTaskUpdate(id, payload)}
          initialData={editingTask}
          projects={projects}
          milestones={milestones}
          teamMembers={teamMembers}
          currentProjectId={currentProjectId}
          currentMilestoneId={currentMilestoneId}
        />
      )}

      {/* Task Details Modal */}
      {detailTask && (
        <TaskDetails
          isOpen={Boolean(detailTask)}
          onClose={() => setDetailTask(null)}
          task={detailTask}
          authAxios={authAxios}
          onAddComment={onAddComment}
          onToggleComplete={handleToggleComplete}
          teamMembers={teamMembers}
          currentUserId={currentUserId}
        />
      )}

      {/* Estimation Modal */}
      <Modal
        isOpen={estimateModalOpen}
        onClose={() => {
          setEstimateModalOpen(false);
          setPendingDrag(null);
        }}
        title="Set Task Duration Estimate"
        description="How many minutes do you estimate this task will take?"
        maxWidth="400px"
      >
        <form onSubmit={handleEstimateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <Input
            label="Estimated Minutes"
            type="number"
            placeholder="e.g. 45"
            value={estimatedTime}
            onChange={(e) => setEstimatedTime(e.target.value)}
            required
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setEstimateModalOpen(false);
                setPendingDrag(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Start Timer & Move
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
