import React, { createContext, useContext, useState, useEffect } from "react";
import { BACKEND_URL, tokenStore, userStore } from "@/lib/api";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [role, setRole] = useState(null);
  const [scope, setScope] = useState(null);
  const [username, setUsername] = useState(null);
  const [departmentId, setDepartmentId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const isAuthenticated = !!role;

  useEffect(() => {
    const checkAuth = async () => {
      // Token lives in sessionStorage (survives reload, dies on browser close)
      let token = tokenStore.get();

      const isHttps = BACKEND_URL.startsWith("https");
      if (isHttps) {
        // HTTPS: ignore local token, rely on HttpOnly cookie
        token = null;
        tokenStore.clear();
      }

      const fetchOptions = (token && !isHttps)
        ? { headers: { Authorization: `Bearer ${token}` } }
        : { credentials: "include" };

      try {
        const response = await fetch(`${BACKEND_URL}/api/auth/me`, fetchOptions);
        if (response.ok) {
          const data = await response.json();
          setRole(data.role);
          setScope(data.scope);
          setUsername(data.username);
          setDepartmentId(data.department_id);
          userStore.setRole(data.role);
          userStore.setScope(data.scope);
          userStore.setUsername(data.username);

          if (isHttps) {
            tokenStore.clear();
          } else {
            // Clear stray cookies on HTTP
            document.cookie = "entry_jwt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
          }
        } else {
          tokenStore.clear();
          userStore.clear();
          setRole(null);
          setScope(null);
        }
      } catch (_) {
        tokenStore.clear();
        userStore.clear();
        setRole(null);
        setScope(null);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = async (email, password) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) throw new Error("Invalid credentials");

      const data = await response.json();

      if (data.access_token) {
        const isHttps = BACKEND_URL.startsWith("https");
        if (isHttps) {
          tokenStore.clear();
        } else {
          tokenStore.set(data.access_token);
          document.cookie = "entry_jwt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        }
      }

      setRole(data.role);
      setScope(data.scope);
      setUsername(data.username || email);
      userStore.setRole(data.role);
      userStore.setScope(data.scope);
      userStore.setUsername(data.username || email);
      return true;
    } catch (err) {
      console.error("LOGIN FAILURE EXCEPTION:", err);
      return false;
    }
  };

  const logout = async () => {
    try {
      const token = tokenStore.get();
      await fetch(`${BACKEND_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (e) {
      console.error("Logout request failed, proceeding with client-side wipe", e);
    }

    tokenStore.clear();
    userStore.clear();
    document.cookie = "entry_jwt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    setRole(null);
    setScope(null);
    setUsername(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-t-[var(--primary)] border-[var(--border)] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, role, scope, username, departmentId, isLoading, login, logout, setRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
