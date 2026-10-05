import React from 'react';
import { Card, CardHeader, CardBody, CardFooter } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ProjectStatusBadge } from './ProjectStatusBadge';
import { ProjectProgress } from './ProjectProgress';
import { ProjectMembers } from './ProjectMembers';

/**
 * ProjectCard Component (M4.2)
 * Renders concise project metadata, status, progress, milestones & task counts
 */
export const ProjectCard = ({
  project,
  onSelect,
  onEdit,
  onArchive,
  className = '',
}) => {
  if (!project) return null;

  const {
    _id,
    name,
    description,
    status = 'ACTIVE',
    ownerType = 'User',
    ownerId,
    members = [],
    deadline,
    tags = [],
    completedTasks = 0,
    totalTasks = 0,
    milestoneCount = 0,
  } = project;

  const formattedDeadline = deadline
    ? new Date(deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <Card variant="interactive" className={`project-card ${className}`} onClick={() => onSelect && onSelect(_id)}>
      <CardHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flexGrow: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <h3
              style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: '600',
                color: 'var(--color-primary)',
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {name}
            </h3>
            <ProjectStatusBadge status={status} size="sm" />
          </div>

          <ProjectMembers ownerType={ownerType} ownerId={ownerId} members={members} />
        </div>
      </CardHeader>

      <CardBody>
        {description && (
          <p
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              margin: '0 0 var(--space-md) 0',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {description}
          </p>
        )}

        <ProjectProgress completedTasks={completedTasks} totalTasks={totalTasks} />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 'var(--space-md)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-muted)',
          }}
        >
          <span>🚩 {milestoneCount} Milestones</span>
          <span>📋 {totalTasks} Tasks</span>
          {formattedDeadline && <span>🗓️ {formattedDeadline}</span>}
        </div>

        {tags.length > 0 && (
          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: 'var(--space-sm)' }}>
            {tags.map((tag, idx) => (
              <Badge key={idx} variant="neutral" size="sm">
                #{tag}
              </Badge>
            ))}
          </div>
        )}
      </CardBody>

      <CardFooter style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
        {onEdit && (
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Edit project ${name}`}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(project);
            }}
          >
            ✏️ Edit
          </Button>
        )}
        {onArchive && (
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Archive project ${name}`}
            onClick={(e) => {
              e.stopPropagation();
              onArchive(project);
            }}
          >
            📦 Archive
          </Button>
        )}
        <Button
          variant="primary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            if (onSelect) onSelect(_id);
          }}
        >
          View Project →
        </Button>
      </CardFooter>
    </Card>
  );
};
