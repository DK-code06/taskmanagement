const Category = require('../models/Category');
const Project = require('../models/Project');
const Milestone = require('../models/Milestone');
const Task = require('../models/Task');
const User = require('../models/User');
const Team = require('../models/Team');
const Message = require('../models/Message');
const { runMigration } = require('../migrations/m2_category_to_project');

require('./setup');

describe('M2 Category -> Project/Tag Data Migration Engine Tests', () => {
  let user, team, category1, category2, task1, task2, unassignedTask;

  beforeEach(async () => {
    // Seed test database with legacy structure
    user = new User({ username: 'migrationuser', password: 'password123' });
    await user.save();

    team = new Team({ name: 'Migration Team', createdBy: user._id, members: [{ user: user._id, role: 'Admin' }] });
    await team.save();

    category1 = new Category({
      name: 'Frontend Work',
      ownerType: 'User',
      ownerId: user._id
    });
    await category1.save();

    category2 = new Category({
      name: 'Team Infrastructure',
      ownerType: 'Team',
      ownerId: team._id
    });
    await category2.save();

    task1 = new Task({
      title: 'Fix UI Bug',
      user: user._id,
      category: category1._id,
      assignedTo: user._id,
      estimatedCompletionTime: 120
    });
    await task1.save();

    task2 = new Task({
      title: 'Setup CI/CD',
      user: user._id,
      category: category2._id,
      assignedTo: user._id,
      estimatedCompletionTime: 60
    });
    await task2.save();

    unassignedTask = new Task({
      title: 'Unassigned Task Without Category',
      user: user._id
    });
    await unassignedTask.save();

    // Create a message to verify message preservation
    const msg = new Message({ fromUser: user._id, toUser: user._id, content: 'Test message' });
    await msg.save();
  });

  it('should run dry-run migration without modifying documents', async () => {
    const res = await runMigration({ dryRun: true });

    expect(res.success).toBe(true);
    expect(res.dryRun).toBe(true);

    const projectCount = await Project.countDocuments();
    expect(projectCount).toEqual(0);

    const milestoneCount = await Milestone.countDocuments();
    expect(milestoneCount).toEqual(0);

    const task1After = await Task.findById(task1._id);
    expect(task1After.projectId).toBeFalsy();
  });

  it('should perform full live migration preserving user/team/task/message counts and mapping categories to projects & tags', async () => {
    const res = await runMigration({ dryRun: false });

    expect(res.success).toBe(true);
    expect(res.dryRun).toBe(false);

    // Verify Project creation & ID preservation
    const proj1 = await Project.findById(category1._id);
    expect(proj1).not.toBeNull();
    expect(proj1.name).toEqual('Frontend Work');
    expect(proj1.ownerType).toEqual('User');
    expect(proj1.ownerId.toString()).toEqual(user._id.toString());
    expect(proj1.tags).toContain('Frontend Work');

    const proj2 = await Project.findById(category2._id);
    expect(proj2).not.toBeNull();
    expect(proj2.name).toEqual('Team Infrastructure');
    expect(proj2.ownerType).toEqual('Team');

    // Verify Milestone creation
    const ms1 = await Milestone.findOne({ projectId: proj1._id, title: 'General' });
    expect(ms1).not.toBeNull();

    // Verify Task updates
    const t1 = await Task.findById(task1._id);
    expect(t1.projectId.toString()).toEqual(proj1._id.toString());
    expect(t1.milestoneId.toString()).toEqual(ms1._id.toString());
    expect(t1.tags).toContain('Frontend Work');
    expect(t1.estimatedMinutes).toEqual(120);

    // Data counts integrity check
    expect(res.countsBefore.users).toEqual(res.countsAfter.users);
    expect(res.countsBefore.teams).toEqual(res.countsAfter.teams);
    expect(res.countsBefore.tasks).toEqual(res.countsAfter.tasks);
    expect(res.countsBefore.messages).toEqual(res.countsAfter.messages);
  });

  it('should be fully idempotent when run multiple times', async () => {
    // Run migration twice
    await runMigration({ dryRun: false });
    const secondRun = await runMigration({ dryRun: false });

    expect(secondRun.success).toBe(true);
    expect(secondRun.migrationResults.projectsCreated).toEqual(0);
    expect(secondRun.migrationResults.milestonesCreated).toEqual(0);

    const projectCount = await Project.countDocuments();
    expect(projectCount).toEqual(3);
  });
});
