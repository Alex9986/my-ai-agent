import { Task } from "@/lib/types";

/**
 * Pure function — add a task to the list and return a new array.
 */
export function addTaskToList(tasks: Task[], task: Task): Task[] {
  return [...tasks, task];
}

/**
 * Pure function — update a task by id and return a new array.
 */
export function updateTaskInList(
  tasks: Task[],
  id: string,
  updates: Partial<Omit<Task, "id" | "createdAt">>
): Task[] {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return tasks;
  const next = [...tasks];
  next[index] = {
    ...next[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  return next;
}

/**
 * Pure function — delete a task by id and return a new array.
 */
export function deleteTaskFromList(tasks: Task[], id: string): Task[] {
  return tasks.filter((t) => t.id !== id);
}

/**
 * Pure function — mark a task completed or re-open it.
 */
export function completeTaskInList(
  tasks: Task[],
  id: string,
  completed: boolean
): Task[] {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return tasks;
  const next = [...tasks];
  next[index] = {
    ...next[index],
    status: completed ? "completed" : "pending",
    updatedAt: new Date().toISOString(),
  };
  return next;
}

/**
 * Pure function — search/filter tasks.
 */
export function findTasksInList(
  tasks: Task[],
  options: {
    status?: string;
    priority?: string;
    search?: string;
  }
): Task[] {
  let result = tasks;

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
