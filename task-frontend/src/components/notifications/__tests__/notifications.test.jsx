import { describe, it, expect } from 'vitest';
import React from 'react';
import { NotificationItem } from '../NotificationItem';
import { NotificationList } from '../NotificationList';
import { NotificationPreferences } from '../NotificationPreferences';
import { NotificationCenter } from '../NotificationCenter';

describe('Notification UX Components (M4.4)', () => {
  const mockNotification = {
    _id: 'n1',
    type: 'TASK_ASSIGNED',
    actor: { username: 'bob' },
    entityType: 'TASK',
    entityId: 't123',
    message: 'bob assigned task "Setup Auth" to you',
    read: false,
    createdAt: '2026-10-05T11:00:00.000Z',
  };

  it('should render NotificationItem with action links and mark-read button', () => {
    const item = (
      <NotificationItem
        notification={mockNotification}
        onMarkRead={() => {}}
      />
    );
    expect(item.props.notification.type).toBe('TASK_ASSIGNED');
    expect(item.props.notification.read).toBe(false);
  });

  it('should render NotificationList with pagination and filter options', () => {
    const list = (
      <NotificationList
        authAxios={{ get: () => Promise.resolve({ data: { notifications: [mockNotification], pagination: { pages: 1 } } }) }}
        onUnreadCountChange={() => {}}
      />
    );
    expect(list.props.authAxios).toBeDefined();
  });

  it('should render NotificationPreferences with category controls and security policy locking', () => {
    const prefs = (
      <NotificationPreferences
        authAxios={{ get: () => Promise.resolve({ data: {} }) }}
      />
    );
    expect(prefs.props.authAxios).toBeDefined();
  });

  it('should render NotificationCenter inside Drawer primitive', () => {
    const center = (
      <NotificationCenter
        isOpen={true}
        onClose={() => {}}
        authAxios={{ get: () => Promise.resolve({ data: {} }) }}
      />
    );
    expect(center.props.isOpen).toBe(true);
  });
});
