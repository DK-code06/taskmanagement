import React, { useState, useId } from 'react';

/**
 * Reusable Tooltip Primitive (M4.1)
 * Displays accessible helpful text on hover / focus
 */
export const Tooltip = ({
  content,
  children,
  position = 'top',
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipId = useId();

  if (!content) return children;

  const positionStyles = {
    top: {
      bottom: '100%',
      left: '50%',
      transform: 'translateX(-50%) translateY(-6px)',
      marginBottom: '6px',
    },
    bottom: {
      top: '100%',
      left: '50%',
      transform: 'translateX(-50%) translateY(6px)',
      marginTop: '6px',
    },
    left: {
      right: '100%',
      top: '50%',
      transform: 'translateY(-50%) translateX(-6px)',
      marginRight: '6px',
    },
    right: {
      left: '100%',
      top: '50%',
      transform: 'translateY(-50%) translateX(6px)',
      marginLeft: '6px',
    },
  };

  const currentPos = positionStyles[position] || positionStyles.top;

  return (
    <div
      className={`ui-tooltip-wrapper ${className}`}
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {React.isValidElement(children)
        ? React.cloneElement(children, {
            'aria-describedby': tooltipId,
          })
        : children}

      {isVisible && (
        <div
          id={tooltipId}
          role="tooltip"
          style={{
            position: 'absolute',
            zIndex: 'var(--z-tooltip)',
            backgroundColor: 'var(--color-text-primary)',
            color: 'var(--color-text-inverse)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: '500',
            padding: '0.25rem 0.5rem',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow-elevated)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            animation: 'ui-fade-in var(--transition-fast)',
            ...currentPos,
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
};
