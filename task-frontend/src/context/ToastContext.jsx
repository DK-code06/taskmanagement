import React, { createContext, useContext, useState, useRef, useCallback } from "react";
import { Toast, ToastContainer } from "../components/ui/Toast";

/**
 * Centralized Toast Context (M4.1)
 * Preserves exact existing API while using the unified Toast primitive.
 */

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(1);

  const addToast = useCallback((message, opts = {}) => {
    const { type = "info", duration = 10000, title } = opts;

    const id = `t_${Date.now()}_${idRef.current++}`;
    const toast = { id, message, type, title, createdAt: Date.now(), visible: true };
    setToasts((s) => [toast, ...s]);

    setTimeout(() => {
      setToasts((s) => s.map((x) => (x.id === id ? { ...x, visible: false } : x)));
    }, duration);

    setTimeout(() => {
      setToasts((s) => s.filter((x) => x.id !== id));
    }, duration + 350);

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((s) => s.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}

      <ToastContainer position="top-right">
        {toasts.map((t) => (
          <Toast
            key={t.id}
            id={t.id}
            type={t.type}
            title={t.title}
            message={t.message}
            visible={t.visible}
            onClose={removeToast}
          />
        ))}
      </ToastContainer>
    </ToastContext.Provider>
  );
}

export function LocalToasts({ max = 6, style }) {
  const ctx = useContext(ToastContext);
  if (!ctx) return null;
  const { toasts, removeToast } = ctx;
  const list = toasts.slice(0, max);

  return (
    <div
      aria-live="polite"
      style={{
        position: "relative",
        zIndex: "var(--z-toast)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        ...style,
      }}
    >
      {list.map((t) => (
        <Toast
          key={t.id}
          id={t.id}
          type={t.type}
          title={t.title}
          message={t.message}
          visible={t.visible}
          onClose={removeToast}
        />
      ))}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return { addToast: ctx.addToast, toasts: ctx.toasts, removeToast: ctx.removeToast };
}
