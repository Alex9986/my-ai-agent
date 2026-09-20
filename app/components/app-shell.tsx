"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Menu, X, Sparkles, Moon, Sun, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import ChatPanel from "@/app/components/chat/chat-panel";
import TodoPanel from "@/app/components/todo/todo-panel";
import { ChatMessage, Task } from "@/lib/types";
import { useTasks } from "@/app/hooks/use-tasks";
import { useToast } from "@/app/components/toast/toast-provider";
import { useKeyboardShortcuts } from "@/app/hooks/use-keyboard-shortcuts";
import { cn } from "@/lib/utils";

type MobileView = "chat" | "todo";

interface AppShellProps {
  /** The signed-in user. The parent remounts this whole component per username. */
  username: string;
  onLogout: () => void;
}

/** Drops locally-generated failure notices from the tail of the conversation. */
function dropTrailingErrors(list: ChatMessage[]): ChatMessage[] {
  const next = [...list];
  while (next.length > 0 && next[next.length - 1].isError) {
    next.pop();
  }
  return next;
}

/**
 * Everything the signed-in user sees.
 *
 * This component is mounted by <Home> as `<AppShell key={username} />`, so
 * changing the account destroys and recreates it. That is what keeps chat
 * history from leaking across users — there is no manual cleanup to forget.
 *
 * Chat history is deliberately session-only: it lives in this component's
 * state and is never written to storage. A page refresh already starts blank;
 * the `pageshow` handler below covers the one case where the browser brings
 * the old state back with it (back/forward cache restore).
 */
export default function AppShell({ username, onLogout }: AppShellProps) {
  // --- Toast ---
  const { toast } = useToast();

  // --- Task state (server-synced per user, localStorage cached per user) ---
  const {
    tasks,
    tasksRef,
    completeTask,
    deleteTask,
    updateTask,
    replaceAllTasks,
  } = useTasks(username);

  // --- Chat state (in memory only, intentionally not persisted) ---
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

  // --- Session boundary ---
  // A page restored from the back/forward cache resumes with its JavaScript
  // state intact, so a browser that was closed and reopened could show the
  // previous session's conversation. Wipe the chat when that happens.
  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        setMessages([]);
        setRetryPrompt(null);
        setLoading(false);
      }
    }

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  // --- Ref to track latest messages (avoids stale closures) ---
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

        // Adopt the server-returned task list (the hook persists it)
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

  // --- Direct task actions (server-synced via the hook) ---
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
              onClick={onLogout}
              title={`当前用户: ${username}`}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{username}</span>
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
