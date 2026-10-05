import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Spinner } from '../ui/Spinner';
import { EmptyState } from '../ui/EmptyState';

/**
 * LeaderboardWidget Component (M4.5-B)
 * Displays top ranked users based on authoritative backend points and daily task completion.
 */
export const LeaderboardWidget = ({ authAxios, currentUsername }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchLeaderboard = async () => {
      if (!authAxios) return;
      try {
        setLoading(true);
        const res = await authAxios.get('/leaderboard');
        if (isMounted) {
          setUsers(res.data || []);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Failed to fetch leaderboard:', err);
          setError('Failed to load leaderboard data.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchLeaderboard();
    return () => {
      isMounted = false;
    };
  }, [authAxios]);

  return (
    <Card className="leaderboard-widget-card" style={{ height: '100%' }}>
      <CardHeader style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          🥇 Community Leaderboard
        </h3>
        <Badge variant="info" size="sm">Top 10</Badge>
      </CardHeader>

      <CardBody>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem' }}>
            <Spinner size="md" label="Loading leaderboard..." />
          </div>
        ) : error ? (
          <div style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-xs)', padding: '0.5rem' }}>{error}</div>
        ) : users.length === 0 ? (
          <EmptyState title="No Leaderboard Data" description="Complete tasks to appear on the leaderboard!" icon="🏆" />
        ) : (
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {users.map((u, index) => {
              const isMe = u.username?.toLowerCase() === currentUsername?.toLowerCase();
              const rankBadge = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;

              return (
                <li
                  key={u._id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: isMe ? 'var(--color-bg-subtle)' : 'transparent',
                    border: isMe ? '1px solid var(--color-primary)' : '1px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontWeight: '700', width: '24px', fontSize: 'var(--font-size-sm)' }}>{rankBadge}</span>
                    <Avatar name={u.username} size="sm" />
                    <div>
                      <span style={{ fontWeight: isMe ? '700' : '500', fontSize: 'var(--font-size-sm)' }}>
                        {u.username}
                        {isMe && <span style={{ color: 'var(--color-primary)', fontSize: 'var(--font-size-xs)', marginLeft: '4px' }}>(You)</span>}
                      </span>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        {u.dailyCompleted || 0} completed today
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '700', fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)' }}>
                      {u.points || 0} pts
                    </div>
                    {u.streak > 0 && (
                      <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                        🔥 {u.streak}d
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardBody>
    </Card>
  );
};
