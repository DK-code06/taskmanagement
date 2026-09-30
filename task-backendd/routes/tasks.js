const express = require("express");
const router = express.Router();
const Task = require("../models/Task");
const Project = require("../models/Project");
const User = require("../models/User");
const RewardEvent = require("../models/RewardEvent");
const { authorizeTask, canAccessCategory, canAccessProject } = require("../middleware/authorize");
const { logActivityEvent } = require("../services/activityService");
const mongoose = require('mongoose');

module.exports = function(io) {

    const isSameDay = (date1, date2) => {
        if (!date1 || !date2) return false;
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        return d1.getUTCFullYear() === d2.getUTCFullYear() &&
               d1.getUTCMonth() === d2.getUTCMonth() &&
               d1.getUTCDate() === d2.getUTCDate();
    };

    const areConsecutiveDays = (date1, date2) => {
        if (!date1 || !date2) return false;
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        d1.setUTCHours(0, 0, 0, 0);
        d2.setUTCHours(0, 0, 0, 0);
        const diffTime = d1.getTime() - d2.getTime();
        const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
        return diffDays === 1;
    };

    const notifyTaskChange = (userIds, event = "taskUpdated", data = {}) => {
        const uniqueUsers = [...new Set(userIds.filter(Boolean).map(id => id.toString()))];
        uniqueUsers.forEach(uid => {
            io.to(`user:${uid}`).emit(event, data);
        });
    };

    // GET all tasks for the logged-in user or assigned to user
    router.get("/all", async (req, res) => {
      try {
        const tasks = await Task.find({
          $or: [
            { user: req.user.id },
            { assignedTo: req.user.id }
          ],
          deletedAt: null
        }).populate('assignedTo', 'username').populate('comments.user', 'username');
        res.json(tasks);
      } catch (err) {
        console.error("Error fetching all tasks:", err);
        res.status(500).json({ error: "Failed to fetch all tasks" });
      }
    });

    // GET tasks by Project ID
    router.get("/project/:projectId", async (req, res) => {
      try {
        const { projectId } = req.params;
        const projectCheck = await canAccessProject(req.user.id, projectId);
        if (!projectCheck.allowed) {
          return res.status(403).json({ error: "Access denied for this project" });
        }

        const tasks = await Task.find({ projectId, parentTaskId: null, deletedAt: null })
          .populate('assignedTo', 'username')
          .populate('comments.user', 'username')
          .sort({ order: 1 });
        res.json(tasks);
      } catch (err) {
        console.error("Error fetching project tasks:", err);
        res.status(500).json({ error: "Failed to fetch project tasks" });
      }
    });

    // GET subtasks for a parent task
    router.get("/:id/subtasks", authorizeTask, async (req, res) => {
      try {
        const parentTask = req.task;
        const subtasks = await Task.find({ parentTaskId: parentTask._id, deletedAt: null })
          .populate('assignedTo', 'username')
          .sort({ order: 1 });
        res.json(subtasks);
      } catch (err) {
        console.error("Error fetching subtasks:", err);
        res.status(500).json({ error: "Failed to fetch subtasks" });
      }
    });

    // POST a subtask under a parent task
    router.post("/:id/subtasks", authorizeTask, async (req, res) => {
      try {
        const parentTask = req.task;
        const { title, description = "", dueDate, priority = 'No Priority', assignedTo = null, estimatedMinutes = 0 } = req.body;
        
        if (!title || !title.trim()) {
          return res.status(400).json({ error: "Subtask title is required" });
        }

        const lastSubtask = await Task.findOne({ parentTaskId: parentTask._id }).sort({ order: -1 });
        const newOrder = lastSubtask ? lastSubtask.order + 1 : 0;

        const subtask = new Task({
          title: title.trim(),
          description,
          order: newOrder,
          user: req.user.id,
          parentTaskId: parentTask._id,
          projectId: parentTask.projectId || null,
          milestoneId: parentTask.milestoneId || null,
          category: parentTask.category || null,
          dueDate: dueDate || null,
          priority,
          assignedTo: assignedTo || null,
          estimatedMinutes: estimatedMinutes || 0
        });

        await subtask.save();

        await logActivityEvent({
          eventType: "SUBTASK_CREATED",
          actorId: req.user.id,
          projectId: parentTask.projectId,
          taskId: subtask._id,
          metadata: { parentTaskId: parentTask._id, title: subtask.title }
        });

        notifyTaskChange([req.user.id, assignedTo, parentTask.user], "subtaskCreated", subtask);

        res.status(201).json(subtask);
      } catch (err) {
        console.error("Error creating subtask:", err);
        res.status(500).json({ error: "Failed to create subtask" });
      }
    });

    // GET tasks for a specific category
    router.get("/by-category/:categoryId", async (req, res) => {
      try {
        const { categoryId } = req.params;
        const accessCheck = await canAccessCategory(req.user.id, categoryId);
        if (!accessCheck.allowed) {
          if (accessCheck.reason === 'NOT_FOUND') return res.status(404).json({ error: "Category not found" });
          return res.status(403).json({ error: "Access denied for this category" });
        }

        const tasks = await Task.find({ category: categoryId, parentTaskId: null, deletedAt: null })
          .populate('assignedTo', 'username')
          .populate('comments.user', 'username')
          .sort({ order: 1 });
        res.json(tasks);
      } catch (err) {
        console.error("Error fetching tasks:", err);
        res.status(500).json({ error: "Failed to fetch tasks" });
      }
    });

    // POST a new task
    router.post("/", async (req, res) => {
      try {
        const { title, description = "", categoryId, projectId, milestoneId, dueDate, priority = 'No Priority', assignedTo = null, estimatedMinutes = 0, estimatedCompletionTime = 0 } = req.body;
        if (!title || !title.trim()) {
          return res.status(400).json({ error: "Task title is required" });
        }

        let targetCategory = categoryId || null;
        let targetProject = projectId || null;

        if (targetCategory) {
          const accessCheck = await canAccessCategory(req.user.id, targetCategory);
          if (!accessCheck.allowed) {
            if (accessCheck.reason === 'NOT_FOUND') return res.status(404).json({ error: "Category not found" });
            return res.status(403).json({ error: "Access denied for this category" });
          }
          if (!targetProject) targetProject = targetCategory; // Legacy category mapped to project
        } else if (targetProject) {
          const projectCheck = await canAccessProject(req.user.id, targetProject);
          if (!projectCheck.allowed) {
            return res.status(403).json({ error: "Access denied for this project" });
          }
        } else if (!targetCategory && !targetProject) {
          let defaultProject = await Project.findOne({ name: "Personal Project", ownerType: "User", ownerId: req.user.id });
          if (!defaultProject) {
            defaultProject = new Project({
              name: "Personal Project",
              description: "Default project for personal tasks",
              ownerType: "User",
              ownerId: req.user.id,
              tags: ["Personal"],
              status: "ACTIVE",
              members: [{ user: req.user.id, role: "OWNER" }]
            });
            await defaultProject.save();
          }
          targetProject = defaultProject._id;
        }

        const queryFilter = targetCategory ? { category: targetCategory } : { projectId: targetProject };
        const lastTask = await Task.findOne(queryFilter).sort({ order: -1 });
        const newOrder = lastTask ? lastTask.order + 1 : 0;

        const task = new Task({
          title: title.trim(),
          description,
          order: newOrder,
          user: req.user.id,
          category: targetCategory,
          projectId: targetProject,
          milestoneId: milestoneId || null,
          dueDate: dueDate || null,
          priority,
          assignedTo: assignedTo || null,
          estimatedMinutes: estimatedMinutes || estimatedCompletionTime || 0
        });
        await task.save();

        await logActivityEvent({
          eventType: "TASK_CREATED",
          actorId: req.user.id,
          projectId: targetProject,
          milestoneId,
          taskId: task._id,
          metadata: { title: task.title, assignedTo }
        });

        const populatedTask = await Task.findById(task._id)
          .populate('assignedTo', 'username')
          .populate('comments.user', 'username');

        notifyTaskChange([req.user.id, assignedTo], "taskCreated", populatedTask);

        res.status(201).json(populatedTask);
      } catch (err) {
        console.error("Error creating task:", err);
        res.status(500).json({ error: "Failed to add task" });
      }
    });

    // POST a comment to a specific task
    router.post("/:taskId/comments", authorizeTask, async (req, res) => {
      try {
        const { content } = req.body;
        if (!content || !content.trim()) {
          return res.status(400).json({ error: "Comment content cannot be empty." });
        }

        const task = req.task;
        const newComment = { user: req.user.id, content: content.trim() };
        task.comments.push(newComment);
        await task.save();

        const populatedTask = await Task.findById(task._id)
            .populate('assignedTo', 'username')
            .populate('comments.user', 'username');

        notifyTaskChange([task.user, task.assignedTo], "commentAdded", populatedTask);

        res.status(201).json(populatedTask);
      } catch (err) {
        console.error("Error adding comment:", err);
        res.status(500).json({ error: "Failed to add comment." });
      }
    });
    
    // PUT to reorder tasks
    router.put("/reorder", async (req, res) => {
      try {
        const { tasks } = req.body;
        if (!Array.isArray(tasks)) {
          return res.status(400).json({ error: "Invalid payload: 'tasks' must be an array." });
        }

        const taskIds = tasks.map(t => t.id).filter(Boolean);
        const accessibleTasks = await Task.find({
          _id: { $in: taskIds },
          $or: [{ user: req.user.id }, { assignedTo: req.user.id }]
        }).select('_id');

        const accessibleSet = new Set(accessibleTasks.map(t => t._id.toString()));

        const operations = tasks
          .filter(t => accessibleSet.has(t.id))
          .map((task) => ({
            updateOne: {
              filter: { _id: task.id },
              update: { $set: { order: task.order } },
            },
          }));

        if (operations.length > 0) {
            await Task.bulkWrite(operations);
        }

        notifyTaskChange([req.user.id], "tasksReordered", { count: operations.length });

        res.json({ message: "Task order updated successfully" });
      } catch (err) {
        console.error("Error reordering tasks:", err);
        res.status(500).json({ error: "Failed to reorder tasks" });
      }
    });

    // PUT to update a single task by its ID
    router.put("/:id", authorizeTask, async (req, res) => {
      try {
        const { title, description, dueDate, priority, status, assignedTo, estimatedMinutes, estimatedCompletionTime } = req.body;
        const taskToUpdate = req.task;
        const updateFields = {};

        if (title !== undefined) updateFields.title = title.trim();
        if (description !== undefined) updateFields.description = description;
        if (dueDate !== undefined) {
          if (taskToUpdate.dueDate && new Date(dueDate).getTime() !== new Date(taskToUpdate.dueDate).getTime()) {
            await logActivityEvent({
              eventType: "TASK_DUE_DATE_CHANGED",
              actorId: req.user.id,
              projectId: taskToUpdate.projectId,
              taskId: taskToUpdate._id,
              metadata: { oldDueDate: taskToUpdate.dueDate, newDueDate: dueDate }
            });
          }
          updateFields.dueDate = dueDate;
        }

        if (priority !== undefined) updateFields.priority = priority;

        if (assignedTo !== undefined && assignedTo !== taskToUpdate.assignedTo?.toString()) {
          updateFields.assignedTo = assignedTo || null;
          await logActivityEvent({
            eventType: assignedTo ? "TASK_ASSIGNED" : "TASK_UNASSIGNED",
            actorId: req.user.id,
            projectId: taskToUpdate.projectId,
            taskId: taskToUpdate._id,
            metadata: { assignedTo }
          });
        }

        if (estimatedMinutes !== undefined || estimatedCompletionTime !== undefined) {
          updateFields.estimatedMinutes = estimatedMinutes || estimatedCompletionTime || 0;
        }

        if (status !== undefined) {
          updateFields.status = status;
          updateFields.completed = (status === 'Done' || status === 'COMPLETED');

          if ((status === 'In Progress' || status === 'IN_PROGRESS') && !taskToUpdate.startedAt) {
            updateFields.startedAt = new Date();
          }
        }

        const isNowMarkedDone = (updateFields.completed && !taskToUpdate.completed);

        if (isNowMarkedDone) {
            updateFields.completedAt = new Date();

            await logActivityEvent({
              eventType: taskToUpdate.parentTaskId ? "SUBTASK_COMPLETED" : "TASK_COMPLETED",
              actorId: req.user.id,
              projectId: taskToUpdate.projectId,
              taskId: taskToUpdate._id,
              metadata: { completedAt: updateFields.completedAt }
            });

            // Approved Reward Policy: Only assigned tasks receive completion rewards
            if (taskToUpdate.assignedTo && !taskToUpdate.rewardGranted) {
              try {
                let pointsToAdd = 10;
                if (taskToUpdate.dueDate && updateFields.completedAt <= new Date(taskToUpdate.dueDate)) {
                    pointsToAdd += 5;
                }

                const rewardRecipient = await User.findById(taskToUpdate.assignedTo);
                if (rewardRecipient) {
                  const today = new Date();
                  const lastDate = rewardRecipient.lastCompletionDate;

                  if (isSameDay(today, lastDate)) {
                    // Same day completion: preserve streak
                  } else if (areConsecutiveDays(today, lastDate)) {
                    rewardRecipient.streak = (rewardRecipient.streak || 0) + 1;
                  } else {
                    rewardRecipient.streak = 1;
                  }

                  rewardRecipient.lastCompletionDate = today;
                  const streakBonus = rewardRecipient.streak * 2;
                  const totalPoints = pointsToAdd + streakBonus;
                  rewardRecipient.points = (rewardRecipient.points || 0) + totalPoints;

                  await rewardRecipient.save();

                  await RewardEvent.create({
                    taskId: taskToUpdate._id,
                    userId: rewardRecipient._id,
                    points: totalPoints,
                    reason: 'TASK_COMPLETION'
                  });

                  updateFields.rewardGranted = true;
                }
              } catch (rewardErr) {
                if (rewardErr.code !== 11000) {
                  console.error("Error granting task reward:", rewardErr);
                }
              }
            }
        } else if (status && !updateFields.completed && taskToUpdate.completed) {
            updateFields.completedAt = null;

            await logActivityEvent({
              eventType: "TASK_REOPENED",
              actorId: req.user.id,
              projectId: taskToUpdate.projectId,
              taskId: taskToUpdate._id
            });
        }

        const updatedTask = await Task.findOneAndUpdate(
          { _id: taskToUpdate._id },
          { $set: updateFields },
          { new: true }
        ).populate('assignedTo', 'username').populate('comments.user', 'username');

        notifyTaskChange([taskToUpdate.user, taskToUpdate.assignedTo, updateFields.assignedTo], "taskUpdated", updatedTask);

        res.json(updatedTask);
      } catch (err) {
        console.error("Error updating task:", err);
        res.status(500).json({ error: "Failed to update task" });
      }
    });

    // GET /api/tasks/:id/subtasks - Get subtasks of a parent task
    router.get("/:id/subtasks", authorizeTask, async (req, res) => {
      try {
        const subtasks = await Task.find({
          parentTaskId: req.task._id,
          deletedAt: null
        }).sort({ order: 1, createdAt: 1 });

        res.json(subtasks);
      } catch (err) {
        console.error("Error fetching subtasks:", err);
        res.status(500).json({ error: "Failed to fetch subtasks" });
      }
    });

    // POST /api/tasks/:id/subtasks - Create a subtask under a parent task
    router.post("/:id/subtasks", authorizeTask, async (req, res) => {
      try {
        const { title, description = "", priority = "No Priority", assignedTo = null, estimatedMinutes = 0, dueDate = null } = req.body;
        if (!title || !title.trim()) {
          return res.status(400).json({ error: "Subtask title is required" });
        }

        const parentTask = req.task;

        const subtask = new Task({
          parentTaskId: parentTask._id,
          projectId: parentTask.projectId || null,
          milestoneId: parentTask.milestoneId || null,
          title: title.trim(),
          description: description.trim(),
          priority,
          assignedTo: assignedTo || null,
          user: req.user.id,
          estimatedMinutes: estimatedMinutes || 0,
          dueDate: dueDate || null,
          status: "READY"
        });

        await subtask.save();

        await logActivityEvent({
          eventType: "SUBTASK_CREATED",
          actorId: req.user.id,
          projectId: parentTask.projectId || null,
          milestoneId: parentTask.milestoneId || null,
          taskId: subtask._id,
          metadata: { title: subtask.title, parentTaskId: parentTask._id }
        });

        res.status(201).json(subtask);
      } catch (err) {
        console.error("Error creating subtask:", err);
        res.status(500).json({ error: "Failed to create subtask" });
      }
    });

    // DELETE a task
    router.delete("/:id", authorizeTask, async (req, res) => {
      try {
        const task = req.task;
        await Task.findByIdAndDelete(task._id);

        notifyTaskChange([task.user, task.assignedTo], "taskDeleted", { id: task._id });

        res.json({ message: "Task deleted successfully" });
      } catch (err) {
        res.status(500).json({ error: "Failed to delete task" });
      }
    });

    return router;
};
