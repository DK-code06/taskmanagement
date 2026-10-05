const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const connectDB = require("./db");
const auth = require("./middleware/auth");
const User = require("./models/User");
const Message = require("./models/Message");
const Team = require("./models/Team");
const { logAuditEvent } = require("./services/auditService");

// Route imports
const authRoutes = require("./routes/authRoutes");
const taskRoutes = require("./routes/tasks");
const categoryRoutes = require("./routes/categories");
const leaderboardRoutes = require("./routes/leaderboard");
const friendsRoutes = require("./routes/friends");
const teamRoutes = require("./routes/teams");
const analyticsRoutes = require("./routes/analytics");
const projectRoutes = require("./routes/projects");
const milestoneRoutes = require("./routes/milestones");
const notificationRoutes = require("./routes/notifications");
const intelligenceRoutes = require("./routes/intelligence");
const { sendNotification } = require("./services/notificationService");
const { startReminderWorker } = require("./services/reminderSchedulerService");

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

// Environment & Security Config
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const PORT = process.env.PORT || 5000;

// Security Middlewares
app.use(helmet());
app.use(cookieParser());
app.use(cors({
  origin: [CLIENT_ORIGIN, "http://localhost:5173", "http://127.0.0.1:5173"],
  credentials: true
}));
app.use(express.json({ limit: "100kb" }));
app.use(mongoSanitize());

// Rate Limiting
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per window
  message: { error: "Too many authentication requests, please try again later." }
});

const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: "Too many API requests, please try again later." }
});

app.use("/api/auth/login", authRateLimiter);
app.use("/api/auth/register", authRateLimiter);
app.use("/api/", generalApiLimiter);

// Health Check Endpoints
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", uptime: Math.floor(process.uptime()), timestamp: new Date().toISOString() });
});

app.get("/api/ready", async (req, res) => {
  const isDbConnected = (require("mongoose").connection.readyState === 1);
  if (isDbConnected) {
    return res.json({ ready: true, db: "connected" });
  }
  res.status(503).json({ ready: false, db: "disconnected" });
});

// Socket.IO Server Setup
const io = new Server(server, {
  cors: {
    origin: [CLIENT_ORIGIN, "http://localhost:5173", "http://127.0.0.1:5173"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Socket.IO Connection Authentication Handshake Middleware
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(" ")[1];
  if (!token) {
    return next(new Error("Authentication error: No token provided"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("username sessionVersion");
    if (!user || (decoded.sessionVersion !== undefined && user.sessionVersion !== decoded.sessionVersion)) {
      return next(new Error("Authentication error: Invalid or revoked session"));
    }

    socket.userId = user._id.toString();
    socket.username = user.username;
    next();
  } catch (err) {
    return next(new Error("Authentication error: Invalid token"));
  }
});

// Real-Time Socket Event Handling
io.on("connection", (socket) => {
  const userId = socket.userId;
  console.log(`[Socket.IO] Authenticated connection: User ${socket.username} (${userId}) on Socket ${socket.id}`);

  // Automatically join user's private room for multi-device / multi-tab support
  socket.join(`user:${userId}`);

  // Join authorized room
  socket.on("joinRoom", async (roomName) => {
    try {
      if (roomName.startsWith("team:")) {
        const teamId = roomName.replace("team:", "");
        const team = await Team.findById(teamId);
        if (team && team.members.some(m => m.user.equals(userId))) {
          socket.join(roomName);
          console.log(`[Socket.IO] User ${userId} joined room: ${roomName}`);
        }
      } else if (roomName.startsWith("chat:")) {
        const friendId = roomName.replace("chat:", "");
        const user = await User.findById(userId);
        const isFriend = user.friends.some(f => f.user.equals(friendId) && f.status === 'accepted');
        if (isFriend || friendId === userId) {
          socket.join(roomName);
          console.log(`[Socket.IO] User ${userId} joined room: ${roomName}`);
        }
      }
    } catch (err) {
      console.error("[Socket.IO] Join room error:", err);
    }
  });

  // Send real-time chat message
  socket.on("sendMessage", async (data) => {
    const { toUser, content, roomName } = data;
    if (!toUser || !content || !content.trim()) return;

    try {
      // Enforce sender identity from authenticated socket
      const fromUser = socket.userId;

      // Verify friendship
      const sender = await User.findById(fromUser);
      const isFriend = sender.friends.some(f => f.user.equals(toUser) && f.status === 'accepted');
      if (!isFriend) {
        return socket.emit("error", "Cannot send message to non-friend user");
      }

      const message = new Message({ fromUser, toUser, content: content.trim() });
      await message.save();

      // Emit message to recipient room and target room
      io.to(`user:${toUser}`).to(`user:${fromUser}`).emit("receiveMessage", message);

      // Increment unread count for recipient
      await User.updateOne(
        { _id: toUser, "friends.user": fromUser },
        { $inc: { "friends.$.unreadCount": 1 } }
      );

      // Dispatch offline / background chat notification
      sendNotification({
        recipient: toUser,
        type: "CHAT_MESSAGE",
        title: `Message from ${socket.username}`,
        message: content.trim(),
        entityType: "Message",
        entityId: message._id,
        actor: fromUser,
        deduplicationKey: `chat:${message._id.toString()}`,
        io
      }).catch(err => console.error("[Socket.IO] Error dispatching chat notification:", err));
    } catch (error) {
      console.error("[Socket.IO] Error sending message:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log(`[Socket.IO] Disconnected: User ${socket.username} (${userId})`);
  });
});

// API Routes Configuration
app.use("/api/auth", authRoutes);
app.use("/api/tasks", auth, taskRoutes(io));
app.use("/api/categories", auth, categoryRoutes);
app.use("/api/leaderboard", auth, leaderboardRoutes);
app.use("/api/teams", auth, teamRoutes);
app.use("/api/friends", auth, friendsRoutes(io));
app.use("/api/analytics", auth, analyticsRoutes);
app.use("/api/projects", auth, projectRoutes);
app.use("/api/milestones", auth, milestoneRoutes);
app.use("/api/notifications", auth, notificationRoutes);
app.use("/api/intelligence", auth, intelligenceRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("❌ Unhandled server error:", err);
  const isProd = process.env.NODE_ENV === "production";
  res.status(err.status || 500).json({
    error: isProd ? "Internal server error" : err.message
  });
});

// Start Server if executing directly
if (require.main === module) {
  startReminderWorker(io);
  server.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
  });
}

module.exports = { app, server };
