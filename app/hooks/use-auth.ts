"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AuthState,
  StorageLike,
  clearAuthState,
  restoreSession,
  writeAuthState,
} from "@/lib/auth-session";

/**
 * Touching window.localStorage / window.sessionStorage can throw outright when
 * the browser blocks site data, so both lookups are guarded.
 */
function getStorage(kind: "session" | "local"): StorageLike | null {
  try {
    return kind === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

export function useAuth() {
  const [user, setUser] = useState<AuthState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // --- Restore the session for this tab only ---
  // The session lives in sessionStorage, so a freshly opened tab or a browser
  // that was just started finds nothing here and lands on the login screen.
  // Any session left behind in localStorage by an older build is purged.
  useEffect(() => {
    const session = getStorage("session");
    const legacy = getStorage("local");
    const stored = restoreSession(session, legacy);
    if (stored) {
      setUser(stored);
    }
    setIsLoading(false);
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

    const session = getStorage("session");
    if (session) {
      writeAuthState(session, authState);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);

    const session = getStorage("session");
    if (session) {
      clearAuthState(session);
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
