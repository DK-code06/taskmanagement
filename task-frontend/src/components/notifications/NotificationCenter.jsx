import React, { useState } from 'react';
import { Drawer } from '../ui/Drawer';
import { NotificationList } from './NotificationList';
import { NotificationPreferences } from './NotificationPreferences';

/**
 * NotificationCenter Component (M4.4)
 * Slide-over drawer providing unified access to notifications list & preference settings
 */
export const NotificationCenter = ({ isOpen, onClose, authAxios, onUnreadCountChange }) => {
  const [activeTab, setActiveTab] = useState('notifications'); // 'notifications' | 'preferences'

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      position="right"
      title="Notification Center"
      size="440px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 'var(--space-md)' }}>
        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--color-border)',
            gap: '1rem',
            paddingBottom: '0.5rem',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('notifications')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'notifications' ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: activeTab === 'notifications' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              fontWeight: activeTab === 'notifications' ? '600' : '500',
              padding: '0.5rem 0.25rem',
              cursor: 'pointer',
              fontSize: 'var(--font-size-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            🔔 Notifications
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preferences')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'preferences' ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: activeTab === 'preferences' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              fontWeight: activeTab === 'preferences' ? '600' : '500',
              padding: '0.5rem 0.25rem',
              cursor: 'pointer',
              fontSize: 'var(--font-size-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            ⚙️ Preferences
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ flexGrow: 1, overflowY: 'auto' }}>
          {activeTab === 'notifications' ? (
            <NotificationList authAxios={authAxios} onUnreadCountChange={onUnreadCountChange} />
          ) : (
            <NotificationPreferences authAxios={authAxios} />
          )}
        </div>
      </div>
    </Drawer>
  );
};
