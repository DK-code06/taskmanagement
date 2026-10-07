const mongoose = require("mongoose");
const dotenv = require("dotenv");
const dns = require("dns");

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
      serverSelectionTimeoutMS: 5000,
    });
    console.log("✅ MongoDB Connected");
  } catch (error) {
    console.warn("⚠️ Primary MongoDB connection attempt failed:", error.message);

    // If SRV lookup failed due to local ISP/router DNS restrictions, configure public DNS servers and retry
    if (error.message.includes('querySrv') || error.message.includes('ECONNREFUSED')) {
      try {
        console.log("🔄 Retrying connection using public DNS servers (8.8.8.8, 1.1.1.1)...");
        dns.setServers(['8.8.8.8', '1.1.1.1']);
        await mongoose.connect(mongoUri, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          serverSelectionTimeoutMS: 5000,
        });
        console.log("✅ MongoDB Connected via Public DNS");
        return;
      } catch (retryErr) {
        console.warn("⚠️ DNS retry connection failed:", retryErr.message);
      }
    }

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
