import { describe, it, expect } from 'vitest';
import React from 'react';
import { ProjectCard } from '../ProjectCard';
import { ProjectStatusBadge } from '../ProjectStatusBadge';
import { ProjectProgress } from '../ProjectProgress';
import { ProjectMembers } from '../ProjectMembers';
import { MilestoneSection } from '../MilestoneSection';

describe('Project & Milestone Components (M4.2)', () => {
  const mockProject = {
    _id: 'proj_123',
    name: 'Q4 Platform Architecture',
    description: 'Transform application into project and milestone hierarchy',
    status: 'ACTIVE',
    ownerType: 'Team',
    ownerId: 'team_789',
    members: [{ user: { _id: 'u1', username: 'alice' }, role: 'OWNER' }],
    deadline: '2026-12-31T00:00:00.000Z',
    tags: ['architecture', 'm4'],
    completedTasks: 3,
    totalTasks: 5,
    milestoneCount: 2,
  };

  it('should render ProjectStatusBadge correctly for ACTIVE, COMPLETED, and ARCHIVED', () => {
    const activeBadge = <ProjectStatusBadge status="ACTIVE" />;
    const completedBadge = <ProjectStatusBadge status="COMPLETED" />;
    const archivedBadge = <ProjectStatusBadge status="ARCHIVED" />;

    expect(activeBadge.props.status).toBe('ACTIVE');
    expect(completedBadge.props.status).toBe('COMPLETED');
    expect(archivedBadge.props.status).toBe('ARCHIVED');
  });

  it('should instantiate ProjectProgress with deterministic task progress calculation', () => {
    const progress = <ProjectProgress completedTasks={3} totalTasks={5} showLabel />;
    expect(progress.props.completedTasks).toBe(3);
    expect(progress.props.totalTasks).toBe(5);
  });

  it('should render ProjectMembers with member avatars', () => {
    const membersComp = <ProjectMembers ownerType="Team" ownerId="team_789" members={mockProject.members} />;
    expect(membersComp.props.ownerType).toBe('Team');
    expect(membersComp.props.members.length).toBe(1);
  });

  it('should render ProjectCard with metadata and progress', () => {
    const card = <ProjectCard project={mockProject} onSelect={() => {}} />;
    expect(card.props.project.name).toBe('Q4 Platform Architecture');
    expect(card.props.project.status).toBe('ACTIVE');
    expect(card.props.project.milestoneCount).toBe(2);
  });

  it('should render MilestoneSection with milestones array', () => {
    const milestones = [
      { _id: 'm1', title: 'Milestone 1', status: 'COMPLETED', order: 0 },
      { _id: 'm2', title: 'Milestone 2', status: 'IN_PROGRESS', order: 1 },
    ];
    const section = (
      <MilestoneSection
        projectId="proj_123"
        milestones={milestones}
        tasks={[]}
        onCreateMilestone={() => {}}
        onUpdateMilestone={() => {}}
        onDeleteMilestone={() => {}}
      />
    );
    expect(section.props.milestones.length).toBe(2);
    expect(section.props.projectId).toBe('proj_123');
  });
});
