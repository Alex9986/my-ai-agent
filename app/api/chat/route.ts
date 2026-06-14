import { NextRequest, NextResponse } from "next/server";
import { callDeepSeek } from "@/lib/deepseek";
import {
  getAllTasks,
  addTask,
  updateTask,
  deleteTask,
  completeTask,
  findTasks,
} from "@/lib/task-store";
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

    // Get current tasks for context
    const currentTasks = await getAllTasks();

    // Sort tasks to match the Todo panel display order:
    // incomplete first (priority: high → medium → low), then completed
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const sortedTasks = [...currentTasks].sort((a, b) => {
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
    const result = await callDeepSeek(body.messages, taskContext);

    // Execute tool calls
    let updatedTasks: Task[] = currentTasks;
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
          updatedTasks = await addTask(newTask);
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
          updatedTasks = await updateTask(id, updates);
          break;
        }

        case "delete_task": {
          const id = args.id as string;
          updatedTasks = await deleteTask(id);
          break;
        }

        case "complete_task": {
          const id = args.id as string;
          const completed = args.completed as boolean;
          updatedTasks = await completeTask(id, completed);
          break;
        }

        case "list_tasks": {
          const filteredTasks = findTasks({
            status: args.status as string | undefined,
            priority: args.priority as string | undefined,
            search: args.search as string | undefined,
          });
          // For list_tasks, we don't modify tasks, just let the AI report back
          // But we ensure updatedTasks is set
          // list_tasks: no modifications — tasks come from the filtered query
          // but we return the full list so the UI stays consistent
          updatedTasks = await getAllTasks();
          break;
        }
      }
    }

    // If no tool calls were executed, keep the current task snapshot.
    // (When tool calls did execute, updatedTasks is already correct from the
    // switch cases above — no need to re-read from disk.)

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
