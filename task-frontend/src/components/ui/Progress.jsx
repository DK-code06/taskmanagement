import React from 'react';

/**
 * Reusable Progress Bar Primitive (M4.1)
 * Accessible progress indicator
 */
export const Progress = ({
  value = 0,
  max = 100,
  variant = 'primary',
  size = 'md',
  showLabel = false,
  striped = false,
  className = '',
  style = {},
}) => {
  const percentage = max > 0 ? Math.min(Math.max((value / max) * 100, 0), 100) : 0;

  const heightMap = {
    sm: '4px',
    md: '8px',
    lg: '12px',
  };

  const variantColors = {
    primary: 'var(--color-primary)',
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    danger: 'var(--color-danger)',
    info: 'var(--color-info)',
  };

  const barColor = variantColors[variant] || variantColors.primary;
  const barHeight = heightMap[size] || heightMap.md;

  return (
    <div
      className={`ui-progress-wrapper ${className}`}
      style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '100%', ...style }}
    >
      {showLabel && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          <span>Progress</span>
          <span>{Math.round(percentage)}%</span>
        </div>
      )}

      <div
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={max}
        style={{
          width: '100%',
          height: barHeight,
          backgroundColor: 'var(--color-bg-subtle)',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${percentage}%`,
            backgroundColor: barColor,
            backgroundImage: striped
              ? 'linear-gradient(45deg, rgba(255,255,255,.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.15) 50%, rgba(255,255,255,.15) 75%, transparent 75%, transparent)'
              : 'none',
            backgroundSize: '1rem 1rem',
            borderRadius: 'var(--radius-full)',
            transition: 'width var(--transition-normal)',
          }}
        />
      </div>
    </div>
  );
};
