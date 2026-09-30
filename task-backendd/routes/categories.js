const express = require("express");
const router = express.Router();
const Category = require("../models/Category");
const Task = require("../models/Task");
const Team = require("../models/Team");
const { authorizeCategory } = require("../middleware/authorize");
const mongoose = require('mongoose');

// GET all categories (both personal and from the user's teams)
router.get("/", async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.user.id);

        const userTeams = await Team.find({ 'members.user': userId }).select('_id');
        const teamIds = userTeams.map(team => team._id);

        const categories = await Category.aggregate([
            {
                $match: {
                    $or: [
                        { ownerType: 'User', ownerId: userId },
                        { ownerType: 'Team', ownerId: { $in: teamIds } }
                    ]
                }
            },
            {
                $lookup: { from: 'tasks', localField: '_id', foreignField: 'category', as: 'tasks' }
            },
            {
                $addFields: {
                    totalTasks: { $size: '$tasks' },
                    completedTasks: {
                        $size: { $filter: { input: '$tasks', as: 'task', cond: { $eq: ['$$task.completed', true] } } }
                    }
                }
            },
            { $project: { tasks: 0 } },
            { $sort: { isPinned: -1, order: 1 } }
        ]);

        res.json(categories);
    } catch (err) {
        console.error("Error fetching categories:", err);
        res.status(500).json({ error: "Failed to fetch categories" });
    }
});

// POST a new category
router.post("/", async (req, res) => {
    const { name, ownerType, ownerId } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Category name is required" });
    if (!ownerType || !ownerId) return res.status(400).json({ error: "Owner is required" });

    try {
        if (ownerType === 'Team') {
            const team = await Team.findById(ownerId);
            if (!team) return res.status(404).json({ error: "Team not found." });
            if (!team.members.some(member => member.user.equals(req.user.id))) {
                return res.status(403).json({ error: "You are not a member of this team." });
            }
        } else if (ownerType === 'User' && ownerId !== req.user.id) {
             return res.status(403).json({ error: "You can only create personal categories for yourself." });
        }
        
        const categoryCount = await Category.countDocuments({ ownerId: ownerId });
        const newCategory = new Category({ name: name.trim(), ownerType, ownerId, order: categoryCount });
        await newCategory.save();

        const categoryForResponse = { ...newCategory.toObject(), totalTasks: 0, completedTasks: 0 };
        res.status(201).json(categoryForResponse);
    } catch (err) {
      console.error("❌ Error creating category:", err);
      res.status(500).json({ error: "Server error while creating category" });
    }
});

// DELETE category with authorization and safe team lookup
router.delete("/:id", authorizeCategory, async (req, res) => {
    try {
        const category = req.category;
        
        // Extra check if ownerType === 'Team' and team is missing
        if (category.ownerType === 'Team') {
            const team = await Team.findById(category.ownerId);
            if (!team) {
                // Team is missing; allow category deletion cleanly
            }
        }

        await Task.deleteMany({ category: category._id });
        await Category.findByIdAndDelete(category._id);
        
        res.json({ message: "Category and its tasks deleted successfully" });
    } catch (err) {
        console.error("Error deleting category:", err);
        res.status(500).json({ error: "Failed to delete category" });
    }
});

// PIN category with authorization
router.put("/:id/pin", authorizeCategory, async (req, res) => {
    try {
        const category = req.category;
        category.isPinned = !category.isPinned;
        await category.save();
        res.json(category);
    } catch (err) {
        console.error("Error pinning category:", err);
        res.status(500).json({ error: "Failed to update pin status" });
    }
});

// REORDER personal categories
router.put("/reorder", async (req, res) => {
    try {
        const { categories } = req.body;
        if (!Array.isArray(categories)) {
          return res.status(400).json({ error: "Invalid payload: 'categories' must be an array" });
        }

        const operations = categories.map(cat => ({
            updateOne: {
                filter: { _id: cat.id, ownerType: 'User', ownerId: req.user.id },
                update: { $set: { order: cat.order } }
            }
        }));
        if (operations.length > 0) {
            await Category.bulkWrite(operations);
        }
        res.json({ message: "Categories reordered successfully" });
    } catch (err) {
        console.error("Error reordering categories:", err);
        res.status(500).json({ error: "Failed to reorder categories" });
    }
});

module.exports = router;
