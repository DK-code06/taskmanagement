import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';

/**
 * TaskFormModal Component (M4.3)
 * Form for creating & editing root tasks within Project & Milestone context
 */
export const TaskFormModal = ({
  isOpen,
  onClose,
  onSubmit,
  initialData = null,
  projects = [],
  milestones = [],
  teamMembers = [],
  currentProjectId = null,
  currentMilestoneId = null,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [priority, setPriority] = useState('No Priority');
  const [status, setStatus] = useState('To Do');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setDescription(initialData.description || '');
      setProjectId(initialData.projectId?._id || initialData.projectId || currentProjectId || '');
      setMilestoneId(initialData.milestoneId?._id || initialData.milestoneId || currentMilestoneId || '');
      setPriority(initialData.priority || 'No Priority');
      setStatus(initialData.status || 'To Do');
      setAssignedTo(initialData.assignedTo?._id || initialData.assignedTo || '');
      setDueDate(initialData.dueDate ? new Date(initialData.dueDate).toISOString().slice(0, 16) : '');
      setEstimatedMinutes(initialData.estimatedMinutes || '');
      setTagsInput(Array.isArray(initialData.tags) ? initialData.tags.join(', ') : '');
    } else {
      setTitle('');
      setDescription('');
      setProjectId(currentProjectId || '');
      setMilestoneId(currentMilestoneId || '');
      setPriority('No Priority');
      setStatus('To Do');
      setAssignedTo('');
      setDueDate('');
      setEstimatedMinutes('');
      setTagsInput('');
    }
    setError('');
  }, [initialData, currentProjectId, currentMilestoneId, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task title is required');
      return;
    }

    setError('');
    setLoading(true);

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      title: title.trim(),
      description: description.trim(),
      projectId: projectId || null,
      milestoneId: milestoneId || null,
      priority,
      status,
      assignedTo: assignedTo || null,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : 0,
      tags,
    };

    try {
      await onSubmit(payload, initialData?._id || initialData?.id);
      onClose();
    } catch (err) {
      console.error('Task form submit error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to save task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit Task' : 'Create New Task'}
      description="Tasks define specific work items associated with projects and milestones."
      maxWidth="560px"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        {error && (
          <div
            role="alert"
            style={{
              padding: '0.75rem',
              backgroundColor: 'var(--color-danger-light)',
              color: 'var(--color-danger)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: '500',
            }}
          >
            {error}
          </div>
        )}

        <Input
          label="Task Title"
          placeholder="e.g. Implement drag-and-drop Kanban"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <Textarea
          label="Description"
          placeholder="Detailed task specifications..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
          {projects.length > 0 && (
            <Select label="Project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">No Project</option>
              {projects.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </Select>
          )}

          {milestones.length > 0 && (
            <Select label="Milestone" value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)}>
              <option value="">No Milestone</option>
              {milestones.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.title}
                </option>
              ))}
            </Select>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
          <Select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="No Priority">No Priority</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </Select>

          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="To Do">To Do</option>
            <option value="In Progress">In Progress</option>
            <option value="Done">Done</option>
          </Select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
          <Select label="Assignee" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
            <option value="">Unassigned (0 reward pts)</option>
            {teamMembers.map((m) => {
              const u = m.user || m;
              return (
                <option key={u._id || u.id} value={u._id || u.id}>
                  {u.username || u.name}
                </option>
              );
            })}
          </Select>

          <Input label="Due Date" type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
          <Input
            label="Est. Duration (minutes)"
            type="number"
            placeholder="e.g. 45"
            value={estimatedMinutes}
            onChange={(e) => setEstimatedMinutes(e.target.value)}
          />

          <Input
            label="Tags (comma-separated)"
            placeholder="kanban, frontend, m4"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: 'var(--space-md)' }}>
          <Button variant="outline" type="button" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={loading}>
            {initialData ? 'Update Task' : 'Create Task'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
