import React, { useState } from 'react';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';

/**
 * SubtaskForm Component (M4.3)
 * Form for adding a subtask under a parent task
 */
export const SubtaskForm = ({ parentTaskId, onSubmit, onCancel, teamMembers = [] }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('No Priority');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Subtask title is required');
      return;
    }

    setLoading(true);
    setError('');

    const payload = {
      title: title.trim(),
      description: description.trim(),
      priority,
      assignedTo: assignedTo || null,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
    };

    try {
      await onSubmit(payload, parentTaskId);
      setTitle('');
      setDescription('');
      setPriority('No Priority');
      setAssignedTo('');
      setDueDate('');
      if (onCancel) onCancel();
    } catch (err) {
      console.error('Failed to create subtask:', err);
      setError(err.response?.data?.error || err.message || 'Failed to create subtask');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        backgroundColor: 'var(--color-bg-subtle)',
        padding: '0.75rem 1rem',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        marginTop: '0.5rem',
      }}
    >
      <h5 style={{ fontSize: 'var(--font-size-xs)', fontWeight: '600', color: 'var(--color-text-secondary)', margin: 0 }}>
        + Add New Subtask
      </h5>

      {error && (
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)' }} role="alert">
          {error}
        </div>
      )}

      <Input
        placeholder="Subtask title..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        style={{ minHeight: '36px', fontSize: 'var(--font-size-sm)' }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        <Select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          style={{ minHeight: '36px', fontSize: 'var(--font-size-xs)' }}
        >
          <option value="No Priority">No Priority</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
        </Select>

        {teamMembers.length > 0 && (
          <Select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            style={{ minHeight: '36px', fontSize: 'var(--font-size-xs)' }}
          >
            <option value="">Unassigned (0 pts)</option>
            {teamMembers.map((m) => {
              const u = m.user || m;
              return (
                <option key={u._id || u.id} value={u._id || u.id}>
                  {u.username || u.name}
                </option>
              );
            })}
          </Select>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.375rem', marginTop: '0.25rem' }}>
        {onCancel && (
          <Button variant="ghost" size="sm" type="button" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        )}
        <Button variant="primary" size="sm" type="submit" loading={loading}>
          Add Subtask
        </Button>
      </div>
    </form>
  );
};
