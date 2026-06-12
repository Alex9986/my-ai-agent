import { Task } from "@/lib/types";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const TASKS_FILE = path.join(DATA_DIR, "tasks.json");

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(TASKS_FILE)) {
    fs.writeFileSync(TASKS_FILE, "[]", "utf-8");
  }
}

export function getAllTasks(): Task[] {
  ensureDataDir();
  const raw = fs.readFileSync(TASKS_FILE, "utf-8");
  return JSON.parse(raw) as Task[];
}

export function saveAllTasks(tasks: Task[]): void {
  ensureDataDir();
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), "utf-8");
}

export function addTask(task: Task): Task[] {
  const tasks = getAllTasks();
  tasks.push(task);
  saveAllTasks(tasks);
  return tasks;
}

export function updateTask(id: string, updates: Partial<Omit<Task, "id" | "createdAt">>): Task[] {
  const tasks = getAllTasks();
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return tasks;
  tasks[index] = {
    ...tasks[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  saveAllTasks(tasks);
  return tasks;
}

export function deleteTask(id: string): Task[] {
  let tasks = getAllTasks();
  tasks = tasks.filter((t) => t.id !== id);
  saveAllTasks(tasks);
  return tasks;
}

export function completeTask(id: string, completed: boolean): Task[] {
  const tasks = getAllTasks();
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return tasks;
  tasks[index] = {
    ...tasks[index],
    status: completed ? "completed" : "pending",
    updatedAt: new Date().toISOString(),
  };
  saveAllTasks(tasks);
  return tasks;
}

export function findTasks(options: {
  status?: string;
  priority?: string;
  search?: string;
}): Task[] {
  let tasks = getAllTasks();

  if (options.status && options.status !== "all") {
    tasks = tasks.filter((t) => t.status === options.status);
  }
  if (options.priority && options.priority !== "all") {
    tasks = tasks.filter((t) => t.priority === options.priority);
  }
  if (options.search) {
    const q = options.search.toLowerCase();
    tasks = tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  }

  return tasks;
}
