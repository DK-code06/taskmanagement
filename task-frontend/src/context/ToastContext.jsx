import React, { createContext, useContext, useState, useRef, useCallback } from "react";

/**
 * Toast context - lightweight, no external libs.
 *
 * Usage:
 * 1. Wrap your app with <ToastProvider> in index.jsx or App.jsx.
 * 2. Use const { addToast } = useToast(); to fire a toast.
 * 3. Place <LocalToasts /> where you want local copies (e.g. in CategoryView).
 */

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(1);

  const addToast = useCallback((message, opts = {}) => {
    // opts: { type: 'info'|'success'|'warning'|'error', duration: milliseconds }
    const { type = "info", duration = 10000 } = opts; // default 10 seconds

    const id = `t_${Date.now()}_${idRef.current++}`;
    const toast = { id, message, type, createdAt: Date.now(), visible: true };
    setToasts((s) => [toast, ...s]);

    // auto-hide
    setTimeout(() => {
      setToasts((s) => s.map((x) => (x.id === id ? { ...x, visible: false } : x)));
    }, duration);

    // remove after fade (extra 300ms)
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

      {/* GLOBAL top-right container (fixed) — useful for header / dashboard */}
      <div
        aria-live="polite"
        style={{
          position: "fixed",
          top: 14,
          right: 14,
          zIndex: 4000,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          alignItems: "flex-end",
          maxWidth: 420,
          pointerEvents: "none", // allow clicks to pass through empty areas
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            style={{
              pointerEvents: "auto",
              minWidth: 260,
              maxWidth: 420,
              background: "#fff",
              borderLeft: `6px solid ${_typeColor(t.type)}`,
              boxShadow: "0 8px 26px rgba(2,6,23,0.12)",
              padding: "10px 12px",
              borderRadius: 10,
              transform: t.visible ? "translateY(0) scale(1)" : "translateY(-6px) scale(.98)",
              opacity: t.visible ? 1 : 0,
              transition: "transform 220ms ease, opacity 220ms ease",
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              color: "#111827",
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, background: _typeColor(t.type) }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>
                {_typeTitle(t.type)}
              </div>
              <div style={{ fontSize: 13, color: "#374151" }}>{t.message}</div>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              aria-label="Dismiss toast"
              style={{ background: "transparent", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 16 }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// helper to show local toasts copy in the page (place LocalToasts in CategoryView)
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
        zIndex: 1200,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        ...style,
      }}
    >
      {list.map((t) => (
        <div
          key={t.id}
          role="status"
          aria-live="polite"
          style={{
            minWidth: 240,
            background: "#fff",
            borderLeft: `5px solid ${_typeColor(t.type)}`,
            boxShadow: "0 6px 18px rgba(2,6,23,0.08)",
            padding: "10px 12px",
            borderRadius: 10,
            transform: t.visible ? "translateY(0) scale(1)" : "translateY(-6px) scale(.98)",
            opacity: t.visible ? 1 : 0,
            transition: "transform 220ms ease, opacity 220ms ease",
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            color: "#111827",
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, background: _typeColor(t.type) }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{_typeTitle(t.type)}</div>
            <div style={{ fontSize: 13, color: "#374151" }}>{t.message}</div>
          </div>
          <button
            onClick={() => removeToast(t.id)}
            aria-label="Dismiss toast"
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 16 }}
          >
            ×
          </button>
        </div>
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

/* ---------- Helpers ---------- */
function _typeColor(type) {
  switch (type) {
    case "success":
      return "#16a34a";
    case "warning":
      return "#d97706";
    case "error":
      return "#d32f2f";
    default:
      return "#3f51b5";
  }
}
function _typeTitle(type) {
  switch (type) {
    case "success":
      return "Success";
    case "warning":
      return "Attention";
    case "error":
      return "Error";
    default:
      return "Info";
  }
}
