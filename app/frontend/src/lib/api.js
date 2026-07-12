import axios from "axios";
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const getBackendUrl = () => {
  const saved = localStorage.getItem("assetflow_backend_url");
  if (saved) return saved;
  if (import.meta.env.VITE_BACKEND_URL) return import.meta.env.VITE_BACKEND_URL;
  return "http://localhost:8082";
};

export const BACKEND_URL = getBackendUrl();
export const API = `${BACKEND_URL}/api`;
export const WS_URL = BACKEND_URL.replace("http", "ws") + "/api";

export const api = axios.create({
  baseURL: API,
  timeout: 15000,
  withCredentials: true,
});

// Module-scoped token store — sessionStorage survives reloads, clears on browser close
let _token = null;
export const tokenStore = {
  get: () => _token ?? sessionStorage.getItem("entry_jwt") ?? null,
  set: (t) => { _token = t; if (t) sessionStorage.setItem("entry_jwt", t); },
  clear: () => { _token = null; sessionStorage.removeItem("entry_jwt"); },
};

// Strongly scoped user data to prevent XSS exposure
let _role = null;
let _scope = null;
let _username = null;

export const userStore = {
  getRole: () => _role,
  setRole: (v) => { _role = v; },
  getScope: () => _scope,
  setScope: (v) => { _scope = v; },
  getUsername: () => _username,
  setUsername: (v) => { _username = v; },
  clear: () => { _role = null; _scope = null; _username = null; }
};

// Attach token ONLY for localhost/HTTP backend
api.interceptors.request.use((config) => {
  const isHttps = BACKEND_URL.startsWith("https");
  
  if (!isHttps) {
    const token = tokenStore.get();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  
  // Always include credentials for cookie support
  config.withCredentials = true;
  return config;
});

// Suppress auth errors in console if user is not admin
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const role = userStore.getRole();
    const isAuthError = error.response && (error.response.status === 401 || error.response.status === 403);

    if (role !== "theadmin" && isAuthError) {
      return Promise.resolve({ data: [], status: error.response.status, silenced: true });
    }

    return Promise.reject(error);
  }
);

export const endpoints = {
  stats: "/dashboard/stats",
  incidents: "/dashboard/incidents",
};
