import React from 'react';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Badge } from '../ui/Badge';

/**
 * GamificationSummary Component (M4.5-B)
 * Displays authoritative user points, active streak, and task completion metrics.
 */
export const GamificationSummary = ({ user, stats }) => {
  const points = user?.points || 0;
  const streak = user?.streak || 0;
  const totalCompleted = stats?.totalCompleted || 0;

  return (
    <Card className="gamification-summary-card" style={{ height: '100%' }}>
      <CardHeader style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          🏆 Productivity & Gamification
        </h3>
        <Badge variant={streak > 0 ? 'success' : 'neutral'} size="sm">
          🔥 {streak} Day Streak
        </Badge>
      </CardHeader>

      <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '0.75rem',
            textAlign: 'center',
          }}
        >
          <div style={{ backgroundColor: 'var(--color-bg-subtle)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-primary)' }}>{points}</span>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>Total Points</div>
          </div>

          <div style={{ backgroundColor: 'var(--color-bg-subtle)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-success, #10b981)' }}>{streak}</span>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>Current Streak</div>
          </div>

          <div style={{ backgroundColor: 'var(--color-bg-subtle)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-text)' }}>{totalCompleted}</span>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>Completed</div>
          </div>
        </div>

        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
          💡 <strong>Reward Policy:</strong> Complete assigned tasks to earn 10 points (+5 for early completion) and maintain your daily streak bonus!
        </div>
      </CardBody>
    </Card>
  );
};
