import React, { useState, useEffect } from 'react';
import { TaskStatusBadge } from './TaskStatusBadge';
import { TaskPriorityBadge } from './TaskPriorityBadge';
import { TaskProgress } from './TaskProgress';
import { SubtaskForm } from './SubtaskForm';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Spinner } from '../ui/Spinner';

/**
 * SubtaskList Component (M4.3)
 * Full subtask expansion, creation, completion toggle, and deletion
 */
export const SubtaskList = ({
  parentTaskId,
  authAxios,
  teamMembers = [],
  onSubtaskChange,
}) => {
  const [subtasks, setSubtasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingSubtaskId, setDeletingSubtaskId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchSubtasks = async () => {
    if (!parentTaskId || !authAxios) return;
    setLoading(true);
    try {
      const res = await authAxios.get(`/tasks/${parentTaskId}/subtasks`);
      setSubtasks(res.data || []);
    } catch (err) {
      console.error(`Failed to fetch subtasks for task ${parentTaskId}:`, err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (expanded) {
      fetchSubtasks();
    }
  }, [expanded, parentTaskId]);

  const handleToggleExpand = () => {
    setExpanded((prev) => !prev);
  };

  const handleCreateSubtask = async (payload) => {
    try {
      await authAxios.post(`/tasks/${parentTaskId}/subtasks`, payload);
      await fetchSubtasks();
      setShowAddForm(false);
      if (onSubtaskChange) onSubtaskChange();
    } catch (err) {
      console.error('Failed to create subtask:', err);
      throw err;
    }
  };

  const handleToggleSubtaskComplete = async (st) => {
    const nextStatus = st.status === 'Done' ? 'To Do' : 'Done';
    try {
      await authAxios.put(`/tasks/${st._id}`, { status: nextStatus });
      await fetchSubtasks();
      if (onSubtaskChange) onSubtaskChange();
    } catch (err) {
      console.error('Failed to update subtask status:', err);
    }
  };

  const handleConfirmDeleteSubtask = async () => {
    if (!deletingSubtaskId) return;
    setDeleting(true);
    try {
      await authAxios.delete(`/tasks/${deletingSubtaskId}`);
      await fetchSubtasks();
      if (onSubtaskChange) onSubtaskChange();
    } catch (err) {
      console.error('Failed to delete subtask:', err);
    } finally {
      setDeleting(false);
      setDeletingSubtaskId(null);
    }
  };

  const completedCount = subtasks.filter((s) => s.status === 'Done').length;

  return (
    <div className="subtask-list-section" style={{ marginTop: '0.5rem', width: '100%' }}>
      {/* Header & Expand Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          type="button"
          onClick={handleToggleExpand}
          aria-expanded={expanded}
          style={{
            background: 'none',
            border: 'none',
            padding: '2px 4px',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-primary)',
            cursor: 'pointer',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>{expanded ? '▼' : '▶'} Subtasks</span>
          {subtasks.length > 0 && <span>({completedCount}/{subtasks.length})</span>}
        </button>

        {expanded && !showAddForm && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAddForm(true)}
            style={{ padding: '2px 6px', fontSize: 'var(--font-size-xs)', minHeight: '24px' }}
          >
            + Add Subtask
          </Button>
        )}
      </div>

      {subtasks.length > 0 && <TaskProgress completedSubtasks={completedCount} totalSubtasks={subtasks.length} showLabel={false} />}

      {/* Expanded Subtask Items */}
      {expanded && (
        <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.375rem', paddingLeft: '0.5rem', borderLeft: '2px solid var(--color-border-subtle)' }}>
          {loading ? (
            <Spinner size="sm" label="Loading subtasks..." />
          ) : subtasks.length === 0 ? (
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              No subtasks. Click "+ Add Subtask" to create one.
            </span>
          ) : (
            subtasks.map((st) => (
              <div
                key={st._id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  fontSize: 'var(--font-size-xs)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexGrow: 1, minWidth: 0 }}>
                  <input
                    type="checkbox"
                    checked={st.status === 'Done'}
                    onChange={() => handleToggleSubtaskComplete(st)}
                    aria-label={`Mark subtask ${st.title} as ${st.status === 'Done' ? 'incomplete' : 'done'}`}
                    style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                  />
                  <span
                    style={{
                      fontWeight: '500',
                      textDecoration: st.status === 'Done' ? 'line-through' : 'none',
                      color: st.status === 'Done' ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {st.title}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {st.assignedTo ? (
                    <span style={{ color: 'var(--color-text-muted)' }} title={`Assigned to ${st.assignedTo.username}`}>
                      👤 {st.assignedTo.username}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }} title="Unassigned (0 reward points)">
                      Unassigned
                    </span>
                  )}
                  <TaskPriorityBadge priority={st.priority} size="sm" />
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    aria-label={`Delete subtask ${st.title}`}
                    onClick={() => setDeletingSubtaskId(st._id)}
                    style={{ padding: '0 4px', minHeight: '20px', minWidth: '20px', fontSize: 'var(--font-size-xs)' }}
                  >
                    ✕
                  </Button>
                </div>
              </div>
            ))
          )}

          {showAddForm && (
            <SubtaskForm
              parentTaskId={parentTaskId}
              onSubmit={handleCreateSubtask}
              onCancel={() => setShowAddForm(false)}
              teamMembers={teamMembers}
            />
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={Boolean(deletingSubtaskId)}
        onClose={() => setDeletingSubtaskId(null)}
        onConfirm={handleConfirmDeleteSubtask}
        title="Delete Subtask?"
        description="Are you sure you want to delete this subtask?"
        confirmText="Delete Subtask"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
};
