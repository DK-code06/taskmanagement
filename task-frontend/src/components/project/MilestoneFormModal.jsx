import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';

/**
 * MilestoneFormModal Component (M4.2)
 * Handles Milestone creation & editing within a project
 */
export const MilestoneFormModal = ({
  isOpen,
  onClose,
  onSubmit,
  projectId,
  initialData = null,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [order, setOrder] = useState(0);
  const [status, setStatus] = useState('PLANNED');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setDescription(initialData.description || '');
      setDueDate(initialData.dueDate ? new Date(initialData.dueDate).toISOString().slice(0, 10) : '');
      setOrder(initialData.order ?? 0);
      setStatus(initialData.status || 'PLANNED');
    } else {
      setTitle('');
      setDescription('');
      setDueDate('');
      setOrder(0);
      setStatus('PLANNED');
    }
    setError('');
  }, [initialData, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Milestone title is required');
      return;
    }

    setError('');
    setLoading(true);

    const payload = {
      projectId,
      title: title.trim(),
      description: description.trim(),
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      order: Number(order) || 0,
      status,
    };

    try {
      await onSubmit(payload, initialData?._id || initialData?.id);
      onClose();
    } catch (err) {
      console.error('Milestone form submit error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to save milestone');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit Milestone' : 'Add Project Milestone'}
      description="Milestones demarcate key delivery target dates and group tasks within the project."
      maxWidth="480px"
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
          label="Milestone Title"
          placeholder="e.g. M1 - Safe Foundation"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <Textarea
          label="Description"
          placeholder="Summary of target deliverables..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
          <Input label="Target Due Date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <Input label="Display Order" type="number" value={order} onChange={(e) => setOrder(e.target.value)} />
        </div>

        {initialData && (
          <Select label="Milestone Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="PLANNED">Planned</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
          </Select>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: 'var(--space-md)' }}>
          <Button variant="outline" type="button" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={loading}>
            {initialData ? 'Update Milestone' : 'Create Milestone'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
