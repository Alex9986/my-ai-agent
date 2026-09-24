import { NextRequest, NextResponse } from "next/server";
import { verifyUndoToken } from "@/lib/undo";
import { Task, UndoRequest, UndoResponse } from "@/lib/types";

/**
 * Redeems an undo token issued by /api/chat after a delete.
 *
 * The server keeps no copy of anyone's tasks, so the client sends its current
 * list and gets the restored list back. That keeps the stateless design intact
 * while still letting the server decide what is actually being resurrected —
 * the token is signed, so the payload is the one that was deleted.
 */
export async function POST(request: NextRequest) {
  let body: UndoRequest;

  try {
    body = (await request.json()) as UndoRequest;
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  if (typeof body.token !== "string" || !body.token) {
    return NextResponse.json({ error: "缺少撤销令牌" }, { status: 400 });
  }

  const tasks: Task[] = Array.isArray(body.tasks) ? body.tasks : [];

  const payload = verifyUndoToken(body.token);
  if (!payload) {
    return NextResponse.json(
      { error: "撤销已过期或无效，这个操作没法恢复了。" },
      { status: 400 }
    );
  }

  // Double-clicking undo should not insert the task twice.
  if (tasks.some((t) => t.id === payload.task.id)) {
    const response: UndoResponse = { tasks };
    return NextResponse.json(response);
  }

  const index = Math.max(0, Math.min(payload.index, tasks.length));
  const next = [...tasks];
  next.splice(index, 0, payload.task);

  const response: UndoResponse = {
    tasks: next,
    restored: { id: payload.task.id, title: payload.task.title },
  };

  return NextResponse.json(response);
}
