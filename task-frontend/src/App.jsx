// src/App.jsx

import { useState, useEffect } from "react";
import axios from "axios";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useNavigate } from "react-router-dom";
import jwtDecode from "jwt-decode"; // ✅ Correct import
import "./App.css";
// Tailwind directives (e.g. `@tailwind base; @tailwind components; @tailwind utilities;`)
// must be placed in a CSS file (for example: src/App.css) — they are removed from this JSX file
// to avoid being treated as decorators in JavaScript.

const API_BASE = "http://localhost:5000/api/tasks";

export default function App() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editId, setEditId] = useState(null);
  const [username, setUsername] = useState("");

  const token = localStorage.getItem("token");

  // Decode token to get username
  useEffect(() => {
    if (token) {
      try {
        const decodedToken = jwtDecode(token);
        setUsername(decodedToken.username);
      } catch (error) {
        console.error("Invalid token:", error);
        handleLogout();
      }
    } else {
      navigate("/login");
    }
  }, [token, navigate]);

  const authAxios = axios.create({
    baseURL: API_BASE,
    headers: { Authorization: `Bearer ${token}` },
  });

  // Fetch tasks
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await authAxios.get("/");
        setTasks(res.data.sort((a, b) => a.order - b.order));
      } catch (e) {
        console.error("Failed to fetch tasks", e);
        if (e.response?.status === 401) handleLogout();
      }
    };
    if (token) fetchTasks();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return alert("Title is required.");
    const payload = { title: title.trim(), description: description.trim() };

    try {
      if (editId) {
        const res = await authAxios.put(`/${editId}`, payload);
        setTasks((prev) => prev.map((t) => (t._id === editId ? res.data : t)));
        setEditId(null);
      } else {
        const res = await authAxios.post("/", payload);
        setTasks((prev) => [...prev, res.data]);
      }
      setTitle("");
      setDescription("");
    } catch (e) {
      console.error("Save failed", e);
      alert(e?.response?.data?.error || "Failed to save the task.");
    }
  };

  const deleteTask = async (id) => {
    try {
      await authAxios.delete(`/${id}`);
      setTasks((prev) => prev.filter((t) => t._id !== id));
    } catch (e) {
      console.error("Delete failed", e);
    }
  };

  const toggleComplete = async (id) => {
    try {
      const task = tasks.find((t) => t._id === id);
      const res = await authAxios.put(`/${id}`, { completed: !task.completed });
      setTasks((prev) => prev.map((t) => (t._id === id ? res.data : t)));
    } catch (e) {
      console.error("Toggle complete failed", e);
    }
  };

  const startEdit = (task) => {
    setEditId(task._id);
    setTitle(task.title);
    setDescription(task.description || "");
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const reorderedTasks = Array.from(tasks);
    const [movedTask] = reorderedTasks.splice(result.source.index, 1);
    reorderedTasks.splice(result.destination.index, 0, movedTask);
    setTasks(reorderedTasks);

    try {
      const payload = {
        tasks: reorderedTasks.map((t, index) => ({ id: t._id, order: index })),
      };
      await authAxios.put("/reorder", payload);
    } catch (e) {
      console.error("Reorder failed", e);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <h1>📝 Task Manager</h1>
        <div className="user-info">
          <span>Hello, <strong>{username}</strong></span>
          <button onClick={handleLogout} className="btn btn-outline">
            Logout
          </button>
        </div>
      </div>

      {/* Task Form */}
      <form onSubmit={handleSubmit} className="form">
        <input
          type="text"
          placeholder="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="input"
          required
        />
        <textarea
          placeholder="Add a description..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="textarea"
        />
        <button type="submit" className="btn btn-dark">
          {editId ? "Update Task" : "Add Task"}
        </button>
      </form>

      {/* Drag & Drop Tasks */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="tasks">
          {(provided) => (
            <ul className="list" ref={provided.innerRef} {...provided.droppableProps}>
              {tasks.map((task, index) => (
                <Draggable key={task._id} draggableId={task._id} index={index}>
                  {(provided) => (
                    <li
                      className={`card ${task.completed ? "completed" : ""}`}
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                    >
                      <input
                        type="checkbox"
                        className="task-checkbox"
                        checked={task.completed}
                        onChange={() => toggleComplete(task._id)}
                      />
                      <div className="content">
                        <h3 className={`title ${task.completed ? "done" : ""}`}>
                          {task.title}
                        </h3>
                        {task.description && <p className="desc">{task.description}</p>}
                      </div>
                      <div className="actions">
                        <button className="btn btn-outline" onClick={() => startEdit(task)}>
                          Edit
                        </button>
                        <button className="btn btn-danger" onClick={() => deleteTask(task._id)}>
                          Delete
                        </button>
                      </div>
                    </li>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </ul>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}
