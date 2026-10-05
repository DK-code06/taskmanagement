import React from 'react';

/**
 * Reusable Button Primitive (M4.1)
 * Supports variants: primary, secondary, outline, ghost, danger, success
 * Sizes: sm, md, lg
 * Touch target: min 44px on md/lg or mobile
 */
export const Button = React.forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled = false,
  loading = false,
  icon = null,
  iconOnly = false,
  className = '',
  onClick,
  'aria-label': ariaLabel,
  ...props
}, ref) => {

  if (iconOnly && !ariaLabel && typeof children !== 'string') {
    console.warn('Button: Icon-only buttons must provide an aria-label for accessibility.');
  }

  const baseStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    fontWeight: '500',
    borderRadius: 'var(--radius-md)',
    border: '1px solid transparent',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: 'all var(--transition-fast)',
    textDecoration: 'none',
    userSelect: 'none',
    fontFamily: 'inherit',
    lineHeight: '1.25',
    outline: 'none',
    position: 'relative',
    whiteSpace: 'nowrap',
  };

  const variantStyles = {
    primary: {
      backgroundColor: 'var(--color-primary)',
      color: '#ffffff',
      borderColor: 'var(--color-primary)',
    },
    secondary: {
      backgroundColor: 'var(--color-secondary-light)',
      color: 'var(--color-text-primary)',
      borderColor: 'var(--color-border)',
    },
    outline: {
      backgroundColor: 'transparent',
      color: 'var(--color-text-primary)',
      borderColor: 'var(--color-border-strong)',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: 'var(--color-text-secondary)',
      borderColor: 'transparent',
    },
    danger: {
      backgroundColor: 'var(--color-danger)',
      color: '#ffffff',
      borderColor: 'var(--color-danger)',
    },
    success: {
      backgroundColor: 'var(--color-success)',
      color: '#ffffff',
      borderColor: 'var(--color-success)',
    },
  };

  const sizeStyles = {
    sm: {
      padding: iconOnly ? '0.375rem' : '0.375rem 0.75rem',
      fontSize: 'var(--font-size-sm)',
      minHeight: '36px',
      minWidth: iconOnly ? '36px' : 'auto',
    },
    md: {
      padding: iconOnly ? '0.5rem' : '0.5rem 1rem',
      fontSize: 'var(--font-size-md)',
      minHeight: '44px', // WCAG recommended touch target
      minWidth: iconOnly ? '44px' : 'auto',
    },
    lg: {
      padding: iconOnly ? '0.75rem' : '0.75rem 1.5rem',
      fontSize: 'var(--font-size-lg)',
      minHeight: '52px',
      minWidth: iconOnly ? '52px' : 'auto',
    },
  };

  const currentVariant = variantStyles[variant] || variantStyles.primary;
  const currentSize = sizeStyles[size] || sizeStyles.md;

  const combinedStyle = {
    ...baseStyles,
    ...currentVariant,
    ...currentSize,
  };

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-busy={loading}
      className={`ui-button ui-button-${variant} ui-button-${size} ${className}`}
      style={combinedStyle}
      {...props}
    >
      {loading ? (
        <span
          style={{
            display: 'inline-block',
            width: '1em',
            height: '1em',
            border: '2px solid currentColor',
            borderRightColor: 'transparent',
            borderRadius: '50%',
            animation: 'ui-spin 0.6s linear infinite',
          }}
          aria-hidden="true"
        />
      ) : icon ? (
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>
      ) : null}

      {!iconOnly && children}
    </button>
  );
});

Button.displayName = 'Button';
