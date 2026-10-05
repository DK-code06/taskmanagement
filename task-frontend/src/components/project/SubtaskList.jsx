import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Badge } from '../ui/Badge';
import { Spinner } from '../ui/Spinner';

/**
 * SubtaskList Component (M4.2 - Lightweight Subtask Visibility)
 * Fetches and displays subtasks under a parent task
 */
export const SubtaskList = ({ parentTaskId, authAxios }) => {
  const [subtasks, setSubtasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

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

  const handleToggle = () => {
    if (!expanded && subtasks.length === 0) {
      fetchSubtasks();
    }
    setExpanded((prev) => !prev);
  };

  return (
    <div className="subtask-list-wrapper" style={{ marginTop: '0.5rem' }}>
      <button
        type="button"
        onClick={handleToggle}
        style={{
          background: 'none',
          border: 'none',
          padding: '2px 6px',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-primary)',
          cursor: 'pointer',
          fontWeight: '500',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <span>{expanded ? '▼' : '▶'} Subtasks</span>
        {subtasks.length > 0 && <span style={{ opacity: 0.8 }}>({subtasks.length})</span>}
      </button>

      {expanded && (
        <div style={{ marginLeft: '1rem', marginTop: '0.375rem', borderLeft: '2px solid var(--color-border)', paddingLeft: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {loading ? (
            <Spinner size="sm" label="Loading subtasks..." />
          ) : subtasks.length === 0 ? (
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              No subtasks created for this task.
            </span>
          ) : (
            subtasks.map((st) => (
              <div
                key={st._id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 'var(--font-size-xs)',
                  padding: '4px 8px',
                  backgroundColor: 'var(--color-bg-subtle)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{st.status === 'Done' ? '✅' : '📌'}</span>
                  <span style={{ textDecoration: st.status === 'Done' ? 'line-through' : 'none', color: st.status === 'Done' ? 'var(--color-text-muted)' : 'var(--color-text-primary)' }}>
                    {st.title}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {st.assignedTo && <span style={{ color: 'var(--color-text-muted)' }}>👤 {st.assignedTo.username || 'Assignee'}</span>}
                  <Badge variant={st.status === 'Done' ? 'success' : st.status === 'In Progress' ? 'warning' : 'neutral'} size="sm">
                    {st.status}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
