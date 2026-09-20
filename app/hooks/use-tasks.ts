"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Task } from "@/lib/types";
import {
  evaluateTaskSync,
  storageKeyFor,
  type TaskOrigin,
} from "@/lib/task-cache";

const SAMPLE_TASKS: Task[] = [
  {
    id: "sample-1",
    title: "整理房间",
    description: "打扫卧室和客厅，倒垃圾",
    priority: "medium",
    status: "pending",
    dueDate: new Date(Date.now() + 3600000).toISOString(),
    tags: ["生活"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "sample-2",
    title: "学习 React 19 新特性",
    description: "阅读官方文档，了解 Server Components 和 Actions",
    priority: "high",
    status: "in_progress",
    tags: ["学习", "编程"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "sample-3",
    title: "完成项目报告",
    description: "整理本周工作内容，撰写项目进度报告",
    priority: "high",
    status: "pending",
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    tags: ["工作", "紧急"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function loadFromStorage(username: string): Task[] | null {
  try {
    const raw = localStorage.getItem(storageKeyFor(username));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as Task[];
  } catch {
    return null;
  }
}

function saveToStorage(username: string, tasks: Task[]): void {
  try {
    localStorage.setItem(storageKeyFor(username), JSON.stringify(tasks));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function useTasks(username: string | null) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [ready, setReady] = useState(false);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  /** Which user the tasks currently in state belong to. */
  const dataOwnerRef = useRef<string | null>(null);
  /** How those tasks were obtained. */
  const dataOriginRef = useRef<TaskOrigin | null>(null);
  /** The exact array the loader handed to setTasks — lets the sync effect tell
   *  "unchanged since load" apart from "the user actually edited something". */
  const loadedSnapshotRef = useRef<Task[] | null>(null);

  // --- Load tasks from server (with localStorage fallback) on username change ---
  useEffect(() => {
    let cancelled = false;

    function apply(next: Task[], owner: string, origin: TaskOrigin): void {
      dataOwnerRef.current = owner;
      dataOriginRef.current = origin;
      loadedSnapshotRef.current = next;
      setTasks(next);
      setReady(true);
    }

    async function load() {
      if (!username) {
        dataOwnerRef.current = null;
        dataOriginRef.current = null;
        loadedSnapshotRef.current = null;
        setTasks([]);
        setReady(false);
        return;
      }

      setReady(false);

      // Priority 1: Server fetch
      try {
        const res = await fetch(
          `/api/tasks?username=${encodeURIComponent(username)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && Array.isArray(data.tasks)) {
            // Server has data (including empty array) — use it as-is
            apply(data.tasks, username, "server");
            return;
          }
        }
        // Non-OK response — fall back to localStorage
      } catch {
        // Server unreachable — fall back to localStorage
        console.warn("Failed to fetch tasks from server, trying localStorage...");
      }

      if (cancelled) return;

      // Priority 2: this user's own cache (only when the server is unreachable)
      const local = loadFromStorage(username);
      if (local && local.length > 0) {
        apply(local, username, "cache");
        return;
      }

      // Priority 3: Seed sample tasks — demo content, never published back
      if (!cancelled) {
        apply(SAMPLE_TASKS, username, "sample");
      }
    }

    load();
    return () => { cancelled = true; };
  }, [username]);

  // --- Sync tasks to localStorage + server on every change ---
  useEffect(() => {
    const skipReason = evaluateTaskSync({
      username,
      ready,
      dataOwner: dataOwnerRef.current,
      dataOrigin: dataOriginRef.current,
      unchangedSinceLoad: tasks === loadedSnapshotRef.current,
    });

    if (skipReason) {
      if (skipReason === "sample-data") {
        console.warn("Tasks are the sample seed — skipping server sync.");
      }
      return;
    }

    // Non-null from here on — evaluateTaskSync returns "no-user" otherwise.
    if (!username) return;

    // Cache into this user's own slot
    saveToStorage(username, tasks);

    // Fire-and-forget sync to server
    fetch("/api/tasks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, tasks }),
    }).catch((err) => console.error("Failed to sync tasks to server:", err));
  }, [tasks, username, ready]);

  // --- Mutation functions ---
  const completeTask = useCallback((id: string, completed: boolean) => {
    setTasks((prev) => {
      const index = prev.findIndex((t) => t.id === id);
      if (index === -1) return prev;
      const next = [...prev];
      next[index] = {
        ...next[index],
        status: completed ? ("completed" as const) : ("pending" as const),
        updatedAt: new Date().toISOString(),
      };
      return next;
    });
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateTask = useCallback(
    (id: string, updates: Partial<Omit<Task, "id" | "createdAt">>) => {
      setTasks((prev) => {
        const index = prev.findIndex((t) => t.id === id);
        if (index === -1) return prev;
        const next = [...prev];
        next[index] = {
          ...next[index],
          ...updates,
          updatedAt: new Date().toISOString(),
        };
        return next;
      });
    },
    []
  );

  const replaceAllTasks = useCallback((newTasks: Task[]) => {
    setTasks(newTasks);
  }, []);

  return {
    tasks,
    tasksRef,
    ready,
    completeTask,
    deleteTask,
    updateTask,
    replaceAllTasks,
  };
}
