// src/config.js
// Dynamic Backend & API URL configuration supporting local development and production Vercel deployment

export const BACKEND_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
export const API_BASE = `${BACKEND_URL}/api`;
