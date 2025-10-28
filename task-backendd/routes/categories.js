const express = require("express");
const router = express.Router();
const Category = require("../models/Category");
const Task = require("../models/Task");
const Team = require("../models/Team");
const mongoose = require('mongoose');

// GET all categories (both personal and from the user's teams)
router.get("/", async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.user.id);

        // Find all teams the user is a member of
        const userTeams = await Team.find({ 'members.user': userId });
        const teamIds = userTeams.map(team => team._id);

        // Build the main query to find categories
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
      console.error("❌ Error in POST /categories route:", err);
      res.status(500).json({ error: "Server error while creating category" });
    }
});

// DELETE route with proper permission checks
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const category = await Category.findById(id);
        if (!category) {
            return res.status(404).json({ error: "Category not found" });
        }

        // Security Check
        let hasPermission = false;
        if (category.ownerType === 'User' && category.ownerId.equals(userId)) {
            hasPermission = true;
        } else if (category.ownerType === 'Team') {
            const team = await Team.findById(category.ownerId);
            const member = team.members.find(m => m.user.equals(userId));
            if (member) hasPermission = true;
        }

        if (!hasPermission) {
            return res.status(403).json({ error: "You do not have permission to delete this category." });
        }

        await Task.deleteMany({ category: id });
        await Category.findByIdAndDelete(id);
        
        res.json({ message: "Category and its tasks deleted successfully" });
    } catch (err) {
        console.error("Error deleting category:", err);
        res.status(500).json({ error: "Failed to delete category" });
    }
});

// PIN route with proper permission checks
router.put("/:id/pin", async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const category = await Category.findById(id);
        if (!category) {
            return res.status(404).json({ error: "Category not found" });
        }

        let hasPermission = false;
        if (category.ownerType === 'User' && category.ownerId.equals(userId)) {
            hasPermission = true;
        } else if (category.ownerType === 'Team') {
            const team = await Team.findById(category.ownerId);
            if (team && team.members.some(m => m.user.equals(userId))) {
                hasPermission = true;
            }
        }

        if (!hasPermission) {
            return res.status(403).json({ error: "You do not have permission to pin this category." });
        }
        
        category.isPinned = !category.isPinned;
        await category.save();
        res.json(category);
    } catch (err) {
        console.error("Error pinning category:", err);
        res.status(500).json({ error: "Failed to update pin status" });
    }
});

// REORDER route (Note: This only works for personal categories)
router.put("/reorder", async (req, res) => {
    try {
        const { categories } = req.body;
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

