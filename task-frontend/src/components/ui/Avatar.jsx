import React from 'react';

/**
 * Reusable Avatar Primitive (M4.1)
 * Displays user profile image or initials with optional online status indicator
 */
export const Avatar = ({
  src = null,
  name = '',
  size = 'md',
  status = null, // 'online' | 'offline' | 'busy' | null
  className = '',
  style = {},
}) => {
  const getInitials = (str = '') => {
    if (!str) return 'U';
    const parts = str.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return str.substring(0, 2).toUpperCase();
  };

  const sizeMap = {
    sm: { size: '32px', fontSize: 'var(--font-size-xs)', dotSize: '8px' },
    md: { size: '40px', fontSize: 'var(--font-size-sm)', dotSize: '10px' },
    lg: { size: '48px', fontSize: 'var(--font-size-md)', dotSize: '12px' },
    xl: { size: '64px', fontSize: 'var(--font-size-xl)', dotSize: '14px' },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  const statusColors = {
    online: 'var(--color-success)',
    offline: 'var(--color-secondary)',
    busy: 'var(--color-danger)',
  };

  return (
    <div
      className={`ui-avatar ${className}`}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: currentSize.size,
        height: currentSize.size,
        borderRadius: '50%',
        backgroundColor: 'var(--color-primary-light)',
        color: 'var(--color-primary-active)',
        fontWeight: '600',
        fontSize: currentSize.fontSize,
        border: '1px solid var(--color-primary-border)',
        userSelect: 'none',
        flexShrink: 0,
        ...style,
      }}
      aria-label={name ? `Avatar for ${name}` : 'User avatar'}
    >
      {src ? (
        <img
          src={src}
          alt={name ? `Avatar of ${name}` : 'User avatar'}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            objectFit: 'cover',
          }}
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
      ) : (
        <span>{getInitials(name)}</span>
      )}

      {status && statusColors[status] && (
        <span
          style={{
            position: 'absolute',
            bottom: '0',
            right: '0',
            width: currentSize.dotSize,
            height: currentSize.dotSize,
            borderRadius: '50%',
            backgroundColor: statusColors[status],
            border: '2px solid var(--color-surface)',
          }}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  );
};
