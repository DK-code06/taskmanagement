const express = require("express");
const router = express.Router();
const Task = require("../models/Task");
const User = require("../models/User");
const mongoose = require('mongoose');

// ✅ Intha file ippo 'io' object ah vaangura oru function ah export pannum
module.exports = function(io) {

    // Helper function
    const areConsecutiveDays = (date1, date2) => {
        if (!date1 || !date2) return false;
        const oneDay = 24 * 60 * 60 * 1000;
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        d1.setHours(0, 0, 0, 0);
        d2.setHours(0, 0, 0, 0);
        const diffDays = Math.round(Math.abs((d1 - d2) / oneDay));
        return diffDays === 1;
    };

    // GET all tasks for the logged-in user (for global alerts)
    router.get("/all", async (req, res) => {
      try {
        const tasks = await Task.find({ user: req.user.id });
        res.json(tasks);
      } catch (err) {
        console.error("Error fetching all tasks:", err);
        res.status(500).json({ error: "Failed to fetch all tasks" });
      }
    });

    // GET tasks for a specific category
    router.get("/by-category/:categoryId", async (req, res) => {
      try {
        const { categoryId } = req.params;
        const tasks = await Task.find({ category: categoryId })
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
        const { title, description = "", categoryId, dueDate, priority = 'No Priority', assignedTo = null } = req.body;
        if (!title || !title.trim() || !categoryId) {
          return res.status(400).json({ error: "Title and categoryId are required" });
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
          priority: priority,
          assignedTo: assignedTo || null,
        });
        await task.save();
        
        io.emit("tasksUpdated"); // ✅ Notify clients

        const populatedTask = await Task.findById(task._id).populate('assignedTo', 'username');
        res.status(201).json(populatedTask);
      } catch (err) {
        console.error("Error creating task:", err);
        res.status(500).json({ error: "Failed to add task" });
      }
    });

    // POST a comment to a specific task
    router.post("/:taskId/comments", async (req, res) => {
      try {
        const { taskId } = req.params;
        const { content } = req.body;
        if (!content || !content.trim()) {
          return res.status(400).json({ error: "Comment content cannot be empty." });
        }
        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ error: "Task not found." });
        const newComment = { user: req.user.id, content: content.trim() };
        task.comments.push(newComment);
        await task.save();

        io.emit("tasksUpdated"); // ✅ Notify clients
        
        const populatedTask = await Task.findById(taskId)
            .populate('assignedTo', 'username')
            .populate('comments.user', 'username');
        res.status(201).json(populatedTask);
      } catch (err) {
        console.error("Error adding comment:", err);
        res.status(500).json({ error: "Failed to add comment." });
      }
    });
    
    // PUT to reorder tasks - This route must come BEFORE the general '/:id' route
    router.put("/reorder", async (req, res) => {
      try {
        const { tasks } = req.body;
        if (!Array.isArray(tasks)) {
          return res.status(400).json({ error: "Invalid payload: 'tasks' must be an array." });
        }
        const operations = tasks.map((task) => ({
          updateOne: {
            filter: { _id: task.id },
            update: { $set: { order: task.order } },
          },
        }));
        if (operations.length > 0) {
            await Task.bulkWrite(operations);
        }

        io.emit("tasksUpdated"); // ✅ Notify clients

        res.json({ message: "Task order updated successfully" });
      } catch (err) {
        console.error("Error reordering tasks:", err);
        res.status(500).json({ error: "Failed to reorder tasks" });
      }
    });

    // PUT to update a single task by its ID
    router.put("/:id", async (req, res) => {
      try {
        const { title, description, dueDate, priority, status, assignedTo, estimatedCompletionTime } = req.body;
        const updateFields = {};
        
        if (title !== undefined) updateFields.title = title;
        if (description !== undefined) updateFields.description = description;
        if (dueDate !== undefined) updateFields.dueDate = dueDate;
        if (priority !== undefined) updateFields.priority = priority;
        if (assignedTo !== undefined) updateFields.assignedTo = assignedTo || null;
        
        const taskToUpdate = await Task.findOne({ _id: req.params.id });
        if (!taskToUpdate) return res.status(404).json({ error: "Task not found" });
        
        if (status !== undefined) {
          updateFields.status = status;
          updateFields.completed = (status === 'Done');
          if (status === 'In Progress' && !taskToUpdate.startedAt) {
            updateFields.startedAt = new Date();
            if (estimatedCompletionTime !== undefined) {
                updateFields.estimatedCompletionTime = estimatedCompletionTime;
            }
          }
        }

        const isNowMarkedDone = (updateFields.status === 'Done' && taskToUpdate.status !== 'Done');
        if (isNowMarkedDone) {
            updateFields.completedAt = new Date();
            const user = await User.findById(req.user.id);
            
            let pointsToAdd = 10;
            if (taskToUpdate.dueDate && updateFields.completedAt <= new Date(taskToUpdate.dueDate)) {
                pointsToAdd += 5;
            }
            const today = new Date();
            if (areConsecutiveDays(today, user.lastCompletionDate)) {
                user.streak = (user.streak || 0) + 1;
            } else {
                user.streak = 1;
            }
            user.lastCompletionDate = today;
            user.points += pointsToAdd + (user.streak * 2);
            await user.save();
        } else if (status && status !== 'Done' && taskToUpdate.status === 'Done') {
            updateFields.completedAt = null;
        }

        const updatedTask = await Task.findOneAndUpdate(
          { _id: req.params.id },
          { $set: updateFields },
          { new: true }
        ).populate('assignedTo', 'username').populate('comments.user', 'username');

        io.emit("tasksUpdated"); // ✅ Notify clients

        res.json(updatedTask);
      } catch (err) {
        console.error("Error updating task:", err);
        res.status(500).json({ error: "Failed to update task" });
      }
    });

    // DELETE a task
    router.delete("/:id", async (req, res) => {
      try {
        const deletedTask = await Task.findOneAndDelete({ _id: req.params.id });
        if (!deletedTask) return res.status(404).json({ error: "Task not found" });

        io.emit("tasksUpdated"); // ✅ Notify clients
        
        res.json({ message: "Task deleted successfully" });
      } catch (err) {
        res.status(500).json({ error: "Failed to delete task" });
      }
    });

    return router;
};

