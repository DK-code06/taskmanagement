// Dashboard.jsx
import { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import Friends from "../components/Friends";
import ChatWindow from "../components/ChatWindow";
import Teams from "../components/Teams";
import Analytics from "../components/Analytics";
import TeamAnalytics from "../components/TeamAnalytics";
import { useSocket } from "../context/SocketContext";
import "./Dashboard.css";

const API_BASE = "http://localhost:5000/api";

/* ---------- Helper components ---------- */

const Leaderboard = ({ users, currentUsername }) => (
  <div className="leaderboard">
    <h3>🏆 Leaderboard</h3>
    <ol>
      {users.map((user) => (
        <li key={user._id}>
          <span>
            {user.username}
            {user.username === currentUsername && <span className="me-indicator"> (Me)</span>}
          </span>
          <span className="leaderboard-stats">
            <span className="daily-tasks">{user.dailyCompleted} tasks today</span>
            <span className="points">{user.points} pts</span>
          </span>
        </li>
      ))}
    </ol>
  </div>
);

const ProgressBar = ({ value, max }) => {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="progress-bar-container">
      <div className="progress-bar" style={{ width: `${percentage}%` }}></div>
    </div>
  );
};

const ChatNotificationItem = ({ notification, onClick }) => (
  <div
    className="notification-item"
    role="button"
    tabIndex={0}
    onClick={onClick}
    onKeyDown={(e) => {
      if (e.key === "Enter") onClick();
    }}
  >
    <strong>{notification.fromUser.username}</strong>
    <p>{notification.content}</p>
  </div>
);

const FriendRequestNotification = ({ notification, onDismiss }) => (
  <div
    className="notification-item friend-request"
    role="button"
    tabIndex={0}
    onClick={onDismiss}
    onKeyDown={(e) => {
      if (e.key === "Enter") onDismiss();
    }}
  >
    <strong>New Friend Request!</strong>
    <p>{notification.fromUser.username} wants to be your friend.</p>
    <span className="notification-dismiss">Click to dismiss</span>
  </div>
);

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

/* ---------- Main Dashboard ---------- */

