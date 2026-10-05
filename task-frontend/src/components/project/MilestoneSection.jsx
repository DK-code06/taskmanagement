import React, { useState } from 'react';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Progress } from '../ui/Progress';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { MilestoneFormModal } from './MilestoneFormModal';

/**
 * MilestoneSection Component (M4.2)
 * Renders the project's milestones, progress, status changes, and creation/editing controls
 */
export const MilestoneSection = ({
  projectId,
  milestones = [],
  tasks = [],
  onCreateMilestone,
  onUpdateMilestone,
  onDeleteMilestone,
  canEdit = true,
}) => {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState(null);
  const [deletingMilestoneId, setDeletingMilestoneId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const statusMap = {
    PLANNED: { variant: 'neutral', label: 'Planned' },
    IN_PROGRESS: { variant: 'warning', label: 'In Progress' },
    COMPLETED: { variant: 'success', label: 'Completed' },
  };

  const handleConfirmDelete = async () => {
    if (!deletingMilestoneId) return;
    setDeleting(true);
    try {
      await onDeleteMilestone(deletingMilestoneId);
    } finally {
      setDeleting(false);
      setDeletingMilestoneId(null);
    }
  };

  const handleStatusChange = async (m, nextStatus) => {
    try {
      await onUpdateMilestone({ status: nextStatus }, m._id || m.id);
    } catch (err) {
      console.error('Failed to change milestone status:', err);
    }
  };

  return (
    <div className="milestone-section" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 'var(--font-size-xl)', fontWeight: '600', color: 'var(--color-text-primary)', margin: 0 }}>
          🏁 Project Milestones ({milestones.length})
        </h3>

        {canEdit && (
          <Button variant="primary" size="sm" onClick={() => setCreateModalOpen(true)}>
            + Add Milestone
          </Button>
        )}
      </div>

      {milestones.length === 0 ? (
        <div
          style={{
            padding: 'var(--space-xl)',
            textAlign: 'center',
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px dashed var(--color-border)',
            color: 'var(--color-text-muted)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          No milestones defined for this project yet. Create one to organize project phases!
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-md)' }}>
          {milestones.map((m) => {
            const milestoneId = m._id || m.id;
            const milestoneTasks = tasks.filter((t) => (t.milestoneId?._id || t.milestoneId || t.milestone) === milestoneId);
            const doneTasks = milestoneTasks.filter((t) => t.status === 'Done');
            const totalCount = milestoneTasks.length;
            const doneCount = doneTasks.length;

            const st = statusMap[m.status] || statusMap.PLANNED;
            const formattedDate = m.dueDate
              ? new Date(m.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
              : null;

            return (
              <Card key={milestoneId} variant="default" className="milestone-card">
                <CardHeader>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flexGrow: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <h4 style={{ fontSize: 'var(--font-size-md)', fontWeight: '600', color: 'var(--color-text-primary)', margin: 0 }}>
                        {m.title}
                      </h4>
                      <Badge variant={st.variant} size="sm">{st.label}</Badge>
                    </div>
                    {formattedDate && (
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                        🗓️ Target: {formattedDate}
                      </span>
                    )}
                  </div>
                </CardHeader>

                <CardBody>
                  {m.description && (
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: '0 0 var(--space-sm) 0' }}>
                      {m.description}
                    </p>
                  )}

                  <Progress value={doneCount} max={totalCount > 0 ? totalCount : 1} showLabel size="sm" />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-sm)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    <span>{doneCount} of {totalCount} tasks complete</span>
                    <span>Order: #{m.order ?? 0}</span>
                  </div>

                  {canEdit && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'var(--space-md)', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-sm)' }}>
                      {m.status !== 'COMPLETED' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusChange(m, m.status === 'PLANNED' ? 'IN_PROGRESS' : 'COMPLETED')}
                        >
                          {m.status === 'PLANNED' ? '▶️ Start' : '✅ Complete'}
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => setEditingMilestone(m)} aria-label="Edit milestone">
                        ✏️ Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeletingMilestoneId(milestoneId)} aria-label="Delete milestone">
                        🗑️
                      </Button>
                    </div>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {/* Creation Modal */}
      <MilestoneFormModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={onCreateMilestone}
        projectId={projectId}
      />

      {/* Editing Modal */}
      {editingMilestone && (
        <MilestoneFormModal
          isOpen={Boolean(editingMilestone)}
          onClose={() => setEditingMilestone(null)}
          onSubmit={onUpdateMilestone}
          projectId={projectId}
          initialData={editingMilestone}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deletingMilestoneId)}
        onClose={() => setDeletingMilestoneId(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Milestone?"
        description="Are you sure you want to delete this milestone? Tasks will remain intact."
        confirmText="Delete Milestone"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
};
