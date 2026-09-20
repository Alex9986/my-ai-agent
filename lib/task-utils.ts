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
 * Pure function — what actually happened to one tool call.
 * `ok` = applied, everything else = skipped for a reason worth telling the user.
 */
export type ToolOutcome = "ok" | "not_found" | "invalid" | "unknown_tool";

export interface ToolExecutionRecord {
  /** Tool name the model asked for. */
  name: string;
  outcome: ToolOutcome;
  /** One-line, user-facing description of what really happened. */
  detail: string;
}

/**
 * Deterministic summary of the executed tool calls.
 *
 * Used as the reply text when the model's follow-up call is unavailable
 * (timeout, retries exhausted, empty completion). The point is honesty: the
 * user sees what the server actually did, not a canned "已经处理完成".
 */
export function buildFallbackMessage(records: ToolExecutionRecord[]): string {
  if (records.length === 0) {
    return "AI 这会儿没能回复上来，请稍后再试一次。";
  }

  const done = records.filter((r) => r.outcome === "ok");
  const skipped = records.filter((r) => r.outcome !== "ok");

  const lines: string[] = ["AI 的回复没能生成出来，不过操作已经实际执行了："];

  if (done.length > 0) {
    lines.push("", ...done.map((r) => `✅ ${r.detail}`));
  }
  if (skipped.length > 0) {
    lines.push("", ...skipped.map((r) => `⚠️ ${r.detail}`));
  }

  return lines.join("\n");
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
