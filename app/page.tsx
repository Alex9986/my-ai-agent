"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Menu, X, Sparkles, Moon, Sun, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import ChatPanel from "@/app/components/chat/chat-panel";
import TodoPanel from "@/app/components/todo/todo-panel";
import LoginForm from "@/app/components/auth/login-form";
import { ChatMessage, Task } from "@/lib/types";
import { useTasks } from "@/app/hooks/use-tasks";
import { useAuth } from "@/app/hooks/use-auth";
import { useToast } from "@/app/components/toast/toast-provider";
import { useKeyboardShortcuts } from "@/app/hooks/use-keyboard-shortcuts";
import { cn } from "@/lib/utils";

type MobileView = "chat" | "todo";

/** Drops locally-generated failure notices from the tail of the conversation. */
function dropTrailingErrors(list: ChatMessage[]): ChatMessage[] {
  const next = [...list];
  while (next.length > 0 && next[next.length - 1].isError) {
    next.pop();
  }
  return next;
}

export default function Home() {
  // --- Auth state ---
  const { user, isLoading: authLoading, isAuthenticated, login, logout } = useAuth();

  // --- Toast ---
  const { toast } = useToast();

  // --- Task state (server-synced per user, localStorage cached) ---
  const {
    tasks,
    tasksRef,
    ready,
    completeTask,
    deleteTask,
    updateTask,
    replaceAllTasks,
  } = useTasks(user?.username ?? null);

  // --- Chat state ---
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  // Set when the last send failed in a way that is worth replaying
  const [retryPrompt, setRetryPrompt] = useState<string | null>(null);

  // --- UI state ---
  const [mobileView, setMobileView] = useState<MobileView>("chat");
  const [darkMode, setDarkMode] = useState(false);

  // --- Dark mode ---
  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setDarkMode(isDark);
  }, []);

  const toggleDarkMode = () => {
    const newDark = !darkMode;
    setDarkMode(newDark);
    document.documentElement.classList.toggle("dark", newDark);
    localStorage.setItem("theme", newDark ? "dark" : "light");
  };

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark") {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    } else if (stored === "light") {
      setDarkMode(false);
      document.documentElement.classList.remove("dark");
    }
  }, []);

  // --- Ref to track latest messages & tasks (avoids stale closures) ---
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // --- Keyboard shortcuts ---
  useKeyboardShortcuts({
    "ctrl+k": () => {
      const el = document.querySelector<HTMLInputElement>('[data-shortcut="search"]');
      el?.focus();
    },
    "ctrl+shift+k": () => {
      const el = document.querySelector<HTMLTextAreaElement>('[data-shortcut="chat"]');
      el?.focus();
    },
  });

  // --- Send message to AI ---
  const handleSend = useCallback(
    async (content: string, options?: { retry?: boolean }) => {
      const isRetry = options?.retry === true;
      const currentMessages = messagesRef.current;
      const currentTasks = tasksRef.current;

      // On retry, drop the trailing failure notice and reuse the existing user
      // turn instead of appending a duplicate bubble.
      const base = isRetry
        ? dropTrailingErrors(currentMessages)
        : currentMessages;
      const outbound: ChatMessage[] = isRetry
        ? base
        : [
            ...base,
            {
              id: crypto.randomUUID(),
              role: "user",
              content,
              timestamp: new Date().toISOString(),
            },
          ];

      setMessages(outbound);
      setLoading(true);

      let canRetry = true;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // Failure notices are UI-only — never send them to the model.
            messages: outbound
              .filter((m) => !m.isError)
              .map((m) => ({ role: m.role, content: m.content })),
            // Send current tasks so the server can provide context + execute tool calls
            tasks: currentTasks,
            // Send browser timezone so the AI understands the user's local time
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          if (errorData.retryable === false) canRetry = false;
          throw new Error(
            typeof errorData.error === "string" && errorData.error
              ? errorData.error
              : "请求失败"
          );
        }

        const data = await response.json();

        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.message,
          timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
        setRetryPrompt(null);

        // Update localStorage with the server-returned task list
        if (data.tasks) {
          replaceAllTasks(data.tasks);
          toast(
            data.degraded
              ? "AI 回复生成失败，已直接展示实际操作结果"
              : "AI 已更新任务列表",
            data.degraded ? "warning" : "success"
          );
        }
      } catch (error) {
        // Surface the real reason (timeout / rate limit / bad key) instead of
        // pointing the user at the API key every single time.
        const reason =
          error instanceof Error && error.message
            ? error.message
            : "网络似乎不通，检查一下连接再试一次。";

        const errorMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `😅 ${reason}`,
          timestamp: new Date().toISOString(),
          isError: true,
        };
        setMessages((prev) => [...prev, errorMessage]);
        setRetryPrompt(canRetry ? content : null);
        toast(reason, "error");
      } finally {
        setLoading(false);
      }
    },
    [replaceAllTasks, tasksRef, toast]
  );

  // --- Direct task actions (localStorage, no server round-trip) ---
  const handleComplete = useCallback(
    (id: string, completed: boolean) => {
      completeTask(id, completed);
      const task = tasksRef.current.find((t) => t.id === id);
      if (task) {
        toast(
          completed ? `✅ "${task.title}" 已完成` : `↩️ "${task.title}" 已重新打开`,
          "success"
        );
      }
    },
    [completeTask, tasksRef, toast]
  );

  const handleDelete = useCallback(
    (id: string) => {
      const task = tasksRef.current.find((t) => t.id === id);
      deleteTask(id);
      if (task) {
        toast(`🗑️ "${task.title}" 已删除`, "info");
      }
    },
    [deleteTask, tasksRef, toast]
  );

  const handleUpdate = useCallback(
    async (id: string, updates: Partial<Task>) => {
      updateTask(id, updates);
      toast("✅ 任务已更新", "success");
    },
    [updateTask, toast]
  );

  // --- Auth loading state ---
  if (authLoading) {
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
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <LoginForm onLogin={login} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top bar */}
      <header className="flex-shrink-0 border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 h-12">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <h1 className="text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
              AI Todo
            </h1>
            <span className="hidden sm:inline text-[11px] text-muted-foreground">
              - 用对话管理你的任务
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Dark mode toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={toggleDarkMode}
            >
              {darkMode ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </Button>

            {/* User & Logout */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-lg text-xs gap-1.5"
              onClick={logout}
              title={`当前用户: ${user?.username}`}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{user?.username}</span>
            </Button>

            {/* Mobile view toggle */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-lg lg:hidden text-xs gap-1.5"
              onClick={() =>
                setMobileView(mobileView === "chat" ? "todo" : "chat")
              }
            >
              {mobileView === "chat" ? (
                <>
                  <Menu className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">任务</span>
                </>
              ) : (
                <>
                  <X className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">对话</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
        {/* Chat Panel */}
        <div
          className={cn(
            "overflow-hidden border-r border-border",
            mobileView === "chat" ? "flex" : "hidden lg:flex"
          )}
        >
          <ChatPanel
            messages={messages}
            loading={loading}
            onSend={handleSend}
            retryPrompt={retryPrompt}
            onRetry={() => {
              if (retryPrompt) {
                void handleSend(retryPrompt, { retry: true });
              }
            }}
          />
        </div>

        {/* Todo Panel */}
        <div
          className={cn(
            "overflow-hidden",
            mobileView === "todo" ? "flex" : "hidden lg:flex"
          )}
        >
          <TodoPanel
            tasks={tasks}
            onComplete={handleComplete}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
          />
        </div>
      </div>
    </div>
  );
}
