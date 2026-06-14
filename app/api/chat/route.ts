import { NextRequest, NextResponse } from "next/server";
import { callDeepSeek } from "@/lib/deepseek";
import {
  addTaskToList,
  updateTaskInList,
  deleteTaskFromList,
  completeTaskInList,
  findTasksInList,
} from "@/lib/task-utils";
import { Task, ChatRequest, ChatResponse } from "@/lib/types";

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
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const sortedTasks = [...clientTasks].sort((a, b) => {
      if (a.status !== "completed" && b.status === "completed") return -1;
      if (a.status === "completed" && b.status !== "completed") return 1;
      return priorityOrder[a.priority] - priorityOrder[b.priority];
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

    // Call DeepSeek
    const timezone = body.timezone || "Asia/Shanghai";
    const result = await callDeepSeek(body.messages, taskContext, timezone);

    // Execute tool calls against the client-provided task list (pure functions)
    let updatedTasks: Task[] = clientTasks;
    for (const toolCall of result.toolCalls) {
      const args = toolCall.arguments;

      switch (toolCall.name) {
        case "add_task": {
          const newTask: Task = {
            id: crypto.randomUUID(),
            title: args.title as string,
            description: args.description as string | undefined,
            priority: (args.priority as Task["priority"]) || "medium",
            status: "pending",
            dueDate: args.dueDate as string | undefined,
            tags: (args.tags as string[]) || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          updatedTasks = addTaskToList(updatedTasks, newTask);
          break;
        }

        case "update_task": {
          const id = args.id as string;
          const updates: Partial<Omit<Task, "id" | "createdAt">> = {};
          if (args.title !== undefined) updates.title = args.title as string;
          if (args.description !== undefined)
            updates.description = args.description as string;
          if (args.priority !== undefined)
            updates.priority = args.priority as Task["priority"];
          if (args.dueDate !== undefined)
            updates.dueDate = args.dueDate as string;
          if (args.tags !== undefined) updates.tags = args.tags as string[];
          updatedTasks = updateTaskInList(updatedTasks, id, updates);
          break;
        }

        case "delete_task": {
          const id = args.id as string;
          updatedTasks = deleteTaskFromList(updatedTasks, id);
          break;
        }

        case "complete_task": {
          const id = args.id as string;
          const completed = args.completed as boolean;
          updatedTasks = completeTaskInList(updatedTasks, id, completed);
          break;
        }

        case "list_tasks": {
          const filteredTasks = findTasksInList(updatedTasks, {
            status: args.status as string | undefined,
            priority: args.priority as string | undefined,
            search: args.search as string | undefined,
          });
          // list_tasks is read-only — updatedTasks stays as-is
          // (the AI response already describes the filtered results)
          break;
        }
      }
    }

    const response: ChatResponse = {
      message: result.message,
      tasks: updatedTasks,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
