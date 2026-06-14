"use client";

import { useState, useEffect, useCallback } from "react";

interface AuthState {
  username: string;
}

const AUTH_STORAGE_KEY = "ai-todo-auth";

function loadFromStorage(): AuthState | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.username !== "string" || !parsed.username) {
      return null;
    }
    return { username: parsed.username };
  } catch {
    return null;
  }
}

function saveToStorage(state: AuthState): void {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function useAuth() {
  const [user, setUser] = useState<AuthState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load auth state from localStorage on mount
  useEffect(() => {
    const stored = loadFromStorage();
    if (stored) {
      setUser(stored);
    }
    setIsLoading(false);
  }, []);

  // Listen for storage changes from other tabs
  useEffect(() => {
    function handleStorageChange(e: StorageEvent) {
      if (e.key === AUTH_STORAGE_KEY) {
        if (e.newValue === null) {
          // Auth was removed in another tab — sync logout
          setUser(null);
        } else {
          const stored = loadFromStorage();
          if (stored) {
            setUser(stored);
          }
        }
      }
    }

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const trimmedUser = username.trim();
    const trimmedPass = password.trim();

    if (!trimmedUser || !trimmedPass) {
      throw new Error("请输入用户名和密码");
    }

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: trimmedUser, password: trimmedPass }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "登录失败");
    }

    const authState: AuthState = { username: data.username };
    setUser(authState);
    saveToStorage(authState);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // silently ignore
    }
  }, []);

  const isAuthenticated = user !== null;

  return {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
  };
}
