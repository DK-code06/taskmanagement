// Dashboard.jsx (M4.5-B Modern Modular Productivity Dashboard)
import React, { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

import Friends from "../components/Friends";
import ChatWindow from "../components/ChatWindow";
import Teams from "../components/Teams";
import { useSocket } from "../context/SocketContext";
import { AppShell } from "../components/layout/AppShell";
import { Header } from "../components/layout/Header";
import { ChatDrawer } from "../components/chat/ChatDrawer";
import { NotificationCenter } from "../components/notifications/NotificationCenter";

import {
  DashboardHeader,
  GamificationSummary,
  LeaderboardWidget,
  TodaySummary,
  ActiveProjects,
  UpcomingTasks,
} from "../components/dashboard";

import "./Dashboard.css";

import { API_BASE } from "../config";

const TaskAlertPanel = ({ alerts, onDismiss }) => (
  <div className="task-alert-panel" aria-live="polite">
    {alerts.map((alert) => (
      <div key={alert.id} className="task-alert" role="alert">
        <div className="alert-content">
          <strong>{alert.taskTitle}</strong>
          <p>{alert.message}</p>
        </div>
        <button onClick={() => onDismiss(alert.id)} className="btn-alert-close" aria-label="Dismiss alert">
          ×
        </button>
      </div>
    ))}
  </div>
);

export default function Dashboard() {
  const [username, setUsername] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [allTasks, setAllTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [teams, setTeams] = useState([]);
  const [friends, setFriends] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);

  // Notifications & Chat drawers
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [chattingWith, setChattingWith] = useState(null);
  const [refreshFriends, setRefreshFriends] = useState(false);

  // Task alerts & confirmations
  const [taskAlerts, setTaskAlerts] = useState([]);
  const [refreshTasksKey, setRefreshTasksKey] = useState(0);
  const [confirmationTask, setConfirmationTask] = useState(null);

  const socket = useSocket();
  const chattingWithRef = useRef(null);
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const authAxios = useMemo(
    () => axios.create({ baseURL: API_BASE, headers: { Authorization: token ? `Bearer ${token}` : "" } }),
    [token]
  );

  useEffect(() => {
    chattingWithRef.current = chattingWith;
  }, [chattingWith]);

  /* ---------- Auth & socket setup ---------- */
  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    try {
      const decoded = jwtDecode(token);
      const normalizedId = decoded._id ?? decoded.id ?? decoded.userId;
      setUsername(decoded.username ?? decoded.name ?? "");
      setCurrentUser({ ...decoded, id: normalizedId });
    } catch (err) {
      handleLogout();
      return;
    }

    if (!socket) return;

    const chatNotificationListener = () => {
      setRefreshFriends((v) => !v);
    };
    const friendRequestListener = () => {
      setRefreshFriends((v) => !v);
    };
    const tasksUpdatedListener = () => {
      setRefreshTasksKey((k) => k + 1);
    };

    socket.on("chatNotification", chatNotificationListener);
    socket.on("friendRequest", friendRequestListener);
    socket.on("tasksUpdated", tasksUpdatedListener);

    return () => {
      socket.off("chatNotification", chatNotificationListener);
      socket.off("friendRequest", friendRequestListener);
      socket.off("tasksUpdated", tasksUpdatedListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, token, navigate]);

  /* ---------- Data fetching ---------- */
  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;
      try {
        const [projectsRes, analyticsRes, allTasksRes, teamsRes, friendsRes, unreadRes] = await Promise.all([
          authAxios.get("/projects"),
          authAxios.get("/analytics"),
          authAxios.get("/tasks/all"),
          authAxios.get("/teams"),
          authAxios.get("/friends"),
          authAxios.get("/notifications/unread-count"),
        ]);

        setProjects(projectsRes.data || []);
        setAnalyticsData(analyticsRes.data || null);
        setAllTasks(allTasksRes.data || []);
        setTeams(teamsRes.data || []);
        setFriends(friendsRes.data?.friends ?? friendsRes.data ?? []);
        setUnreadNotificationsCount(unreadRes.data?.unreadCount || 0);
      } catch (e) {
        if (e.response?.status === 401) handleLogout();
        console.error("Failed to fetch dashboard data:", e);
      }
    };

    fetchData();
  }, [token, refreshFriends, refreshTasksKey, authAxios]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    if (socket) socket.disconnect();
    navigate("/login");
  };

  const handleOpenChat = (friendUser) => {
    setChattingWith(friendUser);
  };

  const handleTaskCompleteToggle = async (task) => {
    try {
      const newStatus = task.completed || task.status === "Done" ? "To Do" : "Done";
      await authAxios.put(`/tasks/${task._id}`, { status: newStatus });
      setRefreshTasksKey((k) => k + 1);
    } catch (err) {
      console.error("Failed to toggle task status:", err);
    }
  };

  const handleDismissAlert = (alertId) => {
    setTaskAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };

  return (
    <AppShell maxWidth="1600px">
      <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: "var(--space-lg)" }}>
        {/* Custom Header Integration */}
        <div style={{ marginTop: "-var(--space-lg)", marginLeft: "-var(--space-lg)", marginRight: "-var(--space-lg)" }}>
          <Header
            user={currentUser}
            onLogout={handleLogout}
            title="Task Management Platform"
            onOpenNotifications={() => setNotificationCenterOpen(true)}
            unreadNotificationsCount={unreadNotificationsCount}
            onOpenChat={() => setChatDrawerOpen(true)}
          />
        </div>

        {/* Dashboard Header Banner */}
        <DashboardHeader username={username} />

        {/* Floating task alerts */}
        <TaskAlertPanel alerts={taskAlerts} onDismiss={handleDismissAlert} />

        {/* Main Productivity Dashboard Layout */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "var(--space-lg)",
          }}
          className="dashboard-responsive-grid"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
            {/* Today Summary & Gamification Row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: "var(--space-lg)",
              }}
            >
              <TodaySummary tasks={allTasks} />
              <GamificationSummary user={currentUser} stats={analyticsData} />
            </div>

            {/* Active Projects */}
            <ActiveProjects projects={projects} />

            {/* Upcoming Tasks */}
            <UpcomingTasks
              tasks={allTasks}
              onToggleComplete={handleTaskCompleteToggle}
              currentUserId={currentUser?.id}
            />
          </div>

          {/* Right Sidebar Widgets */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)", minWidth: "320px" }}>
            <LeaderboardWidget authAxios={authAxios} currentUsername={username} />
            <Teams token={token} friends={friends} />
            <Friends token={token} onChat={handleOpenChat} refreshKey={refreshFriends} />
          </div>
        </div>

        {/* Notification Center Drawer */}
        <NotificationCenter
          isOpen={notificationCenterOpen}
          onClose={() => setNotificationCenterOpen(false)}
          authAxios={authAxios}
          onUnreadCountChange={setUnreadNotificationsCount}
        />

        {/* Chat Drawer */}
        <ChatDrawer
          isOpen={chatDrawerOpen}
          onClose={() => setChatDrawerOpen(false)}
          friends={friends}
          currentUserId={currentUser?.id}
          authAxios={authAxios}
        />

        {/* Individual Chat Window */}
        {chattingWith && currentUser && (
          <ChatWindow
            {...{ token, currentUser, friend: chattingWith, socket }}
            onClose={() => setChattingWith(null)}
            onMessagesRead={() => setRefreshFriends((v) => !v)}
          />
        )}
      </div>
    </AppShell>
  );
}
