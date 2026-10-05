import React from 'react';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';

/**
 * Reusable App Header Component (M4.1 Layout Foundation, updated in M4.4)
 */
export const Header = ({
  user,
  onLogout,
  title = 'Task Management Platform',
  onMobileNavToggle,
  onOpenNotifications,
  unreadNotificationsCount = 0,
  onOpenChat,
  unreadChatCount = 0,
  children,
}) => {
  return (
    <header
      style={{
        height: '64px',
        backgroundColor: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        padding: '0 var(--space-lg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 'var(--z-sticky)',
        boxShadow: 'var(--shadow-subtle)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {onMobileNavToggle && (
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            aria-label="Toggle mobile menu"
            onClick={onMobileNavToggle}
            className="mobile-nav-toggle"
          >
            ☰
          </Button>
        )}
        <h1
          style={{
            fontSize: 'var(--font-size-lg)',
            fontWeight: '700',
            color: 'var(--color-primary)',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          {title}
        </h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {children}

        {onOpenNotifications && (
          <Button
            variant="ghost"
            size="sm"
            aria-label="Open notifications"
            onClick={onOpenNotifications}
            style={{ position: 'relative' }}
          >
            🔔
            {unreadNotificationsCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  backgroundColor: 'var(--color-danger, #ef4444)',
                  color: '#fff',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  borderRadius: '9999px',
                  padding: '1px 5px',
                  lineHeight: '1',
                }}
              >
                {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
              </span>
            )}
          </Button>
        )}

        {onOpenChat && (
          <Button
            variant="ghost"
            size="sm"
            aria-label="Open chat"
            onClick={onOpenChat}
            style={{ position: 'relative' }}
          >
            💬
            {unreadChatCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  backgroundColor: 'var(--color-primary, #3b82f6)',
                  color: '#fff',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  borderRadius: '9999px',
                  padding: '1px 5px',
                  lineHeight: '1',
                }}
              >
                {unreadChatCount > 99 ? '99+' : unreadChatCount}
              </span>
            )}
          </Button>
        )}

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Avatar name={user.username || user.name} status="online" size="sm" />
            <span
              className="user-greeting"
              style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: '500',
                color: 'var(--color-text-secondary)',
              }}
            >
              {user.username || user.name}
            </span>
            {onLogout && (
              <Button variant="outline" size="sm" onClick={onLogout} aria-label="Logout user">
                Logout
              </Button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
