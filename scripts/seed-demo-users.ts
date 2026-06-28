/**
 * Seed demo users into CloudBase.
 * Run once: npx tsx scripts/seed-demo-users.ts
 *
 * Creates alice/123 and bob/123 in the "credentials" collection.
 * Both accounts start with different sample tasks, so switching users
 * feels like a real multi-tenant experience.
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../.env.local") });

// Inline fetch helper (reusing CloudBase HTTP API pattern from lib/cloudbase.ts)
const envId = process.env.CLOUDBASE_ENV_ID;
const apiKey = process.env.CLOUDBASE_API_KEY;

if (!envId || !apiKey) {
  console.error("❌ CLOUDBASE_ENV_ID or CLOUDBASE_API_KEY missing in .env.local");
  process.exit(1);
}

const BASE_URL = `https://${envId}.api.tcloudbasegateway.com/v1/database/instances/(default)/databases/(default)`;
const HEADERS = {
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
};

async function ensureCollection(name: string) {
  const url = `${BASE_URL}/collections`;
  const res = await fetch(url, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ collectionName: name }),
  });
  console.log(`  collection "${name}": ${res.status === 201 ? "created" : "exists"}`);
}

async function queryCollection<T>(collection: string, filter: Record<string, unknown>): Promise<T[]> {
  const query = encodeURIComponent(JSON.stringify(filter));
  const url = `${BASE_URL}/collections/${collection}/documents?query=${query}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Query failed: ${res.status}`);
  const data = await res.json();
  return data.list;
}

async function createDoc(collection: string, doc: Record<string, unknown>) {
  const url = `${BASE_URL}/collections/${collection}/documents`;
  const res = await fetch(url, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ data: [doc] }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`  ✗ create failed: ${res.status} ${err}`);
  } else {
    const data = await res.json();
    console.log(`  ✓ created (id: ${data.insertedIds[0]})`);
  }
}

async function updateDoc(collection: string, id: string, doc: Record<string, unknown>) {
  const url = `${BASE_URL}/collections/${collection}/documents/${id}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: HEADERS,
    body: JSON.stringify({ data: doc }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`  ✗ update failed: ${res.status} ${err}`);
  } else {
    console.log(`  ✓ updated`);
  }
}

const now = new Date().toISOString();

const ALICE_TASKS = [
  {
    id: "alice-1",
    title: "完成设计稿评审",
    description: "与团队一起评审新的首页设计稿",
    priority: "high",
    status: "in_progress",
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    tags: ["工作", "设计"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "alice-2",
    title: "瑜伽课",
    description: "晚上7点的流瑜伽课程",
    priority: "medium",
    status: "pending",
    tags: ["健身"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "alice-3",
    title: "买生日礼物",
    description: "给妈妈买生日礼物，她喜欢围巾",
    priority: "high",
    status: "pending",
    dueDate: new Date(Date.now() + 172800000).toISOString(),
    tags: ["个人"],
    createdAt: now,
    updatedAt: now,
  },
];

const BOB_TASKS = [
  {
    id: "bob-1",
    title: "修复登录页面 bug",
    description: "用户反馈密码可见切换按钮在 Safari 上不显示",
    priority: "high",
    status: "pending",
    tags: ["工作", "bug"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "bob-2",
    title: "写周报",
    description: "整理本周的工作内容和下周计划",
    priority: "medium",
    status: "completed",
    tags: ["工作"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "bob-3",
    title: "学习 Rust",
    description: "阅读 Rust Book 第5-8章",
    priority: "low",
    status: "pending",
    tags: ["学习"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "bob-4",
    title: "换机油",
    description: "车该保养了，预约周末去4S店",
    priority: "medium",
    status: "pending",
    dueDate: new Date(Date.now() + 259200000).toISOString(),
    tags: ["生活", "车"],
    createdAt: now,
    updatedAt: now,
  },
];

const USERS = [
  { username: "alice", password: "123", tasks: ALICE_TASKS },
  { username: "bob", password: "123", tasks: BOB_TASKS },
];

async function seed() {
  console.log("🌱 Seeding demo users...\n");

  // 1. Ensure collections exist
  console.log("📦 Collections:");
  await ensureCollection("credentials");
  await ensureCollection("user_tasks");
  console.log();

  // 2. Seed credentials
  for (const user of USERS) {
    console.log(`👤 ${user.username}:`);
    const existing = await queryCollection<{ _id: string }>("credentials", { username: user.username });
    if (existing.length > 0) {
      console.log(`  credentials already exist — skipping`);
    } else {
      await createDoc("credentials", { username: user.username, password: user.password });
    }

    // 3. Seed user tasks
    const existingTasks = await queryCollection<{ _id: string; tasks: unknown[] }>("user_tasks", { username: user.username });
    if (existingTasks.length > 0) {
      console.log(`  user_tasks already seeded — skipping`);
    } else {
      await createDoc("user_tasks", {
        username: user.username,
        tasks: user.tasks,
        updatedAt: now,
      });
    }
  }

  console.log("\n✅ Done! Demo users ready:");
  console.log("   alice / 123  (3 tasks — 设计、健身、礼物)");
  console.log("   bob   / 123  (4 tasks — bug修复、周报、Rust、换机油)");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
