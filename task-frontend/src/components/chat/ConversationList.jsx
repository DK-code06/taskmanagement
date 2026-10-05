import React from 'react';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';

/**
 * ConversationList Component (M4.4)
 * Renders list of friends/conversations with online status, unread counts, and task stats
 */
export const ConversationList = ({
  friends = [],
  activeFriendId = null,
  onSelectFriend,
  loading = false,
  notifications = [],
}) => {
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem' }}>
        <Spinner size="md" label="Loading conversations..." />
      </div>
    );
  }

  if (friends.length === 0) {
    return (
      <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
        No friends or active conversations yet. Add friends from the dashboard to start chatting!
      </div>
    );
  }

  return (
    <div className="conversation-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      {friends.map((item) => {
        const friendUser = item.user || item;
        const friendId = friendUser._id || friendUser.id;
        const isActive = activeFriendId === friendId;
        const unreadCount = item.unreadCount || 0;
        const hasLiveNotif = notifications.some((n) => (n.fromUser?._id || n.fromUser) === friendId && n.type === 'chat');

        return (
          <div
            key={friendId}
            onClick={() => onSelectFriend(friendUser)}
            tabIndex={0}
            role="button"
            aria-selected={isActive}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectFriend(friendUser);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: isActive ? 'var(--color-primary-light)' : 'var(--color-surface)',
              border: `1px solid ${isActive ? 'var(--color-primary-border)' : 'var(--color-border-subtle)'}`,
              cursor: 'pointer',
              transition: 'background-color var(--transition-fast)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Avatar name={friendUser.username} status="online" size="md" />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                  {friendUser.username}
                </strong>
                {item.dailyCompleted !== undefined && (
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    {item.dailyCompleted} tasks done today
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              {(unreadCount > 0 || hasLiveNotif) && (
                <Badge variant="danger" size="sm">
                  {unreadCount || 1}
                </Badge>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
