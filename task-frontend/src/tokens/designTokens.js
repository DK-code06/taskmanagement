// Centralized Design Tokens for Task Management UI (M4.1)

export const colors = {
  primary: {
    DEFAULT: "#3b82f6", // Blue 500
    hover: "#2563eb",   // Blue 600
    active: "#1d4ed8",  // Blue 700
    light: "#eff6ff",   // Blue 50
    border: "#93c5fd",  // Blue 300
  },
  secondary: {
    DEFAULT: "#64748b", // Slate 500
    hover: "#475569",   // Slate 600
    active: "#334155",  // Slate 700
    light: "#f8fafc",   // Slate 50
    border: "#cbd5e1",  // Slate 300
  },
  background: {
    DEFAULT: "#f8fafc", // Slate 50
    paper: "#ffffff",
    subtle: "#f1f5f9",  // Slate 100
  },
  surface: {
    DEFAULT: "#ffffff",
    elevated: "#ffffff",
    hover: "#f8fafc",
    selected: "#eff6ff",
  },
  border: {
    DEFAULT: "#e2e8f0", // Slate 200
    subtle: "#f1f5f9",  // Slate 100
    strong: "#cbd5e1",  // Slate 300
    focus: "#3b82f6",   // Blue 500
  },
  text: {
    primary: "#0f172a",   // Slate 900
    secondary: "#334155", // Slate 700 (High contrast: WCAG AA >= 4.5:1 on light background)
    muted: "#64748b",     // Slate 500
    inverse: "#ffffff",
    disabled: "#94a3b8",  // Slate 400
  },
  success: {
    DEFAULT: "#16a34a", // Green 600
    hover: "#15803d",
    light: "#f0fdf4",
    border: "#86efac",
    text: "#14532d",
  },
  warning: {
    DEFAULT: "#d97706", // Amber 600
    hover: "#b45309",
    light: "#fffbeb",
    border: "#fde68a",
    text: "#78350f",
  },
  danger: {
    DEFAULT: "#dc2626", // Red 600
    hover: "#b91c1c",
    light: "#fef2f2",
    border: "#fca5a5",
    text: "#7f1d1d",
  },
  info: {
    DEFAULT: "#0284c7", // Sky 600
    hover: "#0369a1",
    light: "#f0f9ff",
    border: "#7dd3fc",
    text: "#0c4a6e",
  },
};

export const typography = {
  fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontSize: {
    xs: "0.75rem",   // 12px
    sm: "0.875rem",  // 14px
    md: "1rem",      // 16px
    lg: "1.125rem",  // 18px
    xl: "1.25rem",   // 20px
    "2xl": "1.5rem",  // 24px
    "3xl": "1.875rem" // 30px
  },
  fontWeight: {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
  lineHeight: {
    tight: "1.25",
    normal: "1.5",
    relaxed: "1.75",
  },
};

export const spacing = {
  xs: "0.25rem", // 4px
  sm: "0.5rem",  // 8px
  md: "1rem",    // 16px
  lg: "1.5rem",  // 24px
  xl: "2rem",    // 32px
  "2xl": "3rem", // 48px
};

export const radius = {
  none: "0",
  sm: "0.25rem", // 4px
  md: "0.5rem",  // 8px
  lg: "0.75rem", // 12px
  xl: "1rem",    // 16px
  full: "9999px",
};

export const shadows = {
  none: "none",
  subtle: "0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)",
  elevated: "0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -1px rgba(0, 0, 0, 0.04)",
  modal: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
  focus: "0 0 0 3px rgba(59, 130, 246, 0.35)",
};

export const motion = {
  fast: "150ms cubic-bezier(0.4, 0, 0.2, 1)",
  normal: "200ms cubic-bezier(0.4, 0, 0.2, 1)",
  slow: "300ms cubic-bezier(0.4, 0, 0.2, 1)",
};

export const zIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  modal: 50,
  toast: 60,
  tooltip: 70,
};

export const breakpoints = {
  xs: "320px",
  sm: "480px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1440px",
  "3xl": "1920px",
};

export default {
  colors,
  typography,
  spacing,
  radius,
  shadows,
  motion,
  zIndex,
  breakpoints,
};
