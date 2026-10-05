import React, { useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';

/**
 * Reusable Drawer Primitive (M4.1)
 * Positions: left, right, top, bottom
 * Essential for responsive mobile navigation, chat drawer, and task filters
 */
export const Drawer = ({
  isOpen,
  onClose,
  position = 'right',
  title,
  children,
  size = '360px',
  closeOnBackdropClick = true,
  className = '',
}) => {
  const drawerId = useId();
  const titleId = `${drawerId}-title`;
  const drawerRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement;
      document.body.style.overflow = 'hidden';

      const timer = setTimeout(() => {
        if (drawerRef.current) {
          const focusables = drawerRef.current.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusables.length > 0) {
            focusables[0].focus();
          } else {
            drawerRef.current.focus();
          }
        }
      }, 50);

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = '';
        if (previousFocusRef.current && previousFocusRef.current.focus) {
          previousFocusRef.current.focus();
        }
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && drawerRef.current) {
        const focusables = Array.from(
          drawerRef.current.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );

        if (focusables.length === 0) return;

        const firstElement = focusables[0];
        const lastElement = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const positionStyles = {
    right: {
      top: 0, right: 0, bottom: 0,
      width: '100%', maxWidth: size, height: '100%',
      transform: 'translateX(0)',
    },
    left: {
      top: 0, left: 0, bottom: 0,
      width: '100%', maxWidth: size, height: '100%',
      transform: 'translateX(0)',
    },
    top: {
      top: 0, left: 0, right: 0,
      width: '100%', height: size, maxHeight: '90vh',
      transform: 'translateY(0)',
    },
    bottom: {
      bottom: 0, left: 0, right: 0,
      width: '100%', height: size, maxHeight: '90vh',
      transform: 'translateY(0)',
    },
  };

  const backdropStyle = {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    zIndex: 'var(--z-modal)',
    animation: 'ui-fade-in var(--transition-fast)',
  };

  const currentPositionStyle = positionStyles[position] || positionStyles.right;

  const contentStyle = {
    position: 'fixed',
    backgroundColor: 'var(--color-surface)',
    boxShadow: 'var(--shadow-modal)',
    zIndex: 'calc(var(--z-modal) + 1)',
    display: 'flex',
    flexDirection: 'column',
    outline: 'none',
    borderLeft: position === 'right' ? '1px solid var(--color-border)' : 'none',
    borderRight: position === 'left' ? '1px solid var(--color-border)' : 'none',
    borderTop: position === 'bottom' ? '1px solid var(--color-border)' : 'none',
    borderBottom: position === 'top' ? '1px solid var(--color-border)' : 'none',
    ...currentPositionStyle,
  };

  return createPortal(
    <React.Fragment>
      <div
        className="ui-drawer-backdrop"
        style={backdropStyle}
        onClick={() => {
          if (closeOnBackdropClick) onClose();
        }}
      />
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={`ui-drawer ui-drawer-${position} ${className}`}
        style={contentStyle}
      >
        <div
          style={{
            padding: 'var(--space-md) var(--space-lg)',
            borderBottom: '1px solid var(--color-border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {title ? (
            <h3 id={titleId} style={{ fontSize: 'var(--font-size-lg)', fontWeight: '600', margin: 0 }}>
              {title}
            </h3>
          ) : <div />}
          <Button variant="ghost" size="sm" iconOnly aria-label="Close drawer" onClick={onClose}>
            ✕
          </Button>
        </div>

        <div style={{ flexGrow: 1, overflowY: 'auto', padding: 'var(--space-lg)' }}>
          {children}
        </div>
      </div>
    </React.Fragment>,
    document.body
  );
};
