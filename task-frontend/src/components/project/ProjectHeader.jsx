import React, { useState } from 'react';
import { ProjectStatusBadge } from './ProjectStatusBadge';
import { ProjectMembers } from './ProjectMembers';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ConfirmDialog } from '../ui/ConfirmDialog';

/**
 * ProjectHeader Component (M4.2)
 * Main detail header for Project Overview
 */
export const ProjectHeader = ({
  project,
  onEdit,
  onArchive,
  onBack,
}) => {
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  if (!project) return null;

  const { name, description, status, ownerType, ownerId, members = [], deadline, tags = [] } = project;

  const formattedDeadline = deadline
    ? new Date(deadline).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  const handleConfirmArchive = async () => {
    setArchiving(true);
    try {
      await onArchive(project._id || project.id);
    } finally {
      setArchiving(false);
      setArchiveDialogOpen(false);
    }
  };

  return (
    <div
      className="project-header-panel"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        padding: 'var(--space-lg)',
        boxShadow: 'var(--shadow-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-md)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {onBack && (
            <Button variant="outline" size="sm" onClick={onBack} aria-label="Back to projects">
              ← Projects
            </Button>
          )}
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: '700', color: 'var(--color-text-primary)', margin: 0 }}>
            {name}
          </h2>
          <ProjectStatusBadge status={status} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {onEdit && (
            <Button variant="outline" size="sm" onClick={() => onEdit(project)} aria-label="Edit project">
              ✏️ Edit Project
            </Button>
          )}
          {onArchive && (
            <Button variant="danger" size="sm" onClick={() => setArchiveDialogOpen(true)} aria-label="Archive project">
              📦 Archive
            </Button>
          )}
        </div>
      </div>

      {description && (
        <p style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-secondary)', margin: 0 }}>
          {description}
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-md)' }}>
        <ProjectMembers ownerType={ownerType} ownerId={ownerId} members={members} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
          {formattedDeadline && <span>🗓️ Target Deadline: <strong>{formattedDeadline}</strong></span>}
          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
              {tags.map((t, idx) => (
                <Badge key={idx} variant="neutral" size="sm">
                  #{t}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={archiveDialogOpen}
        onClose={() => setArchiveDialogOpen(false)}
        onConfirm={handleConfirmArchive}
        title="Archive Project?"
        description={`Are you sure you want to archive "${name}"? It will be marked as ARCHIVED.`}
        confirmText="Archive Project"
        variant="danger"
        loading={archiving}
      />
    </div>
  );
};
