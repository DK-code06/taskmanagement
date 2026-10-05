import React from 'react';

/**
 * Reusable Card Primitive (M4.1)
 * Supports variants: default, elevated, interactive, bordered
 */
export const Card = ({
  children,
  variant = 'default',
  className = '',
  style = {},
  onClick,
  ...props
}) => {
  const baseStyles = {
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    transition: 'all var(--transition-normal)',
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  };

  const variantStyles = {
    default: {
      border: '1px solid var(--color-border)',
      boxShadow: 'var(--shadow-subtle)',
    },
    bordered: {
      border: '1px solid var(--color-border-strong)',
      boxShadow: 'none',
    },
    elevated: {
      border: '1px solid var(--color-border-subtle)',
      boxShadow: 'var(--shadow-elevated)',
    },
    interactive: {
      border: '1px solid var(--color-border)',
      boxShadow: 'var(--shadow-subtle)',
      cursor: 'pointer',
    },
  };

  const currentVariant = variantStyles[variant] || variantStyles.default;

  return (
    <div
      className={`ui-card ui-card-${variant} ${className}`}
      style={{ ...baseStyles, ...currentVariant, ...style }}
      onClick={onClick}
      tabIndex={variant === 'interactive' && onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (variant === 'interactive' && onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick(e);
        }
      }}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className = '', style = {}, ...props }) => (
  <div
    className={`ui-card-header ${className}`}
    style={{
      padding: 'var(--space-md) var(--space-lg)',
      borderBottom: '1px solid var(--color-border-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);

export const CardBody = ({ children, className = '', style = {}, ...props }) => (
  <div
    className={`ui-card-body ${className}`}
    style={{
      padding: 'var(--space-lg)',
      flexGrow: 1,
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);

export const CardFooter = ({ children, className = '', style = {}, ...props }) => (
  <div
    className={`ui-card-footer ${className}`}
    style={{
      padding: 'var(--space-md) var(--space-lg)',
      borderTop: '1px solid var(--color-border-subtle)',
      backgroundColor: 'var(--color-bg-paper)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);
