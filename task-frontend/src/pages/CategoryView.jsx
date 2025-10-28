// src/pages/CategoryView.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useNavigate, useParams, Link } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

import { useToast, LocalToasts } from "../context/ToastContext";
import "../App.css"; // reuse your styles (adjust path if different)

const API_BASE = "http://localhost:5000/api";

const priorities = ["High", "Medium", "Low", "No Priority"];
const statuses = ["To Do", "In Progress"];

const priorityStyles = {
  High: { color: "#ef4444", name: "High" },
  Medium: { color: "#f97316", name: "Medium" },
  Low: { color: "#22c55e", name: "Low" },
  "No Priority": { color: "#6b7280", name: "No Priority" },
};

// Small progress bar component (keeps your original look)
const TaskProgressBar = ({ task }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!task || !task.startedAt || task.status !== "In Progress" || !task.estimatedCompletionTime) {
      setProgress(0);
      return;
    }
    const calculateProgress = () => {
      const startTime = new Date(task.startedAt).getTime();
      const totalDuration = task.estimatedCompletionTime * 60 * 1000;
      if (totalDuration <= 0) return setProgress(0);
      const now = Date.now();
      const elapsed = now - startTime;
      const pct = Math.min((elapsed / totalDuration) * 100, 100);
      setProgress(pct);
    };
    calculateProgress();
    const id = setInterval(calculateProgress, 1000);
    return () => clearInterval(id);
  }, [task]);

  if (!task || !task.startedAt || task.status !== "In Progress" || !task.estimatedCompletionTime) return null;

  return (
    <div className="task-progress-bar-container" style={{ height: 6, background: "#e6e6e6", borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
      <div className="task-progress-bar" style={{ width: `${progress}%`, height: "100%", background: "#60a5fa" }} />
    </div>
  );
};

export default function CategoryView() {
  const { categoryId } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  // core
  const [tasks, setTasks] = useState([]);
  const [category, setCategory] = useState(null);
  const [categoryName, setCategoryName] = useState("");
  const [teamMembers, setTeamMembers] = useState([]);

  // auth/user
  const [username, setUsername] = useState("");
  const [currentUserId, setCurrentUserId] = useState(null);

  // form / edit
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editId, setEditId] = useState(null);
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("No Priority");
  const [assignedTo, setAssignedTo] = useState("");

  // comments
  const [activeCommentTaskId, setActiveCommentTaskId] = useState(null);
  const [newComment, setNewComment] = useState("");

  // estimation modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [taskToEstimate, setTaskToEstimate] = useState(null);
  const [estimatedTime, setEstimatedTime] = useState("");

  // confirmation modal when timer ends
  const [confirmationTask, setConfirmationTask] = useState(null);

  // local alert panel (list)
  const [taskAlerts, setTaskAlerts] = useState([]);

  const token = localStorage.getItem("token");
  const authAxios = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${token}` } });

  // timers ref: track setInterval ids & metadata to resume on mount/unmount
  const timersRef = useRef({}); // { [taskId]: { intervalId, endTime } }

  // ---------- Auth & initial data ----------
  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    try {
      const decoded = jwtDecode(token);
      const normalizedId = decoded._id ?? decoded.id ?? decoded.userId;
      setUsername(decoded.username ?? decoded.name ?? "");
      setCurrentUserId(normalizedId);
    } catch (err) {
      console.error("Token decode failed:", err);
      handleLogout();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchTasksAndCategory = useCallback(async () => {
    if (!token || !categoryId) return;
    try {
      const [catsRes, tasksRes] = await Promise.all([authAxios.get("/categories"), authAxios.get(`/tasks/by-category/${categoryId}`)]);
      const currentCat = catsRes.data.find((c) => c._id === categoryId);
      if (currentCat) {
        setCategory(currentCat);
        setCategoryName(currentCat.name);
        if (currentCat.ownerType === "Team") {
          const teamRes = await authAxios.get(`/teams`);
          const currentTeam = teamRes.data.find((t) => t._id === currentCat.ownerId);
          if (currentTeam) setTeamMembers(currentTeam.members || []);
          else setTeamMembers([]);
        } else {
          setTeamMembers([]);
        }
      }
      setTasks(tasksRes.data || []);
    } catch (e) {
      if (e.response?.status === 401) handleLogout();
      else {
        console.error("Failed to fetch category/tasks", e);
        addToast("Failed to load tasks.", { type: "error" });
      }
    }
  }, [token, categoryId]);

  useEffect(() => {
    fetchTasksAndCategory();
  }, [fetchTasksAndCategory]);

  // ---------- Timers: resume active timers on load ----------
  useEffect(() => {
    // Clear existing intervals
    Object.values(timersRef.current).forEach((t) => t && clearInterval(t.intervalId));
    timersRef.current = {};

    const now = Date.now();

    tasks.forEach((task) => {
      // schedule only In Progress tasks that have an end time
      if (task.status === "In Progress" && task.startedAt && task.estimatedCompletionTime) {
        // calculate endTime from startedAt + estimate
        const start = new Date(task.startedAt).getTime();
        const endTime = start + task.estimatedCompletionTime * 60 * 1000;
        if (endTime > now) {
          // set up interval to watch it
          const intervalId = setInterval(() => {
            const remaining = endTime - Date.now();
            // near finish - send a toast (only once)
            if (remaining <= 1000 * 60 * 1 && remaining > 0) {
              // mark near-end toast in sessionStorage (prevents spam)
              const key = `near-end-${task._id}`;
              if (!sessionStorage.getItem(key)) {
                sessionStorage.setItem(key, "1");
                addToast(`Timer near end for "${task.title}"`, { type: "info", duration: 5000 });
                setTaskAlerts((prev) => [{ id: `${task._id}-near`, taskTitle: task.title, message: `Timer nearly finished` }, ...prev]);
              }
            }
            if (remaining <= 0) {
              clearInterval(intervalId);
              // IMPORTANT: Do NOT mark confirm-shown here. Only set the modal so user sees it.
              const confirmKey = `confirm-shown-${task._id}`;
              if (!sessionStorage.getItem(confirmKey)) {
                // don't write sessionStorage here — let user action mark it
                setConfirmationTask(task);
                addToast(`Timer ended for "${task.title}" — confirm completion.`, { type: "warning", duration: 7000 });
                setTaskAlerts((prev) => [{ id: `${task._id}-ended`, taskTitle: task.title, message: `Timer ended — confirm completion` }, ...prev]);
              }
            }
          }, 1000);
          timersRef.current[task._id] = { intervalId, endTime };
        } else {
          // already past; ask for confirmation if not shown recently
          const confirmKey = `confirm-shown-${task._id}`;
          if (!sessionStorage.getItem(confirmKey)) {
            // again: DO NOT set sessionStorage here
            setConfirmationTask(task);
            addToast(`Timer already ended for "${task.title}" — confirm completion.`, { type: "warning", duration: 7000 });
            setTaskAlerts((prev) => [{ id: `${task._id}-ended`, taskTitle: task.title, message: `Timer ended — confirm completion` }, ...prev]);
          }
        }
      }
    });

    return () => {
      Object.values(timersRef.current).forEach((t) => t && clearInterval(t.intervalId));
      timersRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  // ---------- Deadline & estimate alert checker (local panel + toasts) ----------
  useEffect(() => {
    if (!tasks || tasks.length === 0) return;
    const checkDeadlines = () => {
      const now = Date.now();
      const upcoming = new Map();

      const make = (task, idSuffix, message, toastOpts) => {
        const id = `${task._id}-${idSuffix}`;
        if (!upcoming.has(id)) {
          upcoming.set(id, { id, taskTitle: task.title, message });
          // show toast (global) and local alert
          addToast(message, toastOpts ?? { type: "warning", duration: 6000 });
        }
      };

      tasks.forEach((task) => {
        if (!task.dueDate || task.status === "Done") return;
        const diffMs = new Date(task.dueDate).getTime() - now;
        const minutesLeft = diffMs / (1000 * 60);

        if (minutesLeft > 0 && minutesLeft <= 10) {
          make(task, "due-10", `Deadline for "${task.title}" in ~${Math.ceil(minutesLeft)} minute(s).`, { type: "warning", duration: 7000 });
        } else if (minutesLeft > 10 && minutesLeft <= 60) {
          const tenBucket = Math.floor(minutesLeft / 10) * 10;
          const key = `due-${task._id}-${tenBucket}`;
          if (sessionStorage.getItem(key) !== String(tenBucket)) {
            sessionStorage.setItem(key, String(tenBucket));
            make(task, `due-${tenBucket}`, `Deadline for "${task.title}" in ~${tenBucket} minutes.`, { type: "info", duration: 5000 });
          }
        } else if (minutesLeft <= 0) {
          make(task, "due-overdue", `⚠️ "${task.title}" is overdue!`, { type: "error", duration: 9000 });
        }

        // in-progress estimated deadlines (if task has started)
        if (task.startedAt && task.estimatedCompletionTime && task.status === "In Progress") {
          const start = new Date(task.startedAt).getTime();
          const estEnd = start + task.estimatedCompletionTime * 60 * 1000;
          const msLeft = estEnd - now;
          const minsLeft = msLeft / (1000 * 60);

          if (minsLeft > 0 && minsLeft <= 5) {
            make(task, "est-urgent", `Timer: "${task.title}" completes in ~${Math.ceil(minsLeft)} minute(s).`, { type: "info", duration: 6000 });
          } else if (minsLeft <= 0) {
            const confirmKey = `confirm-shown-${task._id}`;
            if (!sessionStorage.getItem(confirmKey)) {
              // do NOT set sessionStorage here; set the confirmation modal
              setConfirmationTask(task);
              make(task, "est-ended", `⚠️ Timer ended for "${task.title}". Confirm completion.`, { type: "warning", duration: 7000 });
            }
          }
        }
      });

      setTaskAlerts((prev) => {
        const existing = new Set(prev.map((a) => a.id));
        const fresh = Array.from(upcoming.values()).filter((a) => !existing.has(a.id));
        return [...fresh, ...prev];
      });
    };

    checkDeadlines();
    const id = setInterval(checkDeadlines, 30000);
    return () => clearInterval(id);
  }, [tasks, addToast]);

  // ---------- CRUD & helpers ----------
  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const startEdit = (task) => {
    if (task.status === "Done") return;
    setEditId(task._id);
    setTitle(task.title);
    setDescription(task.description || "");
    setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : "");
    setPriority(task.priority || "No Priority");
    setAssignedTo(task.assignedTo?._id || "");
  };

  const cancelEdit = () => {
    setEditId(null);
    setTitle("");
    setDescription("");
    setDueDate("");
    setPriority("No Priority");
    setAssignedTo("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    const payload = { title: title.trim(), description: description.trim(), categoryId, dueDate: dueDate || null, priority, assignedTo: assignedTo || null };
    try {
      if (editId) {
        await authAxios.put(`/tasks/${editId}`, payload);
        addToast("Task updated.", { type: "success" });
      } else {
        await authAxios.post("/tasks", payload);
        addToast("Task created.", { type: "success" });
      }
      await fetchTasksAndCategory();
      cancelEdit();
    } catch (e) {
      if (e.response?.status === 401) handleLogout();
      else {
        console.error("Failed to save task", e);
        addToast("Failed to save task.", { type: "error" });
      }
    }
  };

  const deleteTask = async (id, status) => {
    if (status === "Done") return;
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    try {
      await authAxios.delete(`/tasks/${id}`);
      setTasks((prev) => prev.filter((t) => t._id !== id));
      addToast("Task deleted.", { type: "info" });
    } catch (e) {
      if (e.response?.status === 401) handleLogout();
      else {
        console.error("Failed to delete", e);
        addToast("Failed to delete task.", { type: "error" });
      }
    }
  };

  const toggleComplete = async (task) => {
    if (task.status === "Done") return;
    try {
      await authAxios.put(`/tasks/${task._id}`, { status: "Done" });
      addToast(`"${task.title}" marked Done.`, { type: "success" });
      await fetchTasksAndCategory();
    } catch (e) {
      if (e.response?.status === 401) handleLogout();
      else {
        console.error("Failed to mark done", e);
        addToast("Failed to mark done.", { type: "error" });
      }
    }
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    const movedTask = tasks.find((t) => t._id === draggableId);
    if (!movedTask || movedTask.status === "Done") return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    // droppableId format in your UI uses priority-status; when moving we only care about status
    const [, destStatus] = destination.droppableId.split("-");
    // Only allow To Do -> In Progress via drag. If dest is In Progress and current isn't, open estimate modal.
    if (destStatus === "In Progress" && movedTask.status !== "In Progress") {
      // store the drag result so we can perform update after estimate
      setTaskToEstimate({ result, movedTask });
      setIsModalOpen(true);
    } else {
      // For other moves (e.g., reorder within same column), call updateTaskPosition
      updateTaskPosition(result);
    }
  };

  const handleEstimationSubmit = async () => {
    if (!taskToEstimate) return setIsModalOpen(false);
    const { result, movedTask } = taskToEstimate;
    const minutes = Number(estimatedTime);
    if (!minutes || minutes <= 0) {
      addToast("Enter a valid estimate in minutes.", { type: "error" });
      return;
    }
    setIsModalOpen(false);
    setEstimatedTime("");
    setTaskToEstimate(null);
    // Prepare payload: set status In Progress, set startedAt to now and estimatedCompletionTime
    const payload = {
      status: "In Progress",
      startedAt: new Date().toISOString(),
      estimatedCompletionTime: minutes,
    };
    try {
      await authAxios.put(`/tasks/${movedTask._id}`, payload);
      addToast(`"${movedTask.title}" started (${minutes} min).`, { type: "info" });
      await fetchTasksAndCategory();
    } catch (e) {
      if (e.response?.status === 401) handleLogout();
      else {
        console.error("Failed to set estimate", e);
        addToast("Failed to start timer.", { type: "error" });
      }
    }
  };

  const updateTaskPosition = async (result, estimate = null) => {
    const { draggableId, destination } = result;
    const [destPriority, destStatus] = destination.droppableId.split("-");
    try {
      const payload = { status: destStatus, priority: destPriority };
      if (estimate) payload.estimatedCompletionTime = estimate;
      await authAxios.put(`/tasks/${draggableId}`, payload);
      await fetchTasksAndCategory();
    } catch (e) {
      if (e.response?.status === 401) handleLogout();
      else {
        console.error("Update failed", e);
        addToast("Failed to move task.", { type: "error" });
      }
    }
  };

  const handleAddComment = async (taskId) => {
    if (!newComment.trim()) return;
    try {
      const res = await authAxios.post(`/tasks/${taskId}/comments`, { content: newComment });
      setTasks((prev) => prev.map((t) => (t._id === taskId ? res.data : t)));
      setNewComment("");
    } catch (error) {
      if (error.response?.status === 401) handleLogout();
      else {
        console.error("Failed to post comment", error);
        addToast("Failed to post comment.", { type: "error" });
      }
    }
  };

  // ---------- Confirmation when timer ends ----------
  const handleConfirmCompletion = async (task, action) => {
    // action: "done" | "todo"
    if (!task) return;
    const id = task._id;
    try {
      const payload = {};
      if (action === "done") payload.status = "Done";
      else if (action === "todo") payload.status = "To Do";
      // Clear timing info
      payload.startedAt = null;
      payload.estimatedCompletionTime = null;
      await authAxios.put(`/tasks/${id}`, payload);
      // mark confirm as seen (so it doesn't reappear) — only when the user acted
      sessionStorage.setItem(`confirm-shown-${id}`, String(Date.now()));
      addToast(action === "done" ? `"${task.title}" marked Done.` : `"${task.title}" moved to To Do.`, { type: action === "done" ? "success" : "info" });
      setConfirmationTask(null);
      // refresh tasks
      await fetchTasksAndCategory();
    } catch (e) {
      if (e.response?.status === 401) handleLogout();
      else {
        console.error("Failed to confirm completion", e);
        addToast("Failed to update task.", { type: "error" });
      }
    }
  };

  // ---------- Derived lists ----------
  const completedTasks = tasks.filter((t) => t.status === "Done").sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  const activeTasks = tasks.filter((t) => t.status !== "Done");

  const groupedTasks = priorities.reduce((acc, p) => {
    const tasksInPriority = activeTasks.filter((task) => (task.priority || "No Priority") === p);
    if (tasksInPriority.length > 0) {
      acc[p] = statuses.reduce((statusAcc, s) => {
        const keyStatus = s === "To Do" ? "To Do" : "In Progress";
        statusAcc[s] = tasksInPriority
          .filter((task) => task.status === (s === "To Do" ? "To Do" : "In Progress"))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        return statusAcc;
      }, {});
    }
    return acc;
  }, {});

  // ---------- Render ----------
  return (
    <div className="category-view-container">
      <div className="completed-tasks-panel">
        <h3>✅ Completed Archive</h3>
        <div className="completed-tasks-list">
          {completedTasks.length > 0 ? (
            completedTasks.map((task) => (
              <div key={task._id} className="completed-task-item">
                <span className="completed-title">{task.title}</span>
                <span className="completed-date">
                  Completed on {task.completedAt ? new Date(task.completedAt).toLocaleDateString() : "Unknown"}
                </span>
              </div>
            ))
          ) : (
            <p className="no-completed-tasks">No tasks completed yet.</p>
          )}
        </div>
      </div>

      <div className="active-tasks-board">
        <div className="header">
          <h1>
            <Link to="/" className="back-link" title="Back to Dashboard"></Link>
            {" "}
            {categoryName || "Tasks"}
          </h1>
          <div className="user-info">
            <span>Hello, <strong>{username}</strong></span>
            <button onClick={handleLogout} className="btn btn-outline">Logout</button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="form">
          <input type="text" placeholder="New task title..." value={title} onChange={(e) => setTitle(e.target.value)} className="input" required />
          <textarea placeholder="Add a description..." value={description} onChange={(e) => setDescription(e.target.value)} className="textarea" />
          <div className="form-row">
            <input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input" />
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="input">
              {priorities.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          {category?.ownerType === "Team" && (
            <div className="form-row">
              <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="input">
                <option value="">Unassigned</option>
                {teamMembers.map((member) => (
                  <option key={member.user._id} value={member.user._id}>{member.user.username}</option>
                ))}
              </select>
            </div>
          )}
          <div className="form-actions">
            {editId && <button type="button" className="btn btn-outline" onClick={cancelEdit}>Cancel</button>}
            <button type="submit" className="btn btn-dark">{editId ? "Update Task" : "Add Task"}</button>
          </div>
        </form>

        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="priority-swimlanes">
            {Object.entries(groupedTasks).map(([priorityKey, tasksByStatus]) => (
              <div key={priorityKey} className="priority-group">
                <h2 className="priority-header" style={{ borderBottomColor: priorityStyles[priorityKey]?.color }}>
                  {priorityStyles[priorityKey]?.name || priorityKey}
                </h2>
                <div className="kanban-board">
                  {statuses.map((status) => (
                    <Droppable key={`${priorityKey}-${status}`} droppableId={`${priorityKey}-${status}`}>
                      {(provided) => (
                        <div className="kanban-column" ref={provided.innerRef} {...provided.droppableProps}>
                          <h3 className="kanban-column-title">{status}</h3>
                          <div className="kanban-column-tasks">
                            {tasksByStatus[status] && tasksByStatus[status].map((task, index) => (
                              <Draggable key={task._id} draggableId={task._id} index={index} isDragDisabled={status !== "To Do"}>
                                {(provided) => (
                                  <li className="card" ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                                    <TaskProgressBar task={task} />
                                    <div className="card-header">
                                      <div className="card-header-left">
                                        <input type="checkbox" className="task-checkbox" checked={task.status === "Done"} onChange={() => toggleComplete(task)} />
                                        <h3 className="title">{task.title}</h3>
                                      </div>
                                      <div className="actions">
                                        <button className="btn btn-icon" onClick={() => startEdit(task)}>✏️</button>
                                        <button className="btn btn-icon btn-danger" onClick={() => deleteTask(task._id, task.status)}>🗑️</button>
                                      </div>
                                    </div>

                                    {task.description && <div className="card-body"><p className="desc">{task.description}</p></div>}

                                    <div className="card-footer">
                                      <div className="task-meta">
                                        {task.assignedTo && (
                                          <span className={`assignee-badge ${task.assignedTo._id === currentUserId ? "assigned-to-me" : ""}`}>
                                            👤 {task.assignedTo._id === currentUserId ? "You" : task.assignedTo.username}
                                          </span>
                                        )}
                                        {task.dueDate && <span className="due-date">🗓️ {new Date(task.dueDate).toLocaleString()}</span>}
                                      </div>
                                      <button className="btn-comment-toggle" onClick={() => setActiveCommentTaskId(activeCommentTaskId === task._id ? null : task._id)}>💬 {task.comments?.length || 0}</button>
                                    </div>

                                    {activeCommentTaskId === task._id && (
                                      <div className="comment-section">
                                        <div className="comment-list">
                                          {task.comments && task.comments.length > 0 ? task.comments.map((comment) => (
                                            <div key={comment._id} className="comment">
                                              <strong>{comment.user.username}</strong>
                                              <p>{comment.content}</p>
                                              <span className="comment-date">{new Date(comment.createdAt).toLocaleString()}</span>
                                            </div>
                                          )) : <p className="no-comments">No comments yet.</p>}
                                        </div>
                                        <div className="comment-form">
                                          <input type="text" className="input" placeholder="Add a comment..." value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyPress={(e) => e.key === "Enter" && handleAddComment(task._id)} />
                                          <button className="btn" onClick={() => handleAddComment(task._id)}>Send</button>
                                        </div>
                                      </div>
                                    )}
                                  </li>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        </div>
                      )}
                    </Droppable>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DragDropContext>
      </div>

      {/* Estimation Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Set Estimated Completion Time</h3>
            <p>How many minutes do you think this task will take?</p>
            <div className="form-row">
              <input type="number" className="input" placeholder="e.g., 45" value={estimatedTime} onChange={(e) => setEstimatedTime(e.target.value)} />
            </div>
            <div className="form-actions">
              <button className="btn btn-dark" onClick={handleEstimationSubmit}>Set Time & Start</button>
              <button className="btn btn-outline" onClick={() => { setIsModalOpen(false); setTaskToEstimate(null); setEstimatedTime(""); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal when timer ends */}
      {confirmationTask && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Task Timer Finished</h3>
            <p>Did you complete the task: <strong>"{confirmationTask.title}"</strong>?</p>
            <div className="form-actions">
              <button className="btn btn-outline" onClick={() => { /* mark seen and move to To Do */ handleConfirmCompletion(confirmationTask, "todo"); }}>No, move to "To Do"</button>
              <button className="btn btn-dark" onClick={() => { /* mark seen and mark done */ handleConfirmCompletion(confirmationTask, "done"); }}>Yes, mark as "Done"</button>
              <button className="btn btn-outline" onClick={() => {
                // If user just wants to dismiss the modal without changing status, mark as seen so it won't keep reappearing immediately.
                sessionStorage.setItem(`confirm-shown-${confirmationTask._id}`, String(Date.now()));
                setConfirmationTask(null);
              }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Local alerts panel (bottom-right) */}
      <div className="task-alert-panel">
        <LocalToasts style={{ position: "relative" }} />
        {taskAlerts.map((alert) => (
          <div key={alert.id} className="task-alert">
            <strong>{alert.taskTitle}</strong>
            <p>{alert.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