export default function Dashboard() {
  // Core data states
  const [categories, setCategories] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [username, setUsername] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);

  // Team & friends
  const [teams, setTeams] = useState([]);
  const [friends, setFriends] = useState([]);

  // Category & analytics
  const [categoryOwner, setCategoryOwner] = useState("");
  const [analyticsData, setAnalyticsData] = useState(null);

  // Chat/notifications
  const [notifications, setNotifications] = useState([]);
  const [chattingWith, setChattingWith] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [refreshFriends, setRefreshFriends] = useState(false);
  const socket = useSocket();
  const chattingWithRef = useRef(null);

  // Tasks & alerts
  const [allTasks, setAllTasks] = useState([]);
  const [taskAlerts, setTaskAlerts] = useState([]);
  const [refreshTasksKey, setRefreshTasksKey] = useState(0);
  const [confirmationTask, setConfirmationTask] = useState(null);

  // Toasts (near username)
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  // Memoized axios instance
  const authAxios = useMemo(
    () => axios.create({ baseURL: API_BASE, headers: { Authorization: token ? `Bearer ${token}` : "" } }),
    [token]
  );

  useEffect(() => {
    chattingWithRef.current = chattingWith;
  }, [chattingWith]);

  /* ---------- Utility: toasts ---------- */
  const addToast = (message, opts = {}) => {
    // opts: { type: 'info'|'success'|'warning'|'error', duration }
    const { type = "info", duration = 5000 } = opts;
    const id = `toast_${Date.now()}_${toastIdRef.current++}`;
    const t = { id, message, type, visible: true };
    setToasts((prev) => [t, ...prev]);

    // hide (fade) after duration
    setTimeout(() => {
      setToasts((prev) => prev.map((x) => (x.id === id ? { ...x, visible: false } : x)));
    }, duration);

    // remove after transition
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, duration + 300);
  };

  // toast styles used inside header (so they appear near username)
  const headerToastWrapperStyle = {
    position: "relative",
    display: "inline-block",
  };
  const toastInnerContainerStyle = {
    position: "absolute",
    top: "calc(100% + 8px)",
    right: 0,
    zIndex: 1500,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    alignItems: "flex-end",
    minWidth: 260,
    maxWidth: 360,
  };
  const toastBaseStyle = (visible) => ({
    minWidth: 260,
    maxWidth: 360,
    background: "#ffffff",
    borderLeft: "6px solid rgba(0,0,0,0.08)",
    boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
    padding: "10px 12px",
    borderRadius: 8,
    transition: "transform 220ms ease, opacity 220ms ease",
    transform: visible ? "translateY(0) scale(1)" : "translateY(-6px) scale(.98)",
    opacity: visible ? 1 : 0,
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    color: "#111827",
  });
  const toastTypeAccent = {
    info: "#3f51b5",
    success: "#16a34a",
    warning: "#d97706",
    error: "#d32f2f",
  };

  /* ---------- Auth + socket + listeners ---------- */
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
      setCategoryOwner(normalizedId);
    } catch (err) {
      handleLogout();
      return;
    }

    if (!socket) return;

    const chatNotificationListener = (notification) => {
      if (chattingWithRef.current?._id !== notification.fromUser._id) {
        setNotifications((prev) => [{ ...notification, type: "chat" }, ...prev.slice(0, 4)]);
        addToast(`New message from ${notification.fromUser.username}`, { type: "info" });
      }
    };
    const friendRequestListener = (notification) => {
      setNotifications((prev) => [{ ...notification, type: "friendRequest" }, ...prev.slice(0, 4)]);
      setRefreshFriends((v) => !v);
      addToast(`${notification.fromUser.username} sent you a friend request.`, { type: "info" });
    };
    const tasksUpdatedListener = () => {
      setRefreshTasksKey((k) => k + 1);
      addToast("Tasks updated.", { type: "info", duration: 2000 });
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
        const [categoriesRes, leaderboardRes, teamsRes, friendsRes, analyticsRes, allTasksRes] = await Promise.all([
          authAxios.get("/categories"),
          authAxios.get("/leaderboard"),
          authAxios.get("/teams"),
          authAxios.get("/friends"),
          authAxios.get("/analytics"),
          authAxios.get("/tasks/all"),
        ]);
        setCategories(categoriesRes.data);
        setLeaderboard(leaderboardRes.data);
        setTeams(teamsRes.data);
        setFriends(friendsRes.data.friends ?? friendsRes.data ?? []);
        setAnalyticsData(analyticsRes.data);
        setAllTasks(allTasksRes.data);
      } catch (e) {
        if (e.response?.status === 401) handleLogout();
        console.error("Failed to fetch dashboard data:", e);
        addToast("Failed to load some data.", { type: "warning", duration: 5000 });
      }
    };

    fetchData();
  }, [token, refreshFriends, refreshTasksKey, authAxios]);

  /* ---------- Deadline & confirmation checker (fixed) ---------- */
  useEffect(() => {
    if (!allTasks || allTasks.length === 0) return;

    const MS_IN_MIN = 1000 * 60;
    const MS_24H = 24 * 60 * MS_IN_MIN;

    const checkDeadlines = () => {
      const now = new Date();
      const upcomingAlerts = [];
      const alertsThisRun = new Set();

      const makeAlertIfNew = (alertId, taskTitle, message, toastOpts) => {
        if (alertsThisRun.has(alertId)) return;
        const bucketKey = `${alertId}-bucket`;
        const bucket = Math.floor(now.getTime() / 30000); // 30s buckets
        const last = sessionStorage.getItem(bucketKey);
        if (last === `s${bucket}`) return;
        // persist bucket stamp
        sessionStorage.setItem(bucketKey, `s${bucket}`);
        alertsThisRun.add(alertId);
        upcomingAlerts.push({ id: alertId, taskTitle, message });
        // show toast
        addToast(message, toastOpts ?? { type: "warning", duration: 6000 });
      };

      allTasks.forEach((taskRaw) => {
        const task = { ...taskRaw, _id: taskRaw._id ?? taskRaw.id };

        if (task.status === "Done") return;

        // dueDate-based alerts
        if (task.dueDate) {
          const due = new Date(task.dueDate);
          const msLeft = due.getTime() - now.getTime();
          const minutesLeft = msLeft / MS_IN_MIN;

          if (minutesLeft > 0 && minutesLeft <= 5) {
            makeAlertIfNew(`${task._id}-due-urgent`, task.title, `⏰ "${task.title}" due in ~${Math.ceil(minutesLeft)} minute(s)!`, {
              type: "warning",
              duration: 7000,
            });
          } else if (minutesLeft > 5 && minutesLeft <= 10) {
            makeAlertIfNew(`${task._id}-due-10min`, task.title, `⏰ "${task.title}" due in ~10 minutes.`, {
              type: "info",
              duration: 6000,
            });
          } else if (minutesLeft > 10 && minutesLeft <= 60) {
            const tenBucket = Math.floor(minutesLeft / 10) * 10;
            makeAlertIfNew(`${task._id}-due-${tenBucket}min`, task.title, `⏰ "${task.title}" due in about ${tenBucket} minutes.`, {
              type: "info",
              duration: 5000,
            });
          } else if (minutesLeft > 60) {
            const hours = Math.floor(minutesLeft / 60);
            makeAlertIfNew(`${task._id}-due-${hours}h`, task.title, `⏰ "${task.title}" due in ~${hours} hour(s).`, {
              type: "info",
              duration: 4000,
            });
          } else if (minutesLeft <= 0) {
            // overdue
            makeAlertIfNew(`${task._id}-due-overdue`, task.title, `⚠️ "${task.title}" is overdue!`, {
              type: "error",
              duration: 9000,
            });
          }
        }

        // estimated completion-time alerts (for In Progress tasks)
        if (task.startedAt && task.estimatedCompletionTime && task.status === "In Progress") {
          const estimatedDeadline = new Date(new Date(task.startedAt).getTime() + task.estimatedCompletionTime * MS_IN_MIN);
          const msLeft = estimatedDeadline.getTime() - now.getTime();
          const minutesLeft = msLeft / MS_IN_MIN;

          // If timer is almost done
          if (minutesLeft > 0 && minutesLeft <= 5) {
            makeAlertIfNew(`${task._id}-est-urgent`, task.title, `⏱️ Timer: "${task.title}" completes in ~${Math.ceil(minutesLeft)} minute(s).`, {
              type: "info",
              duration: 6000,
            });
          }
          // Timer went past within last 24 hours => confirmation prompt
          else if (minutesLeft <= 0 && Math.abs(msLeft) <= MS_24H) {
            const confirmKey = `confirm-shown-${task._id}`;
            const alreadyShown = sessionStorage.getItem(confirmKey);
            if (!alreadyShown && (!confirmationTask || confirmationTask._id !== task._id)) {
              // IMPORTANT FIX: Do NOT mark as shown here. Only set confirmationTask so modal can appear.
              setConfirmationTask(task);
              addToast(`Timer ended for "${task.title}". Confirm completion.`, { type: "info", duration: 7000 });
            }
            // also show an overdue toast in panel
            makeAlertIfNew(`${task._id}-est-overdue`, task.title, `⚠️ Timer ended for "${task.title}". Please confirm.`, {
              type: "warning",
              duration: 7000,
            });
          }
        }
      });

      if (upcomingAlerts.length > 0) {
        setTaskAlerts((prev) => {
          const existing = new Set(prev.map((a) => a.id));
          const fresh = upcomingAlerts.filter((a) => !existing.has(a.id));
          return [...fresh, ...prev];
        });
      }
    };

    // run immediately and every 30s
    checkDeadlines();
    const id = setInterval(checkDeadlines, 30000);
    return () => clearInterval(id);
  }, [allTasks, confirmationTask]); // re-evaluate when tasks change or confirmation shown

  /* ---------- Handlers ---------- */
  const handleDismissAlert = (alertId) => {
    setTaskAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };

  const handleConfirmCompletion = async (task) => {
    try {
      const id = task._id ?? task.id;
      await authAxios.put(`/tasks/${id}`, { status: "Done" });

      // Mark confirmation as shown only when the user acts
      sessionStorage.setItem(`confirm-shown-${id}`, String(Date.now()));

      // Remove alerts related to this task
      setTaskAlerts((prev) => prev.filter((a) => !a.id.startsWith(`${id}-`)));

      setConfirmationTask(null);
      setRefreshTasksKey((k) => k + 1);
      addToast(`Marked "${task.title}" as Done.`, { type: "success", duration: 4000 });
    } catch (e) {
      console.error("Failed to mark task done:", e);
      addToast("Failed to mark task as done.", { type: "error", duration: 5000 });
    }
  };

  const handleDenyCompletion = async (task) => {
    try {
      const id = task._id ?? task.id;
      await authAxios.put(`/tasks/${id}`, { status: "To Do" });

      // Mark confirmation as shown only when the user acts
      sessionStorage.setItem(`confirm-shown-${id}`, String(Date.now()));

      // Remove alerts related to this task
      setTaskAlerts((prev) => prev.filter((a) => !a.id.startsWith(`${id}-`)));

      setConfirmationTask(null);
      setRefreshTasksKey((k) => k + 1);
      addToast(`Moved "${task.title}" back to To Do.`, { type: "info", duration: 4000 });
    } catch (e) {
      console.error("Failed to move to To Do:", e);
      addToast("Failed to move task to To Do.", { type: "error", duration: 5000 });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    if (socket) socket.disconnect();
    navigate("/login");
  };

  const openChatFromNotification = (notification) => {
    setChattingWith(notification.fromUser);
    setNotifications((prev) => prev.filter((n) => n.fromUser._id !== notification.fromUser._id));
  };

  const handleOpenChat = (friendUser) => {
    setChattingWith(friendUser);
    setNotifications((prev) => prev.filter((n) => n.fromUser._id !== friendUser._id && n.type === "chat"));
  };

  const dismissNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.fromUser._id !== id));
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim() || !categoryOwner) return;

    const isTeamOwner = teams.some((t) => t._id === categoryOwner);
    const payload = {
      name: newCategoryName.trim(),
      ownerType: isTeamOwner ? "Team" : "User",
      ownerId: categoryOwner,
    };

    try {
      await authAxios.post("/categories", payload);
      const res = await authAxios.get("/categories");
      setCategories(res.data);
      setNewCategoryName("");
      addToast("Category created.", { type: "success", duration: 3500 });
    } catch (e) {
      console.error(e);
      addToast("Failed to create category.", { type: "error", duration: 5000 });
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm("Are you sure? This will delete the category and ALL its tasks.")) return;
    try {
      await authAxios.delete(`/categories/${id}`);
      setCategories((prev) => prev.filter((c) => c._id !== id));
      addToast("Category deleted.", { type: "info", duration: 3500 });
    } catch (e) {
      console.error(e);
      addToast("Failed to delete category.", { type: "error", duration: 5000 });
    }
  };

  const handlePinToggle = async (id) => {
    try {
      await authAxios.put(`/categories/${id}/pin`);
      const res = await authAxios.get("/categories");
      setCategories(res.data);
      addToast("Toggled pin.", { type: "info", duration: 2500 });
    } catch (e) {
      console.error(e);
      addToast("Failed to toggle pin.", { type: "error", duration: 4000 });
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    const reordered = Array.from(categories.filter((c) => !c.isPinned && c.ownerType === "User"));
    if (result.source.index < 0 || result.source.index >= reordered.length) return;
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    const newOrder = [...categories.filter((c) => c.isPinned), ...reordered, ...categories.filter((c) => c.ownerType === "Team")];
    setCategories(newOrder);
    try {
      const payload = { categories: reordered.map((c, index) => ({ id: c._id, order: index })) };
      await authAxios.put("/categories/reorder", payload);
    } catch (e) {
      console.error("Reorder failed", e);
      addToast("Failed to reorder categories.", { type: "error", duration: 3500 });
    }
  };

  /* ---------- Derived data ---------- */
  const personalCategories = categories.filter((c) => c.ownerType === "User");
  const teamData = teams.map((team) => ({ ...team, categories: categories.filter((c) => c.ownerId === team._id) }));
  const pinnedPersonal = personalCategories.filter((c) => c.isPinned);
  const otherPersonal = personalCategories.filter((c) => !c.isPinned);

  const CategoryCard = ({ cat, provided }) => (
    <div
      className={`category-card ${cat.isPinned ? "pinned" : ""}`}
      ref={provided?.innerRef}
      {...provided?.draggableProps}
      {...provided?.dragHandleProps}
    >
      <Link to={`/category/${cat._id}`} className="card-link">
        <h3>{cat.name}</h3>
        <div className="progress-info">
          <span>
            {cat.completedTasks}/{cat.totalTasks} Done
          </span>
          <ProgressBar value={cat.completedTasks} max={cat.totalTasks} />
        </div>
      </Link>
      <div className="card-actions">
        <button onClick={() => handlePinToggle(cat._id)} title={cat.isPinned ? "Unpin" : "Pin"} aria-label={cat.isPinned ? "Unpin" : "Pin"}>
          {cat.isPinned ? "⭐" : "☆"}
        </button>
        <button onClick={() => handleDeleteCategory(cat._id)} title="Delete" aria-label="Delete category">
          🗑️
        </button>
      </div>
    </div>
  );

  /* ---------- Render ---------- */
  return (
    <div className="dashboard-container">
      {/* notification & toasts area inside header (near username) */}
      <div className="header">
        <h1>My Dashboard</h1>

        <div className="user-info" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span>
            Hello, <strong>{username}</strong>
          </span>

          {/* toast wrapper placed near user-info */}
          <div style={headerToastWrapperStyle} aria-live="polite">
            {/* small icon or avatar could go here if desired */}
            <div style={toastInnerContainerStyle}>
              {toasts.map((t) => (
                <div
                  key={t.id}
                  style={{
                    ...toastBaseStyle(t.visible),
                    borderLeftColor: toastTypeAccent[t.type] ?? toastTypeAccent.info,
                  }}
                  role="status"
                  aria-live="polite"
                >
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: toastTypeAccent[t.type] ?? toastTypeAccent.info, marginTop: 6 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                      {t.type === "success" ? "Done" : t.type === "error" ? "Error" : t.type === "warning" ? "Attention" : "Info"}
                    </div>
                    <div style={{ fontSize: 13, color: "#374151" }}>{t.message}</div>
                  </div>
                  <button
                    onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                    aria-label="Dismiss toast"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 16, marginLeft: 8 }}
                    type="button"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button onClick={handleLogout} className="btn btn-outline" aria-label="Logout">
            Logout
          </button>
        </div>
      </div>

      {/* top notification area (small list) */}
      <div className="notification-panel" style={{ marginBottom: 8 }}>
        {notifications.map((n, index) => {
          if (n.type === "friendRequest") {
            return <FriendRequestNotification key={`${n.fromUser._id}-${index}`} notification={n} onDismiss={() => dismissNotification(n.fromUser._id)} />;
          }
          return <ChatNotificationItem key={`${n.fromUser._id}-${index}`} notification={n} onClick={() => openChatFromNotification(n)} />;
        })}
      </div>

      {/* Floating task alerts in bottom-right (panel) */}
      <TaskAlertPanel alerts={taskAlerts} onDismiss={handleDismissAlert} />

      {/* Confirmation modal */}
      {confirmationTask && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-content">
            <button
              type="button"
              className="modal-close"
              aria-label="Close confirmation"
              onClick={() => {
                // mark as seen but don't change status; allow it to show later if needed
                const id = confirmationTask._id ?? confirmationTask.id;
                sessionStorage.setItem(`confirm-shown-${id}`, String(Date.now()));
                setConfirmationTask(null);
              }}
              style={{ float: "right", background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer" }}
            >
              ×
            </button>
            <h3 id="modal-title">Task Timer Finished</h3>
            <p>
              Did you complete the task: <strong>"{confirmationTask.title}"</strong>?
            </p>
            <div className="form-actions" style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-outline" onClick={() => handleDenyCompletion(confirmationTask)}>
                No, move to "To Do"
              </button>
              <button type="button" className="btn btn-dark" onClick={() => handleConfirmCompletion(confirmationTask)}>
                Yes, mark as "Done"
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-main">
        <div className="categories-section">
          <Analytics data={analyticsData} />

          <form onSubmit={handleCreateCategory} className="form category-form">
            <input
              type="text"
              placeholder="Create a new category..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="input"
              required
            />
            <div className="form-row">
              <select className="input" value={categoryOwner} onChange={(e) => setCategoryOwner(e.target.value)}>
                {currentUser && <option value={currentUser.id}>My Personal Categories</option>}
                {teams.map((team) => (
                  <option key={team._id} value={team._id}>
                    {team.name} (Team)
                  </option>
                ))}
              </select>
              <button type="submit" className="btn btn-dark">
                Add Category
              </button>
            </div>
          </form>

          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="category-group">
              <h2>My Personal Categories</h2>
              {pinnedPersonal.length > 0 && <h3>📌 Pinned</h3>}
              <div className="grid">{pinnedPersonal.map((cat) => <CategoryCard key={cat._id} cat={cat} />)}</div>

              {otherPersonal.length > 0 && pinnedPersonal.length > 0 && <h3 style={{ marginTop: "20px" }}>Other</h3>}
              <Droppable droppableId="personal-categories">
                {(provided) => (
                  <div className="grid" ref={provided.innerRef} {...provided.droppableProps}>
                    {otherPersonal.map((cat, index) => (
                      <Draggable key={cat._id} draggableId={cat._id} index={index}>
                        {(provided) => <CategoryCard cat={cat} provided={provided} />}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>

            {teamData.map((team) => (
              <div key={team._id} className="category-group">
                <h2>{team.name} (Team)</h2>
                <TeamAnalytics teamId={team._id} token={token} />
                <div className="grid">{team.categories.map((cat) => <CategoryCard key={cat._id} cat={cat} />)}</div>
              </div>
            ))}
          </DragDropContext>
        </div>

        <div className="sidebar-section">
          <Leaderboard users={leaderboard} currentUsername={username} />
          <Teams token={token} friends={friends} />
          <Friends token={token} onChat={handleOpenChat} notifications={notifications} refreshKey={refreshFriends} />
        </div>
      </div>

      {chattingWith && currentUser && (
        <ChatWindow
          {...{ token, currentUser, friend: chattingWith, socket }}
          onClose={() => setChattingWith(null)}
          onMessagesRead={() => setRefreshFriends((v) => !v)}
        />
      )}
    </div>
  );
}
