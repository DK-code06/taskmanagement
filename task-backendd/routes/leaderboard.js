const express = require("express");
const router = express.Router();
const User = require("../models/User");

// GET /api/leaderboard - Get top 10 users, including their daily progress
router.get("/", async (req, res) => {
  try {
    // Get the start and end of the current day in the server's timezone
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const topUsers = await User.aggregate([
      // 1. Join with the tasks collection to get all tasks for each user
      {
        $lookup: {
          from: 'tasks', // The name of the tasks collection
          localField: '_id',
          foreignField: 'user',
          as: 'tasks'
        }
      },
      // 2. Reshape the data and calculate daily completions
      {
        $project: {
          username: 1,
          points: 1,
          dailyCompleted: {
            $size: {
              $filter: {
                input: '$tasks',
                as: 'task',
                cond: {
                  $and: [
                    { $eq: ['$$task.completed', true] },
                    { $gte: ['$$task.completedAt', startOfDay] },
                    { $lte: ['$$task.completedAt', endOfDay] }
                  ]
                }
              }
            }
          }
        }
      },
      // 3. Sort by total points in descending order
      { $sort: { points: -1 } },
      // 4. Limit to the top 10 users
      { $limit: 10 }
    ]);

    res.json(topUsers);
  } catch (err) {
    console.error("Failed to fetch leaderboard:", err);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

module.exports = router;
