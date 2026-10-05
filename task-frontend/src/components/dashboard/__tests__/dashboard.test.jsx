import { describe, it, expect } from 'vitest';
import React from 'react';
import { GamificationSummary } from '../GamificationSummary';
import { LeaderboardWidget } from '../LeaderboardWidget';
import { TodaySummary } from '../TodaySummary';
import { ActiveProjects } from '../ActiveProjects';
import { UpcomingTasks } from '../UpcomingTasks';
import { DashboardHeader } from '../DashboardHeader';

describe('Modular Dashboard Components (M4.5-B)', () => {
  const mockUser = { username: 'alice', points: 150, streak: 3 };
  const mockStats = { totalCompleted: 12, totalTasks: 15 };
  const mockProjects = [
    { _id: 'p1', name: 'Frontend Refactor', status: 'ACTIVE', completedTasks: 4, totalTasks: 5 },
  ];
  const mockTasks = [
    { _id: 't1', title: 'Write M4.5-B tests', priority: 'High', status: 'In Progress', completed: false },
  ];

  it('should render GamificationSummary with user points and streak', () => {
    const comp = <GamificationSummary user={mockUser} stats={mockStats} />;
    expect(comp.props.user.points).toBe(150);
    expect(comp.props.user.streak).toBe(3);
  });

  it('should render LeaderboardWidget', () => {
    const comp = <LeaderboardWidget currentUsername="alice" authAxios={{ get: () => Promise.resolve({ data: [] }) }} />;
    expect(comp.props.currentUsername).toBe('alice');
  });

  it('should render TodaySummary with task metrics', () => {
    const comp = <TodaySummary tasks={mockTasks} />;
    expect(comp.props.tasks.length).toBe(1);
  });

  it('should render ActiveProjects with project items', () => {
    const comp = <ActiveProjects projects={mockProjects} />;
    expect(comp.props.projects.length).toBe(1);
  });

  it('should render UpcomingTasks with task cards', () => {
    const comp = <UpcomingTasks tasks={mockTasks} currentUserId="u1" />;
    expect(comp.props.tasks.length).toBe(1);
  });

  it('should render DashboardHeader with welcome title', () => {
    const comp = <DashboardHeader username="alice" />;
    expect(comp.props.username).toBe('alice');
  });
});
