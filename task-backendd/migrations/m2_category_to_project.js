const mongoose = require("mongoose");
const Category = require("../models/Category");
const Project = require("../models/Project");
const Milestone = require("../models/Milestone");
const Task = require("../models/Task");
const User = require("../models/User");
const Team = require("../models/Team");
const Message = require("../models/Message");

async function runMigration({ dryRun = false } = {}) {
  console.log(`🚀 Starting M2 Migration (Category -> Project/Tag)... [Dry Run: ${dryRun}]`);

  // 1. Pre-Migration Data Counts
  const countsBefore = {
    users: await User.countDocuments(),
    teams: await Team.countDocuments(),
    categories: await Category.countDocuments(),
    tasks: await Task.countDocuments(),
    messages: await Message.countDocuments()
  };

  console.log("📊 Pre-Migration Document Counts:", countsBefore);

  const categories = await Category.find({});
  const migrationResults = {
    projectsCreated: 0,
    milestonesCreated: 0,
    tasksUpdated: 0,
    categoryTagMappings: []
  };

  for (const category of categories) {
    // Idempotency check: see if matching Project already exists
    let project = await Project.findOne({
      name: category.name,
      ownerType: category.ownerType,
      ownerId: category.ownerId
    });

    if (!project) {
      if (!dryRun) {
        project = new Project({
          _id: category._id, // Preserve legacy Category _id as Project _id
          name: category.name,
          description: `Migrated from Category "${category.name}"`,
          ownerType: category.ownerType,
          ownerId: category.ownerId,
          tags: [category.name],
          status: "ACTIVE"
        });
        await project.save();
      }
      migrationResults.projectsCreated++;
    }

    // Ensure a default "General" Milestone exists for this Project
    const projectId = project ? project._id : category._id;
    let milestone = await Milestone.findOne({ projectId, title: "General" });
    if (!milestone) {
      if (!dryRun) {
        milestone = new Milestone({
          projectId,
          title: "General",
          description: "Default milestone created during data migration",
          order: 0,
          status: "IN_PROGRESS"
        });
        await milestone.save();
      }
      migrationResults.milestonesCreated++;
    }

    const milestoneId = milestone ? milestone._id : null;

    // Update Tasks referencing this legacy Category
    const matchingTasks = await Task.find({ category: category._id });
    if (!dryRun) {
      for (const task of matchingTasks) {
        task.projectId = projectId;
        if (!task.milestoneId && milestoneId) {
          task.milestoneId = milestoneId;
        }
        if (!task.tags || !task.tags.includes(category.name)) {
          task.tags = task.tags || [];
          task.tags.push(category.name);
        }
        // Retain timing migration: map estimatedMinutes if estimatedCompletionTime exists
        if (task.estimatedCompletionTime && (!task.estimatedMinutes || task.estimatedMinutes === 0)) {
          task.estimatedMinutes = task.estimatedCompletionTime;
        }
        await task.save();
      }
    }
    migrationResults.tasksUpdated += matchingTasks.length;

    migrationResults.categoryTagMappings.push({
      categoryId: category._id.toString(),
      categoryName: category.name,
      projectId: projectId.toString(),
      tagAdded: category.name,
      tasksMigrated: matchingTasks.length
    });
  }

  // Handle tasks without a legacy category: assign them to a default General Project
  const orphanTasks = await Task.find({ category: null, projectId: null });
  for (const task of orphanTasks) {
    if (!task.user) continue;
    let defaultProject = await Project.findOne({ name: "General Project", ownerType: "User", ownerId: task.user });
    if (!defaultProject) {
      if (!dryRun) {
        defaultProject = new Project({
          name: "General Project",
          description: "Default project for uncategorized tasks",
          ownerType: "User",
          ownerId: task.user,
          tags: ["General"],
          status: "ACTIVE"
        });
        await defaultProject.save();
      }
      migrationResults.projectsCreated++;
    }

    const pId = defaultProject ? defaultProject._id : null;
    let defaultMilestone = await Milestone.findOne({ projectId: pId, title: "General" });
    if (!defaultMilestone && pId) {
      if (!dryRun) {
        defaultMilestone = new Milestone({
          projectId: pId,
          title: "General",
          description: "Default milestone",
          order: 0,
          status: "IN_PROGRESS"
        });
        await defaultMilestone.save();
      }
      migrationResults.milestonesCreated++;
    }

    if (!dryRun && defaultProject) {
      task.projectId = defaultProject._id;
      if (defaultMilestone) task.milestoneId = defaultMilestone._id;
      await task.save();
    }
    migrationResults.tasksUpdated++;
  }

  // 2. Post-Migration Verification Counts
  const countsAfter = {
    users: await User.countDocuments(),
    teams: await Team.countDocuments(),
    categories: await Category.countDocuments(),
    projects: await Project.countDocuments(),
    milestones: await Milestone.countDocuments(),
    tasks: await Task.countDocuments(),
    messages: await Message.countDocuments()
  };

  console.log("📊 Post-Migration Document Counts:", countsAfter);

  // Integrity Assertion
  const integrity = {
    usersPreserved: countsBefore.users === countsAfter.users,
    teamsPreserved: countsBefore.teams === countsAfter.teams,
    tasksPreserved: countsBefore.tasks === countsAfter.tasks,
    messagesPreserved: countsBefore.messages === countsAfter.messages,
    allTasksHaveProject: dryRun ? true : (await Task.countDocuments({ projectId: { $ne: null } })) === countsAfter.tasks
  };

  console.log("✅ Data Integrity Verification:", integrity);

  return {
    success: integrity.usersPreserved && integrity.teamsPreserved && integrity.tasksPreserved && integrity.allTasksHaveProject,
    dryRun,
    countsBefore,
    countsAfter,
    migrationResults,
    integrity
  };
}

// Allow direct CLI execution: `node migrations/m2_category_to_project.js [--dry-run]`
if (require.main === module) {
  const isDryRun = process.argv.includes("--dry-run");
  const connectDB = require("../db");
  connectDB().then(async () => {
    try {
      const result = await runMigration({ dryRun: isDryRun });
      console.log("🎉 Migration Summary:", JSON.stringify(result, null, 2));
      process.exit(0);
    } catch (err) {
      console.error("❌ Migration failed:", err);
      process.exit(1);
    }
  });
}

module.exports = { runMigration };
