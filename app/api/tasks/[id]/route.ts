import { NextRequest, NextResponse } from "next/server";
import { updateTask, deleteTask, completeTask } from "@/lib/task-store";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    // Handle completion toggle
    if (typeof body.completed === "boolean") {
      const tasks = await completeTask(id, body.completed);
      return NextResponse.json({ tasks });
    }

    // Handle general update
    const tasks = await updateTask(id, body);
    return NextResponse.json({ tasks });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const tasks = await deleteTask(id);
    return NextResponse.json({ tasks });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}
