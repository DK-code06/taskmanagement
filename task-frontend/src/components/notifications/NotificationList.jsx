import React, { useState, useEffect, useCallback } from 'react';
import { NotificationItem } from './NotificationItem';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { EmptyState } from '../ui/EmptyState';

/**
 * NotificationList Component (M4.4)
 * Paginated list of notifications with unread filtering & mark-all-read
 */
export const NotificationList = ({ authAxios, onUnreadCountChange }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!authAxios) return;
    setLoading(true);
    try {
      const res = await authAxios.get('/notifications', {
        params: { page, limit: 15, unreadOnly: unreadOnly ? 'true' : 'false' },
      });

      setNotifications(res.data.notifications || []);
      setTotalPages(res.data.pagination?.pages || 1);

      // Fetch unread count for badge synchronization
      const countRes = await authAxios.get('/notifications/unread-count');
      if (onUnreadCountChange) {
        onUnreadCountChange(countRes.data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch notifications list:', err);
    } finally {
      setLoading(false);
    }
  }, [authAxios, page, unreadOnly, onUnreadCountChange]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkRead = async (id) => {
    try {
      await authAxios.put(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
      const countRes = await authAxios.get('/notifications/unread-count');
      if (onUnreadCountChange) onUnreadCountChange(countRes.data.unreadCount || 0);
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await authAxios.put('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      if (onUnreadCountChange) onUnreadCountChange(0);
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="notification-list-container" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      {/* Action Controls Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <Button
          variant={unreadOnly ? 'primary' : 'outline'}
          size="sm"
          onClick={() => {
            setUnreadOnly((prev) => !prev);
            setPage(1);
          }}
        >
          {unreadOnly ? 'Show All' : 'Unread Only'}
        </Button>

        <Button variant="ghost" size="sm" onClick={handleMarkAllRead} loading={markingAll}>
          ✓ Mark All Read
        </Button>
      </div>

      {/* List / Loading / Empty */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <Spinner size="lg" label="Loading notifications..." />
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          title={unreadOnly ? 'No Unread Notifications' : 'No Notifications'}
          description={unreadOnly ? 'You are all caught up!' : 'New task assignments, updates, and reminders will appear here.'}
          icon="🔔"
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {notifications.map((n) => (
            <NotificationItem key={n._id} notification={n} onMarkRead={handleMarkRead} />
          ))}
        </div>
      )}

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: 'var(--space-md)' }}>
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ← Previous
          </Button>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next →
          </Button>
        </div>
      )}
    </div>
  );
};
