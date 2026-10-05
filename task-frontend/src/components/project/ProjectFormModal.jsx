import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';

/**
 * ProjectFormModal Component (M4.2)
 * Handles Project creation & editing aligned with backend schema
 */
export const ProjectFormModal = ({
  isOpen,
  onClose,
  onSubmit,
  initialData = null,
  teams = [],
  currentUserId,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ownerType, setOwnerType] = useState('User');
  const [ownerId, setOwnerId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setDescription(initialData.description || '');
      setOwnerType(initialData.ownerType || 'User');
      setOwnerId(initialData.ownerId?._id || initialData.ownerId || currentUserId || '');
      setDeadline(initialData.deadline ? new Date(initialData.deadline).toISOString().slice(0, 10) : '');
      setTagsInput(Array.isArray(initialData.tags) ? initialData.tags.join(', ') : '');
      setStatus(initialData.status || 'ACTIVE');
    } else {
      setName('');
      setDescription('');
      setOwnerType('User');
      setOwnerId(currentUserId || '');
      setDeadline('');
      setTagsInput('');
      setStatus('ACTIVE');
    }
    setError('');
  }, [initialData, currentUserId, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required');
      return;
    }

    setError('');
    setLoading(true);

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      name: name.trim(),
      description: description.trim(),
      ownerType,
      ownerId: ownerType === 'Team' ? ownerId : (currentUserId || ownerId),
      deadline: deadline ? new Date(deadline).toISOString() : null,
      tags,
      status,
    };

    try {
      await onSubmit(payload, initialData?._id || initialData?.id);
      onClose();
    } catch (err) {
      console.error('Project form submit error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to save project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit Project' : 'Create New Project'}
      description="Projects organize milestones, tasks, and subtasks across teams or personal workflows."
      maxWidth="540px"
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
          label="Project Name"
          placeholder="e.g. Q4 Platform Redesign"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <Textarea
          label="Description"
          placeholder="Brief summary of the project goals..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
          <Select
            label="Owner Workspace"
            value={ownerType}
            onChange={(e) => {
              const val = e.target.value;
              setOwnerType(val);
              if (val === 'User') setOwnerId(currentUserId || '');
              else if (teams.length > 0) setOwnerId(teams[0]._id);
            }}
          >
            <option value="User">Personal Workspace</option>
            {teams.length > 0 && <option value="Team">Team Workspace</option>}
          </Select>

          {ownerType === 'Team' ? (
            <Select
              label="Select Team"
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              required
            >
              {teams.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </Select>
          ) : (
            <Input label="Target Deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          )}
        </div>

        {ownerType === 'Team' && (
          <Input label="Target Deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        )}

        {initialData && (
          <Select label="Project Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
        )}

        <Input
          label="Tags (comma-separated)"
          placeholder="frontend, ui, m4"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          helperText="Separate tags with commas"
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: 'var(--space-md)' }}>
          <Button variant="outline" type="button" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={loading}>
            {initialData ? 'Update Project' : 'Create Project'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
