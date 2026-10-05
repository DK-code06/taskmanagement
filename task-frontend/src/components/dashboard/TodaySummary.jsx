import React from 'react';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Progress } from '../ui/Progress';

/**
 * TodaySummary Component (M4.5-B)
 * Displays task productivity progress for the current day.
 */
export const TodaySummary = ({ tasks = [] }) => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  let dueTodayCount = 0;
  let completedTodayCount = 0;
  let overdueCount = 0;
  let totalTodayTarget = 0;

  tasks.forEach((t) => {
    const isCompleted = t.completed || t.status === 'Done';

    if (t.dueDate) {
      const dueStr = new Date(t.dueDate).toISOString().split('T')[0];
      if (dueStr === todayStr) {
        dueTodayCount++;
        totalTodayTarget++;
        if (isCompleted) completedTodayCount++;
      } else if (new Date(t.dueDate) < now && !isCompleted) {
        overdueCount++;
      }
    } else if (isCompleted && t.completedAt) {
      const compStr = new Date(t.completedAt).toISOString().split('T')[0];
      if (compStr === todayStr) {
        completedTodayCount++;
        totalTodayTarget++;
      }
    }
  });

  const completionPct = totalTodayTarget > 0 ? (completedTodayCount / totalTodayTarget) * 100 : 0;

  return (
    <Card className="today-summary-card" style={{ height: '100%' }}>
      <CardHeader>
        <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          📅 Today's Focus
        </h3>
      </CardHeader>

      <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: 'var(--font-size-xs)' }}>
            <span style={{ color: 'var(--color-text-secondary)', fontWeight: '500' }}>Daily Completion Goal</span>
            <span style={{ fontWeight: '600' }}>{completedTodayCount} of {totalTodayTarget || completedTodayCount} tasks</span>
          </div>
          <Progress value={completionPct} max={100} showLabel size="md" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
          <div style={{ padding: '0.5rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--color-primary)' }}>{dueTodayCount}</span>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Due Today</div>
          </div>

          <div style={{ padding: '0.5rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--color-success, #10b981)' }}>{completedTodayCount}</span>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Done Today</div>
          </div>

          <div style={{ padding: '0.5rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: '700', color: overdueCount > 0 ? 'var(--color-danger, #ef4444)' : 'var(--color-text-muted)' }}>
              {overdueCount}
            </span>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Overdue</div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};
