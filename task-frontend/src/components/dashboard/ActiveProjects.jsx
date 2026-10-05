import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Progress } from '../ui/Progress';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';

/**
 * ActiveProjects Component (M4.5-B)
 * Displays project progress and milestone counts following Project -> Milestone -> Task hierarchy.
 */
export const ActiveProjects = ({ projects = [] }) => {
  const activeProjects = projects.filter((p) => p.status !== 'ARCHIVED');

  return (
    <Card className="active-projects-card">
      <CardHeader style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          📁 Active Projects
        </h3>
        <Link to="/projects">
          <Button variant="ghost" size="sm">View All →</Button>
        </Link>
      </CardHeader>

      <CardBody>
        {activeProjects.length === 0 ? (
          <EmptyState title="No Active Projects" description="Create a project to start organizing tasks and milestones." icon="📁" />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {activeProjects.map((p) => {
              const totalTasks = p.totalTasks || 0;
              const completedTasks = p.completedTasks || 0;
              const pct = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

              return (
                <div
                  key={p._id}
                  style={{
                    padding: '1rem',
                    backgroundColor: 'var(--color-bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Link to={`/projects/${p._id}`} style={{ fontWeight: '600', color: 'var(--color-primary)', textDecoration: 'none' }}>
                      {p.name}
                    </Link>
                    <Badge variant={p.status === 'COMPLETED' ? 'success' : 'primary'} size="sm">
                      {p.status || 'ACTIVE'}
                    </Badge>
                  </div>

                  {p.description && (
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0, lineClamp: 2 }}>
                      {p.description}
                    </p>
                  )}

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', marginBottom: '0.25rem' }}>
                      <span>Progress</span>
                      <span>{completedTasks} / {totalTasks} Tasks</span>
                    </div>
                    <Progress value={pct} max={100} size="sm" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
};
