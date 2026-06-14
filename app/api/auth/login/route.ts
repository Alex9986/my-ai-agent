import { NextRequest, NextResponse } from "next/server";
import { queryCollection } from "@/lib/cloudbase";

// Simple in-memory rate limiter (per IP, sliding window)
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000; // 60 seconds

function getClientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  // Periodically clean up expired entries
  if (rateLimitMap.size > 1000) {
    for (const [key, val] of rateLimitMap) {
      if (now - val.windowStart > WINDOW_MS) {
        rateLimitMap.delete(key);
      }
    }
  }

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return false;
  }

  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = getClientIp(request);
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "登录尝试过于频繁，请稍后再试" },
        { status: 429 }
      );
    }

    // Parse and validate input
    let body: { username?: string; password?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "请求格式错误" },
        { status: 400 }
      );
    }

    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password.trim() : "";

    if (!username || !password) {
      return NextResponse.json(
        { error: "请输入用户名和密码" },
        { status: 400 }
      );
    }

    if (username.length > 100) {
      return NextResponse.json(
        { error: "用户名长度不能超过100个字符" },
        { status: 400 }
      );
    }

    if (password.length > 128) {
      return NextResponse.json(
        { error: "密码长度不能超过128个字符" },
        { status: 400 }
      );
    }

    // Query CloudBase database via HTTP API
    const data = await queryCollection<{ _id: string; username: string; password: string }>(
      "credentials",
      { username }
    );

    // Unified error — don't reveal whether user exists
    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: "用户名或密码错误" },
        { status: 401 }
      );
    }

    const user = data[0];

    // Plaintext password comparison
    if (user.password !== password) {
      return NextResponse.json(
        { error: "用户名或密码错误" },
        { status: 401 }
      );
    }

    // Success
    return NextResponse.json(
      { success: true, username: user.username },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("Login API error:", error);
    return NextResponse.json(
      { error: "服务器内部错误，请稍后再试" },
      { status: 500 }
    );
  }
}
