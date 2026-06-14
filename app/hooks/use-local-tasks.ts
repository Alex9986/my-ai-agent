"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Task } from "@/lib/types";

const STORAGE_KEY = "ai-todo-tasks";

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

function loadFromStorage(): Task[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as Task[];
  } catch {
    return null;
  }
}

function saveToStorage(tasks: Task[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function useLocalTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [ready, setReady] = useState(false);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  // Load on mount
  useEffect(() => {
    const existing = loadFromStorage();
    if (existing && existing.length > 0) {
      setTasks(existing);
    } else {
      // First visit — seed with sample tasks
      saveToStorage(SAMPLE_TASKS);
      setTasks(SAMPLE_TASKS);
    }
    setReady(true);
  }, []);

  // Auto-save whenever tasks change (skip initial load)
  const isInitialLoad = useRef(true);
  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    saveToStorage(tasks);
  }, [tasks]);

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
