const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Task = require("../models/Task");
const { isSameDayInTimezone } = require("../services/timezoneService");

// GET /api/leaderboard - Get top 10 users by points, with timezone-aware daily completions
router.get("/", async (req, res) => {
  try {
    const topUsers = await User.find({ deletedAt: null })
      .sort({ points: -1 })
      .limit(10)
      .select('_id username points streak timezone');

    const now = new Date();

    const leaderboardData = await Promise.all(
      topUsers.map(async (u) => {
        const userTz = u.timezone || 'UTC';

        // Find completed tasks owned or assigned to this user
        const completedTasks = await Task.find({
          $or: [{ user: u._id }, { assignedTo: u._id }],
          completed: true,
          completedAt: { $ne: null }
        }).select('completedAt');

        const dailyCompleted = completedTasks.filter((t) =>
          isSameDayInTimezone(t.completedAt, now, userTz)
        ).length;

        return {
          _id: u._id,
          username: u.username,
          points: u.points || 0,
          streak: u.streak || 0,
          dailyCompleted
        };
      })
    );

    res.json(leaderboardData);
  } catch (err) {
    console.error("Failed to fetch leaderboard:", err);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

module.exports = router;
