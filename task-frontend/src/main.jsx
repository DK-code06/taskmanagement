import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import CategoryView from "./pages/CategoryView";
import Login from "./pages/Login";
import Register from "./pages/Register";
import { SocketProvider } from "./context/SocketContext";
import { ToastProvider } from "./context/ToastContext"; // ✅ Add ToastProvider
import "./index.css";
import "./App.css";

// This component protects routes that require a user to be logged in
function PrivateRoute({ children }) {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" replace />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      {/* ✅ Wrap all routes with both providers */}
      <SocketProvider>
        <ToastProvider>
          <Routes>
            {/* Private Routes */}
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/category/:categoryId"
              element={
                <PrivateRoute>
                  <CategoryView />
                </PrivateRoute>
              }
            />

            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Catch-all to redirect any other URL to the home page */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </SocketProvider>
    </BrowserRouter>
  </React.StrictMode>
);
