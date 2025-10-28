// updateListDate.js
const mongoose = require("mongoose");
const Task = require("./models/Task");

(async () => {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/taskdb");
    console.log("✅ Connected to MongoDB");

    // Update tasks missing listDate → set to createdAt
    const result = await Task.updateMany(
      { listDate: { $exists: false } },
      [
        { $set: { listDate: "$createdAt" } } // MongoDB aggregation pipeline update
      ]
    );

    console.log(`✅ Updated ${result.modifiedCount} tasks with listDate`);
  } catch (err) {
    console.error("❌ Migration failed:", err);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
})();
