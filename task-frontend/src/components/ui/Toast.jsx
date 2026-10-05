import React from 'react';
import { Button } from './Button';

/**
 * Reusable Toast Primitive (M4.1)
 * Accessible live region toast component
 */
export const Toast = ({
  id,
  type = 'info',
  title,
  message,
  visible = true,
  onClose,
  className = '',
  style = {},
}) => {
  const typeStyles = {
    info: {
      borderLeftColor: 'var(--color-info)',
      dotColor: 'var(--color-info)',
      defaultTitle: 'Info',
    },
    success: {
      borderLeftColor: 'var(--color-success)',
      dotColor: 'var(--color-success)',
      defaultTitle: 'Success',
    },
    warning: {
      borderLeftColor: 'var(--color-warning)',
      dotColor: 'var(--color-warning)',
      defaultTitle: 'Attention',
    },
    error: {
      borderLeftColor: 'var(--color-danger)',
      dotColor: 'var(--color-danger)',
      defaultTitle: 'Error',
    },
  };

  const currentType = typeStyles[type] || typeStyles.info;

  const baseStyle = {
    pointerEvents: 'auto',
    minWidth: '260px',
    maxWidth: '400px',
    width: '100%',
    backgroundColor: 'var(--color-surface)',
    borderLeft: `5px solid ${currentType.borderLeftColor}`,
    boxShadow: 'var(--shadow-elevated)',
    padding: '0.75rem 1rem',
    borderRadius: 'var(--radius-md)',
    borderTop: '1px solid var(--color-border-subtle)',
    borderRight: '1px solid var(--color-border-subtle)',
    borderBottom: '1px solid var(--color-border-subtle)',
    transform: visible ? 'translateY(0) scale(1)' : 'translateY(-8px) scale(0.96)',
    opacity: visible ? 1 : 0,
    transition: 'transform var(--transition-normal), opacity var(--transition-normal)',
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'flex-start',
    color: 'var(--color-text-primary)',
    ...style,
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`ui-toast ui-toast-${type} ${className}`}
      style={baseStyle}
    >
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          marginTop: '6px',
          backgroundColor: currentType.dotColor,
          flexShrink: 0,
        }}
        aria-hidden="true"
      />
      <div style={{ flexGrow: 1 }}>
        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: '600', marginBottom: '2px' }}>
          {title || currentType.defaultTitle}
        </div>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', wordBreak: 'break-word' }}>
          {message}
        </div>
      </div>
      {onClose && (
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          aria-label="Dismiss toast"
          onClick={() => onClose(id)}
          style={{ padding: '2px', minHeight: '24px', minWidth: '24px' }}
        >
          ✕
        </Button>
      )}
    </div>
  );
};

export const ToastContainer = ({ children, position = 'top-right', className = '', style = {} }) => {
  const positionStyles = {
    'top-right': { top: '1rem', right: '1rem' },
    'top-left': { top: '1rem', left: '1rem' },
    'bottom-right': { bottom: '1rem', right: '1rem' },
    'bottom-left': { bottom: '1rem', left: '1rem' },
  };

  const currentPos = positionStyles[position] || positionStyles['top-right'];

  return (
    <div
      aria-live="polite"
      className={`ui-toast-container ${className}`}
      style={{
        position: 'fixed',
        zIndex: 'var(--z-toast)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        alignItems: 'flex-end',
        maxWidth: 'calc(100vw - 2rem)',
        pointerEvents: 'none',
        ...currentPos,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
