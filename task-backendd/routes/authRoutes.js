const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const auth = require("../middleware/auth");
const { logAuditEvent } = require("../services/auditService");
require("dotenv").config();

// Helper to issue access & refresh tokens
const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user._id, username: user.username, sessionVersion: user.sessionVersion },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );

  const refreshToken = jwt.sign(
    { id: user._id, sessionVersion: user.sessionVersion },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  return { accessToken, refreshToken };
};

const setRefreshCookie = (res, refreshToken) => {
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
};

// Register
router.post("/register", async (req, res) => {
  try {
    const { username, password, timezone } = req.body;
    if (!username || !username.trim() || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const cleanUsername = username.trim().toLowerCase();
    const existing = await User.findOne({ username: cleanUsername });
    if (existing) {
      return res.status(400).json({ error: "Username already taken" });
    }

    const user = new User({
      username: cleanUsername,
      password,
      timezone: timezone || "UTC"
    });
    await user.save();

    const { accessToken, refreshToken } = generateTokens(user);
    user.refreshToken = refreshToken;
    await user.save();

    setRefreshCookie(res, refreshToken);

    await logAuditEvent({ userId: user._id, action: "LOGIN_SUCCESS", req, details: { mode: "register" } });

    res.status(201).json({
      message: "User registered successfully",
      token: accessToken,
      user: { id: user._id, username: user.username, points: user.points, streak: user.streak }
    });
  } catch (err) {
    console.error("❌ Registration error:", err);
    res.status(500).json({ error: "Server error during registration" });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const cleanUsername = username.trim().toLowerCase();
    const user = await User.findOne({ username: cleanUsername });
    if (!user) {
      await logAuditEvent({ action: "LOGIN_FAILED", req, details: { username: cleanUsername, reason: "USER_NOT_FOUND" } });
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await logAuditEvent({ userId: user._id, action: "LOGIN_FAILED", req, details: { reason: "INVALID_PASSWORD" } });
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const { accessToken, refreshToken } = generateTokens(user);
    user.refreshToken = refreshToken;
    await user.save();

    setRefreshCookie(res, refreshToken);

    await logAuditEvent({ userId: user._id, action: "LOGIN_SUCCESS", req });

    res.json({
      token: accessToken,
      user: { id: user._id, username: user.username, points: user.points, streak: user.streak }
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ error: "Server error during login" });
  }
});

// Refresh Token
router.post("/refresh", async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ error: "Refresh token missing" });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || user.sessionVersion !== decoded.sessionVersion) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    const tokens = generateTokens(user);
    user.refreshToken = tokens.refreshToken;
    await user.save();

    setRefreshCookie(res, tokens.refreshToken);
    await logAuditEvent({ userId: user._id, action: "TOKEN_REFRESH", req });

    res.json({ token: tokens.accessToken });
  } catch (err) {
    return res.status(401).json({ error: "Invalid refresh token" });
  }
});

// Logout
router.post("/logout", auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { $set: { refreshToken: null } });
    res.clearCookie("refreshToken");
    await logAuditEvent({ userId: req.user.id, action: "LOGOUT", req });
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    res.status(500).json({ error: "Error during logout" });
  }
});

// Logout All Devices
router.post("/logout-all", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.sessionVersion = (user.sessionVersion || 1) + 1;
    user.refreshToken = null;
    await user.save();

    res.clearCookie("refreshToken");
    await logAuditEvent({ userId: user._id, action: "LOGOUT_ALL", req, details: { newSessionVersion: user.sessionVersion } });

    res.json({ message: "Logged out from all devices successfully" });
  } catch (err) {
    res.status(500).json({ error: "Error during logout all" });
  }
});

// Change Password
router.post("/change-password", auth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters long" });
    }

    const user = await User.findById(req.user.id);
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      await logAuditEvent({ userId: user._id, action: "PERMISSION_DENIED", req, details: { reason: "INVALID_OLD_PASSWORD" } });
      return res.status(400).json({ error: "Current password does not match" });
    }

    user.password = newPassword;
    user.sessionVersion = (user.sessionVersion || 1) + 1;
    await user.save();

    const tokens = generateTokens(user);
    user.refreshToken = tokens.refreshToken;
    await user.save();

    setRefreshCookie(res, tokens.refreshToken);
    await logAuditEvent({ userId: user._id, action: "PASSWORD_CHANGED", req });

    res.json({ message: "Password updated successfully", token: tokens.accessToken });
  } catch (err) {
    res.status(500).json({ error: "Failed to change password" });
  }
});

module.exports = router;