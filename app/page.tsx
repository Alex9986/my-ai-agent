"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Menu, X, Sparkles, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import ChatPanel from "@/app/components/chat/chat-panel";
import TodoPanel from "@/app/components/todo/todo-panel";
import { ChatMessage, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

type MobileView = "chat" | "todo";

export default function Home() {
  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>("chat");
  const [darkMode, setDarkMode] = useState(false);

  // Load initial tasks
  useEffect(() => {
    fetch("/api/tasks")
      .then((res) => res.json())
      .then((data) => {
        if (data.tasks) setTasks(data.tasks);
      })
      .catch(console.error);
  }, []);

  // Dark mode
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

  // Initialize dark mode from localStorage
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

  // Ref to track latest messages (avoids stale closure)
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Send message to AI
  const handleSend = useCallback(async (content: string) => {
    const currentMessages = messagesRef.current;
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...currentMessages, userMessage];
    setMessages(newMessages);
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "请求失败");
      }

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.message,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      if (data.tasks) setTasks(data.tasks);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          "抱歉，出了点问题 😅 请检查 API Key 是否正确配置，然后重试。",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Direct task actions (no AI call)
  const handleComplete = useCallback(async (id: string, completed: boolean) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
      const data = await res.json();
      if (data.tasks) setTasks(data.tasks);
    } catch (error) {
      console.error("Failed to update task:", error);
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.tasks) setTasks(data.tasks);
    } catch (error) {
      console.error("Failed to delete task:", error);
    }
  }, []);

  const handleUpdate = useCallback(
    async (id: string, updates: Partial<Task>) => {
      try {
        const res = await fetch(`/api/tasks/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        const data = await res.json();
        if (data.tasks) setTasks(data.tasks);
      } catch (error) {
        console.error("Failed to update task:", error);
      }
    },
    []
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
