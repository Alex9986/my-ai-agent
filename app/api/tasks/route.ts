import { NextRequest, NextResponse } from "next/server";
import { getAllTasks, addTask } from "@/lib/task-store";
import { Task } from "@/lib/types";

export async function GET() {
  try {
    const tasks = await getAllTasks();
    return NextResponse.json({ tasks });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to read tasks" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const newTask: Task = {
      id: crypto.randomUUID(),
      title: body.title || "Untitled Task",
      description: body.description,
      priority: body.priority || "medium",
      status: "pending",
      dueDate: body.dueDate,
      tags: body.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const tasks = await addTask(newTask);
    return NextResponse.json({ task: newTask, tasks });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}
