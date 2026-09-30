const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const connectDB = async () => {
  // If already connected or connecting, do not reconnect
  if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
    return;
  }

  const isProd = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/taskdb-users';

  // In test environment, skip connectDB because setup.js manages MongoMemoryServer
  if (isTest) {
    return;
  }

  try {
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 3000,
    });
    console.log("✅ MongoDB Connected");
  } catch (error) {
    console.warn("⚠️ Primary MongoDB connection failed:", error.message);
    
    if (isProd) {
      console.error("❌ Production DB connection failed. Exiting process.");
      process.exit(1);
    }

    try {
      console.log("Attempting to start MongoMemoryServer fallback for development...");
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
