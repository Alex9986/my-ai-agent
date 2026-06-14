import { Task } from "@/lib/types";
import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const TASKS_FILE = path.join(DATA_DIR, "tasks.json");

// ============================================================
// In-memory cache
// ============================================================
// Holds the canonical task array. On first load, reads from disk.
// Write operations update both the cache and the file atomically.
let cache: Task[] | null = null;

// ============================================================
// Mutex — serializes all file reads/writes to prevent races
// ============================================================
class Mutex {
  private _locked = false;
  private _queue: (() => void)[] = [];

  acquire(): Promise<void> {
    if (!this._locked) {
      this._locked = true;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this._queue.push(resolve);
    });
  }

  release(): void {
    if (this._queue.length > 0) {
      const next = this._queue.shift()!;
      next();
    } else {
      this._locked = false;
    }
  }
}

const lock = new Mutex();

// ============================================================
// Internal helpers (not exported — callers go through the lock)
// ============================================================

async function ensureDataDir(): Promise<void> {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
  try {
    await fs.access(TASKS_FILE);
  } catch {
    await fs.writeFile(TASKS_FILE, "[]", "utf-8");
  }
}

async function readFromDisk(): Promise<Task[]> {
  await ensureDataDir();
  const raw = await fs.readFile(TASKS_FILE, "utf-8");
  return JSON.parse(raw) as Task[];
}

async function writeToDisk(tasks: Task[]): Promise<void> {
  await ensureDataDir();
  // Atomic-ish: write to a temp file then rename
  const tmpFile = TASKS_FILE + ".tmp";
  await fs.writeFile(tmpFile, JSON.stringify(tasks, null, 2), "utf-8");
  await fs.rename(tmpFile, TASKS_FILE);
  cache = tasks;
}

// ============================================================
// Public API — all functions are async
// ============================================================

/**
 * Return all tasks (from cache if populated, otherwise load from disk).
 * The returned array is a shallow copy — mutating it won't corrupt the cache.
 */
export async function getAllTasks(): Promise<Task[]> {
  // Fast path: cache is already populated
  if (cache !== null) {
    return [...cache];
  }

  // Slow path: first load — go through the lock
  await lock.acquire();
  try {
    // Double-check: another request may have loaded while we waited
    if (cache !== null) {
      return [...cache];
    }
    cache = await readFromDisk();
    return [...cache];
  } finally {
    lock.release();
  }
}

/**
 * Add a new task and persist.
 */
export async function addTask(task: Task): Promise<Task[]> {
  await lock.acquire();
  try {
    const tasks = cache !== null ? [...cache] : await readFromDisk();
    tasks.push(task);
    await writeToDisk(tasks);
    return [...tasks];
  } finally {
    lock.release();
  }
}

/**
 * Update an existing task by id.  `updates` is merged on top of the
 * existing record (except `id` and `createdAt`, which are immutable).
 */
export async function updateTask(
  id: string,
  updates: Partial<Omit<Task, "id" | "createdAt">>
): Promise<Task[]> {
  await lock.acquire();
  try {
    const tasks = cache !== null ? [...cache] : await readFromDisk();
    const index = tasks.findIndex((t) => t.id === id);
    if (index === -1) {
      return [...tasks]; // not found — return unchanged
    }
    tasks[index] = {
      ...tasks[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await writeToDisk(tasks);
    return [...tasks];
  } finally {
    lock.release();
  }
}

/**
 * Delete a task by id.
 */
export async function deleteTask(id: string): Promise<Task[]> {
  await lock.acquire();
  try {
    const tasks = cache !== null ? [...cache] : await readFromDisk();
    const filtered = tasks.filter((t) => t.id !== id);
    if (filtered.length === tasks.length) {
      return [...tasks]; // nothing deleted
    }
    await writeToDisk(filtered);
    return [...filtered];
  } finally {
    lock.release();
  }
}

/**
 * Mark a task as completed or re-open it.
 */
export async function completeTask(
  id: string,
  completed: boolean
): Promise<Task[]> {
  await lock.acquire();
  try {
    const tasks = cache !== null ? [...cache] : await readFromDisk();
    const index = tasks.findIndex((t) => t.id === id);
    if (index === -1) {
      return [...tasks];
    }
    tasks[index] = {
      ...tasks[index],
      status: completed ? "completed" : "pending",
      updatedAt: new Date().toISOString(),
    };
    await writeToDisk(tasks);
    return [...tasks];
  } finally {
    lock.release();
  }
}

/**
 * Search / filter tasks.  This is a pure read so it doesn't acquire the
 * write lock — but it does a quick lock to load the cache on first call.
 */
export async function findTasks(options: {
  status?: string;
  priority?: string;
  search?: string;
}): Promise<Task[]> {
  const all = await getAllTasks(); // uses fast cache path after first load

  let result = all;

  if (options.status && options.status !== "all") {
    result = result.filter((t) => t.status === options.status);
  }
  if (options.priority && options.priority !== "all") {
    result = result.filter((t) => t.priority === options.priority);
  }
  if (options.search) {
    const q = options.search.toLowerCase();
    result = result.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  }

  return result;
}
