import React from 'react';

/**
 * Reusable Spinner Primitive (M4.1)
 * Accessible loading indicator
 */
export const Spinner = ({
  size = 'md',
  color = 'var(--color-primary)',
  className = '',
  label = 'Loading...',
  style = {},
}) => {
  const sizeMap = {
    sm: '16px',
    md: '24px',
    lg: '36px',
    xl: '48px',
  };

  const pxSize = sizeMap[size] || sizeMap.md;

  return (
    <div
      role="status"
      aria-label={label}
      className={`ui-spinner ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: pxSize,
          height: pxSize,
          border: `3px solid var(--color-border)`,
          borderTopColor: color,
          borderRadius: '50%',
          animation: 'ui-spin 0.75s linear infinite',
        }}
        aria-hidden="true"
      />
      <span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}>
        {label}
      </span>
    </div>
  );
};
