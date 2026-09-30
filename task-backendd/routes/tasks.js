const express = require("express");
const router = express.Router();
const Task = require("../models/Task");
const User = require("../models/User");
const RewardEvent = require("../models/RewardEvent");
const { authorizeTask, canAccessCategory } = require("../middleware/authorize");
const mongoose = require('mongoose');

module.exports = function(io) {

    // Helper to check if two dates are same day in local/UTC
    const isSameDay = (date1, date2) => {
        if (!date1 || !date2) return false;
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        return d1.getUTCFullYear() === d2.getUTCFullYear() &&
               d1.getUTCMonth() === d2.getUTCMonth() &&
               d1.getUTCDate() === d2.getUTCDate();
    };

    // Helper to check if date2 is consecutive day after date1
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

    // Helper to notify relevant user rooms
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

    // GET tasks for a specific category with authorization check
    router.get("/by-category/:categoryId", async (req, res) => {
      try {
        const { categoryId } = req.params;
        const accessCheck = await canAccessCategory(req.user.id, categoryId);
        if (!accessCheck.allowed) {
          if (accessCheck.reason === 'NOT_FOUND') return res.status(404).json({ error: "Category not found" });
          return res.status(403).json({ error: "Access denied for this category" });
        }

        const tasks = await Task.find({ category: categoryId, deletedAt: null })
          .populate('assignedTo', 'username')
          .populate('comments.user', 'username')
          .sort({ order: 1 });
        res.json(tasks);
      } catch (err) {
        console.error("Error fetching tasks:", err);
        res.status(500).json({ error: "Failed to fetch tasks" });
      }
    });

    // POST a new task with authorization check
    router.post("/", async (req, res) => {
      try {
        const { title, description = "", categoryId, dueDate, priority = 'No Priority', assignedTo = null, estimatedCompletionTime = 0 } = req.body;
        if (!title || !title.trim() || !categoryId) {
          return res.status(400).json({ error: "Title and categoryId are required" });
        }

        const accessCheck = await canAccessCategory(req.user.id, categoryId);
        if (!accessCheck.allowed) {
          if (accessCheck.reason === 'NOT_FOUND') return res.status(404).json({ error: "Category not found" });
          return res.status(403).json({ error: "Access denied for this category" });
        }

        const lastTask = await Task.findOne({ category: categoryId }).sort({ order: -1 });
        const newOrder = lastTask ? lastTask.order + 1 : 0;

        const task = new Task({
          title: title.trim(),
          description,
          order: newOrder,
          user: req.user.id,
          category: categoryId,
          dueDate: dueDate || null,
          priority,
          assignedTo: assignedTo || null,
          estimatedCompletionTime: estimatedCompletionTime || 0
        });
        await task.save();

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

        // Verify user has access to tasks being reordered
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
        const { title, description, dueDate, priority, status, assignedTo, estimatedCompletionTime } = req.body;
        const taskToUpdate = req.task;
        const updateFields = {};

        if (title !== undefined) updateFields.title = title.trim();
        if (description !== undefined) updateFields.description = description;
        if (dueDate !== undefined) updateFields.dueDate = dueDate;
        if (priority !== undefined) updateFields.priority = priority;
        if (assignedTo !== undefined) updateFields.assignedTo = assignedTo || null;
        if (estimatedCompletionTime !== undefined) updateFields.estimatedCompletionTime = estimatedCompletionTime;

        if (status !== undefined) {
          updateFields.status = status;
          updateFields.completed = (status === 'Done' || status === 'COMPLETED');

          if ((status === 'In Progress' || status === 'IN_PROGRESS') && !taskToUpdate.startedAt) {
            updateFields.startedAt = new Date();
          }
        }

        const isNowMarkedDone = (updateFields.completed && !taskToUpdate.completed);
        const rewardRecipientId = taskToUpdate.assignedTo || taskToUpdate.user;

        if (isNowMarkedDone) {
            updateFields.completedAt = new Date();

            // Idempotency check: award reward ONLY IF not already granted
            if (!taskToUpdate.rewardGranted) {
              try {
                let pointsToAdd = 10;
                if (taskToUpdate.dueDate && updateFields.completedAt <= new Date(taskToUpdate.dueDate)) {
                    pointsToAdd += 5;
                }

                const rewardRecipient = await User.findById(rewardRecipientId);
                if (rewardRecipient) {
                  const today = new Date();
                  const lastDate = rewardRecipient.lastCompletionDate;

                  if (isSameDay(today, lastDate)) {
                    // Same day completion: preserve streak counter
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

                  // Record unique RewardEvent to lock against concurrent duplicates
                  await RewardEvent.create({
                    taskId: taskToUpdate._id,
                    userId: rewardRecipient._id,
                    points: totalPoints,
                    reason: 'TASK_COMPLETION'
                  });

                  updateFields.rewardGranted = true;
                }
              } catch (rewardErr) {
                // Duplicate key error code 11000 indicates reward already granted concurrently
                if (rewardErr.code !== 11000) {
                  console.error("Error granting task reward:", rewardErr);
                }
              }
            }
        } else if (status && !updateFields.completed && taskToUpdate.completed) {
            updateFields.completedAt = null;
            // Note: points are NOT deducted upon reopen, and rewardGranted remains true to prevent double rewards
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
