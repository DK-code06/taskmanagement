import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';

/**
 * DashboardHeader Component (M4.5-B)
 * Top header overview for Dashboard.
 */
export const DashboardHeader = ({ username, onOpenCreateProject, onOpenCreateTask }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1.25rem 1.5rem',
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-subtle)',
        flexWrap: 'wrap',
        gap: '1rem',
      }}
    >
      <div>
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: '700', margin: 0, color: 'var(--color-text)' }}>
          Welcome back, {username || 'User'}! 👋
        </h2>
        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
          Here is your personal productivity overview, active projects, and community ranking.
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Link to="/projects" style={{ textDecoration: 'none' }}>
          <Button variant="outline" size="sm">
            📁 Projects Directory
          </Button>
        </Link>
        {onOpenCreateTask && (
          <Button variant="primary" size="sm" onClick={onOpenCreateTask}>
            + New Task
          </Button>
        )}
      </div>
    </div>
  );
};
