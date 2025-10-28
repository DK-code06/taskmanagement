const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require('http');
const { Server } = require("socket.io");
const connectDB = require("./db");
const auth = require("./middleware/auth");
const User = require('./models/User'); 
const Message = require('./models/Message');

// Route imports
const authRoutes = require("./routes/authRoutes");
const taskRoutes = require("./routes/tasks"); 
const categoryRoutes = require("./routes/categories");
const leaderboardRoutes = require("./routes/leaderboard");
const friendsRoutes = require("./routes/friends");
const teamRoutes = require("./routes/teams");
const analyticsRoutes = require("./routes/analytics");

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const userSockets = {};

// --- Real-time Logic ---
io.on('connection', (socket) => {
    console.log(`[Socket.IO] New connection: ${socket.id}`);

    socket.on('authenticate', (userId) => {
        socket.userId = userId;
        userSockets[userId] = socket.id;
        console.log(`[Socket.IO] Authenticated: User ${userId} is now Socket ${socket.id}`);
    });

    socket.on('joinRoom', (roomName) => {
        socket.join(roomName);
        console.log(`[Socket.IO] User ${socket.userId} joined room: ${roomName}`);
    });

    socket.on('sendMessage', async (data) => {
        const { fromUser, toUser, content, roomName } = data;
        try {
            const message = new Message({ fromUser, toUser, content });
            await message.save();
            
            io.to(roomName).emit('receiveMessage', message);

            const recipientSocketId = userSockets[toUser];
            if (recipientSocketId) {
                const sender = await User.findById(fromUser).select('username');
                io.to(recipientSocketId).emit('chatNotification', {
                    fromUser: sender,
                    content: message.content
                });
            } else {
                await User.updateOne(
                    { _id: toUser, 'friends.user': fromUser },
                    { $inc: { 'friends.$.unreadCount': 1 } }
                );
            }
        } catch (error) {
            console.error("[Socket.IO] Error sending message:", error);
        }
    });

    socket.on('disconnect', () => {
        if (socket.userId) {
            delete userSockets[socket.userId];
            console.log(`[Socket.IO] Disconnected: User ${socket.userId}`);
        }
    });
});

// --- API Routes ---
app.use("/api/auth", authRoutes);
// ✅ Puthya Maatram: 'io' instance ah ippo namma taskRoutes-ku anupurom
app.use("/api/tasks", auth, taskRoutes(io)); 
app.use("/api/categories", auth, categoryRoutes);
app.use("/api/leaderboard", auth, leaderboardRoutes);
app.use("/api/teams", auth, teamRoutes);
app.use("/api/friends", auth, friendsRoutes(io, userSockets));
app.use("/api/analytics", auth, analyticsRoutes);

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

