import { NextRequest, NextResponse } from "next/server";
import {
  requestIntent,
  generateReply,
  DeepSeekError,
  type ToolInvocation,
} from "@/lib/deepseek";
import {
  addTaskToList,
  updateTaskInList,
  deleteTaskFromList,
  completeTaskInList,
  findTasksInList,
  buildFallbackMessage,
  type ToolExecutionRecord,
} from "@/lib/task-utils";
import { Task, ChatRequest, ChatResponse } from "@/lib/types";

const PRIORITY_ORDER: Record<Task["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const PRIORITY_LABEL: Record<Task["priority"], string> = {
  high: "高",
  medium: "中",
  low: "低",
};

/** Result of applying a single tool call to the task list. */
interface ToolApplication {
  tasks: Task[];
  record: ToolExecutionRecord;
  /** Handed back to the model so it can describe the outcome truthfully. */
  payload: Record<string, unknown>;
}

function isPriority(value: unknown): value is Task["priority"] {
  return value === "high" || value === "medium" || value === "low";
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

function notFound(
  tasks: Task[],
  name: string,
  id: string | undefined,
  action: string
): ToolApplication {
  return {
    tasks,
    record: {
      name,
      outcome: "not_found",
      detail: id
        ? `没找到要${action}的任务（ID ${shortId(id)}），可能已经被删掉了`
        : `想${action}任务，但没说明是哪一个，这条跳过了`,
    },
    payload: { success: false, error: "task_not_found", id: id ?? null },
  };
}

/**
 * Applies one tool call to the task list and reports exactly what happened.
 * Every tool call gets a record — including the ones that are skipped — so the
 * model (and the local fallback) can tell the user about partial failures
 * instead of claiming everything worked.
 */
function applyToolCall(
  tasks: Task[],
  name: string,
  args: Record<string, unknown>
): ToolApplication {
  switch (name) {
    case "add_task": {
      const title = asString(args.title);
      if (!title) {
        return {
          tasks,
          record: {
            name,
            outcome: "invalid",
            detail: "想新增任务但没给出标题，这条跳过了",
          },
          payload: { success: false, error: "missing_title" },
        };
      }

      const newTask: Task = {
        id: crypto.randomUUID(),
        title,
        description: asString(args.description),
        priority: isPriority(args.priority) ? args.priority : "medium",
        status: "pending",
        dueDate: asString(args.dueDate),
        tags: toStringArray(args.tags),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      return {
        tasks: addTaskToList(tasks, newTask),
        record: {
          name,
          outcome: "ok",
          detail: `新增任务「${newTask.title}」（${PRIORITY_LABEL[newTask.priority]}优先级）`,
        },
        payload: {
          success: true,
          task: {
            id: newTask.id,
            title: newTask.title,
            priority: newTask.priority,
            status: newTask.status,
            dueDate: newTask.dueDate,
            tags: newTask.tags,
          },
        },
      };
    }

    case "update_task": {
      const id = asString(args.id);
      const target = id ? tasks.find((t) => t.id === id) : undefined;
      if (!target || !id) return notFound(tasks, name, id, "修改");

      const updates: Partial<Omit<Task, "id" | "createdAt">> = {};

      if (args.title !== undefined) {
        const title = asString(args.title);
        if (!title) {
          return {
            tasks,
            record: {
              name,
              outcome: "invalid",
              detail: "想改标题但新标题是空的，这条跳过了",
            },
            payload: { success: false, error: "empty_title" },
          };
        }
        updates.title = title;
      }
      if (args.description !== undefined) {
        updates.description = asString(args.description) ?? "";
      }
      if (isPriority(args.priority)) updates.priority = args.priority;
      if (args.dueDate !== undefined) updates.dueDate = asString(args.dueDate);
      if (args.tags !== undefined) updates.tags = toStringArray(args.tags);

      const fields = Object.keys(updates);
      if (fields.length === 0) {
        return {
          tasks,
          record: {
            name,
            outcome: "invalid",
            detail: `想修改「${target.title}」但没给出任何新内容，这条跳过了`,
          },
          payload: { success: false, error: "no_changes" },
        };
      }

      return {
        tasks: updateTaskInList(tasks, id, updates),
        record: {
          name,
          outcome: "ok",
          detail: `已更新任务「${target.title}」（${fields.join("、")}）`,
        },
        payload: { success: true, title: target.title, updatedFields: fields },
      };
    }

    case "delete_task": {
      const id = asString(args.id);
      const target = id ? tasks.find((t) => t.id === id) : undefined;
      if (!target || !id) return notFound(tasks, name, id, "删除");

      return {
        tasks: deleteTaskFromList(tasks, id),
        record: {
          name,
          outcome: "ok",
          detail: `已删除任务「${target.title}」`,
        },
        payload: { success: true, deleted: target.title },
      };
    }

    case "complete_task": {
      const id = asString(args.id);
      const target = id ? tasks.find((t) => t.id === id) : undefined;
      if (!target || !id) return notFound(tasks, name, id, "标记");

      const completed = args.completed === true;

      return {
        tasks: completeTaskInList(tasks, id, completed),
        record: {
          name,
          outcome: "ok",
          detail: `已把「${target.title}」标记为${completed ? "已完成" : "未完成"}`,
        },
        payload: {
          success: true,
          title: target.title,
          status: completed ? "completed" : "pending",
        },
      };
    }

    case "list_tasks": {
      const filtered = findTasksInList(tasks, {
        status: asString(args.status),
        priority: asString(args.priority),
        search: asString(args.search),
      });

      const preview = filtered
        .slice(0, 5)
        .map((t) => t.title)
        .join("、");

      return {
        tasks,
        record: {
          name,
          outcome: "ok",
          detail:
            filtered.length === 0
              ? "查询完成，没有符合条件的任务"
              : `查询到 ${filtered.length} 条任务${
                  preview ? `：${preview}${filtered.length > 5 ? " 等" : ""}` : ""
                }`,
        },
        payload: {
          success: true,
          count: filtered.length,
          tasks: filtered.map((t) => ({
            id: t.id,
            title: t.title,
            priority: t.priority,
            status: t.status,
            dueDate: t.dueDate,
            tags: t.tags,
          })),
        },
      };
    }

    default:
      return {
        tasks,
        record: {
          name,
          outcome: "unknown_tool",
          detail: `不认识的操作「${name}」，这条跳过了`,
        },
        payload: { success: false, error: "unknown_tool" },
      };
  }
}

/** Maps a DeepSeek failure onto an HTTP status and a message worth showing. */
function toClientError(error: DeepSeekError): {
  status: number;
  message: string;
  retryable: boolean;
} {
  switch (error.kind) {
    case "config":
      return {
        status: 500,
        message: "服务端还没配置 DEEPSEEK_API_KEY，补上环境变量再试。",
        retryable: false,
      };
    case "rate_limit":
      return {
        status: 429,
        message: "请求太频繁了，等几秒再发一次就好。",
        retryable: true,
      };
    case "timeout":
      return {
        status: 504,
        message: "AI 响应超时了，重新发一次通常就好了。",
        retryable: true,
      };
    case "network":
      return {
        status: 503,
        message: "连不上 AI 服务，检查一下网络再重试。",
        retryable: true,
      };
    case "client":
      if (error.status === 401 || error.status === 403) {
        return {
          status: 502,
          message: "DeepSeek API Key 无效或没有权限。",
          retryable: false,
        };
      }
      if (error.status === 402) {
        return {
          status: 502,
          message: "DeepSeek 账户余额不足，充值后再试。",
          retryable: false,
        };
      }
      return {
        status: 502,
        message: `DeepSeek 拒绝了这次请求（${error.status ?? "未知状态"}），可能是对话太长了。`,
        retryable: false,
      };
    case "server":
    default:
      return {
        status: 502,
        message: "AI 服务暂时不可用，稍后重试一下。",
        retryable: true,
      };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();

    if (!body.messages || !Array.isArray(body.messages)) {
      return NextResponse.json(
        { error: "messages array is required" },
        { status: 400 }
      );
    }

    // Tasks come from the client (localStorage).  Server is stateless.
    const clientTasks: Task[] = Array.isArray(body.tasks) ? body.tasks : [];

    // Sort tasks to match the Todo panel display order:
    // incomplete first (priority: high → medium → low), then completed
    const sortedTasks = [...clientTasks].sort((a, b) => {
      if (a.status !== "completed" && b.status === "completed") return -1;
      if (a.status === "completed" && b.status !== "completed") return 1;
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    });

    // Build numbered task list for the AI (so it understands "倒数第二个" etc.)
    const taskContext = sortedTasks.map((t, i) => ({
      index: i + 1, // 1-based index for natural language reference
      id: t.id,
      title: t.title,
      description: t.description,
      priority: t.priority,
      status: t.status,
      dueDate: t.dueDate,
      tags: t.tags,
    }));

    const timezone = body.timezone || "Asia/Shanghai";

    // Step 1 — ask the model what it wants to do. Nothing has been modified yet.
    const intent = await requestIntent(body.messages, taskContext, timezone);

    // Step 2 — execute the requested tools for real, recording every outcome.
    let updatedTasks: Task[] = clientTasks;
    const records: ToolExecutionRecord[] = [];
    const toolResults: { toolCallId: string; content: string }[] = [];

    for (const call of intent.toolCalls) {
      const applied = applyCall(call, updatedTasks);
      updatedTasks = applied.tasks;
      records.push(applied.record);
      toolResults.push({
        toolCallId: call.id,
        content: JSON.stringify(applied.payload),
      });
    }

    // Step 3 — let the model phrase the outcome, now with the real results.
    let message: string;
    let degraded = false;

    if (intent.continuation) {
      try {
        const reply = await generateReply(intent.continuation, toolResults);
        if (reply) {
          message = reply;
        } else {
          message = buildFallbackMessage(records);
          degraded = true;
        }
      } catch (error) {
        // The work is already done — only the wording failed. Say what really
        // happened instead of a blanket "已经处理完成".
        console.error("生成回复失败，改用本地结果摘要：", error);
        message = buildFallbackMessage(records);
        degraded = true;
      }
    } else {
      message = intent.message ?? buildFallbackMessage(records);
    }

    const response: ChatResponse = { message, tasks: updatedTasks, degraded };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Chat API error:", error);

    if (error instanceof DeepSeekError) {
      const { status, message, retryable } = toClientError(error);
      return NextResponse.json({ error: message, retryable }, { status });
    }

    return NextResponse.json(
      { error: "服务器出了点小状况，请稍后再试。", retryable: true },
      { status: 500 }
    );
  }
}

/**
 * Wraps applyToolCall so a model that emitted unparseable arguments still gets
 * a matching tool result — DeepSeek rejects a tool_calls turn that is not
 * followed by one tool message per call id.
 */
function applyCall(call: ToolInvocation, tasks: Task[]): ToolApplication {
  if (call.argumentsError) {
    return {
      tasks,
      record: {
        name: call.name,
        outcome: "invalid",
        detail: `「${call.name}」的参数不是合法 JSON，这条跳过了`,
      },
      payload: {
        success: false,
        error: "invalid_arguments",
        detail: call.argumentsError,
      },
    };
  }

  return applyToolCall(tasks, call.name, call.args);
}
