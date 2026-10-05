import React from 'react';

/**
 * Reusable Empty State Primitive (M4.1)
 * Renders when data collections (tasks, projects, messages) are empty
 */
export const EmptyState = ({
  title,
  description,
  icon = null,
  action = null,
  className = '',
  style = {},
}) => {
  return (
    <div
      className={`ui-empty-state ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-2xl) var(--space-lg)',
        textAlign: 'center',
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px dashed var(--color-border-strong)',
        color: 'var(--color-text-secondary)',
        gap: 'var(--space-md)',
        width: '100%',
        ...style,
      }}
    >
      {icon && (
        <div
          style={{
            fontSize: '2.5rem',
            color: 'var(--color-text-muted)',
            lineHeight: 1,
            marginBottom: 'var(--space-xs)',
          }}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}

      {title && (
        <h4
          style={{
            fontSize: 'var(--font-size-lg)',
            fontWeight: '600',
            color: 'var(--color-text-primary)',
            margin: 0,
          }}
        >
          {title}
        </h4>
      )}

      {description && (
        <p
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-muted)',
            maxWidth: '400px',
            margin: 0,
          }}
        >
          {description}
        </p>
      )}

      {action && <div style={{ marginTop: 'var(--space-sm)' }}>{action}</div>}
    </div>
  );
};
