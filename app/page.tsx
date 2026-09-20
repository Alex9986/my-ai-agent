"use client";

import LoginForm from "@/app/components/auth/login-form";
import AppShell from "@/app/components/app-shell";
import { useAuth } from "@/app/hooks/use-auth";

export default function Home() {
  const { user, isLoading, isAuthenticated, login, logout } = useAuth();

  // --- Auth loading state ---
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  // --- Unauthenticated state ---
  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <LoginForm onLogin={login} />
      </div>
    );
  }

  // The key is what isolates users: whenever the account changes, React tears
  // the shell down and builds a new one, so no per-user state (chat history,
  // filter tabs, drafts) can survive the swap. The session itself is scoped to
  // the tab, so signing in here never reaches into another tab's state.
  return <AppShell key={user.username} username={user.username} onLogout={logout} />;
}
