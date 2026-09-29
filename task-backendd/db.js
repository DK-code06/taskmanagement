// db.js
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config(); // Load .env variables

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 2000,
    });
    console.log("✅ MongoDB Connected");
  } catch (error) {
    console.warn("⚠️ Local MongoDB connection failed:", error.message);
    try {
      console.log("Attempting to start MongoMemoryServer fallback...");
      const { MongoMemoryServer } = require("mongodb-memory-server");
      const mongoServer = await MongoMemoryServer.create({
        binary: { version: "6.0.14" }
      });
      const uri = mongoServer.getUri();
      await mongoose.connect(uri);
      console.log(`✅ Connected to MongoMemoryServer at ${uri}`);
    } catch (fallbackError) {
      console.error("❌ Fallback MongoDB connection failed:", fallbackError.message);
      process.exit(1);
    }
  }
};

module.exports = connectDB;
