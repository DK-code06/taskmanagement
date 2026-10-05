import React from 'react';

/**
 * Reusable Badge Primitive (M4.1)
 * Variants: neutral, primary, success, warning, danger, info
 */
export const Badge = ({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  className = '',
  style = {},
  ...props
}) => {
  const variantStyles = {
    neutral: {
      backgroundColor: 'var(--color-bg-subtle)',
      color: 'var(--color-text-secondary)',
      border: '1px solid var(--color-border)',
      dotColor: 'var(--color-secondary)',
    },
    primary: {
      backgroundColor: 'var(--color-primary-light)',
      color: 'var(--color-primary-active)',
      border: '1px solid var(--color-primary-border)',
      dotColor: 'var(--color-primary)',
    },
    success: {
      backgroundColor: 'var(--color-success-light)',
      color: 'var(--color-success)',
      border: '1px solid var(--color-border)',
      dotColor: 'var(--color-success)',
    },
    warning: {
      backgroundColor: 'var(--color-warning-light)',
      color: 'var(--color-warning)',
      border: '1px solid var(--color-border)',
      dotColor: 'var(--color-warning)',
    },
    danger: {
      backgroundColor: 'var(--color-danger-light)',
      color: 'var(--color-danger)',
      border: '1px solid var(--color-border)',
      dotColor: 'var(--color-danger)',
    },
    info: {
      backgroundColor: 'var(--color-info-light)',
      color: 'var(--color-info)',
      border: '1px solid var(--color-border)',
      dotColor: 'var(--color-info)',
    },
  };

  const sizeStyles = {
    sm: {
      padding: '0.125rem 0.375rem',
      fontSize: 'var(--font-size-xs)',
    },
    md: {
      padding: '0.25rem 0.625rem',
      fontSize: 'var(--font-size-sm)',
    },
  };

  const currentVariant = variantStyles[variant] || variantStyles.neutral;
  const currentSize = sizeStyles[size] || sizeStyles.md;

  return (
    <span
      className={`ui-badge ui-badge-${variant} ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        fontWeight: '500',
        borderRadius: 'var(--radius-full)',
        whiteSpace: 'nowrap',
        lineHeight: '1.2',
        ...currentVariant,
        ...currentSize,
        ...style,
      }}
      {...props}
    >
      {dot && (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: currentVariant.dotColor,
          }}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
};
