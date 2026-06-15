import { NextRequest, NextResponse } from "next/server";
import type { Task } from "@/lib/types";
import {
  queryCollection,
  createDocument,
  updateDocument,
  ensureCollection,
} from "@/lib/cloudbase";

const COLLECTION = "user_tasks";

interface UserTasksDoc {
  _id: string;
  username: string;
  tasks: Task[];
  updatedAt: string;
}

/**
 * GET /api/tasks?username=xxx
 * Fetch the task list for a user.
 */
export async function GET(request: NextRequest) {
  try {
    const username = request.nextUrl.searchParams.get("username");

    if (!username || !username.trim()) {
      return NextResponse.json(
        { error: "username is required" },
        { status: 400 }
      );
    }

    await ensureCollection(COLLECTION);

    const docs = await queryCollection<UserTasksDoc>(COLLECTION, {
      username: username.trim(),
    });

    return NextResponse.json({ tasks: docs[0]?.tasks ?? [] });
  } catch (error) {
    console.error("GET /api/tasks error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/tasks
 * Save (upsert) the task list for a user.
 * Body: { username: string, tasks: Task[] }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const username: string | undefined = body.username?.trim();
    const tasks: Task[] | undefined = body.tasks;

    if (!username || !Array.isArray(tasks)) {
      return NextResponse.json(
        { error: "username and tasks array are required" },
        { status: 400 }
      );
    }

    await ensureCollection(COLLECTION);

    const now = new Date().toISOString();

    // Check if user already has a document
    const existingDocs = await queryCollection<UserTasksDoc>(COLLECTION, {
      username,
    });

    if (existingDocs.length > 0) {
      await updateDocument<UserTasksDoc>(COLLECTION, existingDocs[0]._id, {
        tasks,
        updatedAt: now,
      } as Partial<UserTasksDoc>);
    } else {
      await createDocument(COLLECTION, {
        username,
        tasks,
        updatedAt: now,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/tasks error:", error);
    return NextResponse.json(
      { error: "Failed to save tasks" },
      { status: 500 }
    );
  }
}
