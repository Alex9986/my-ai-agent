# AI Todo — 用对话管理你的任务 

> 一个基于自然语言对话的智能任务管理应用。通过 AI 助手用聊天的方式管理待办事项，无需手动点击按钮、填写表单。

基于 [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind CSS 构建的全栈 Web 应用。

---

## 核心特性

- **AI 对话任务管理**：集成 DeepSeek API，使用 Function Calling（工具调用）机制。AI 支持添加、编辑、删除、标记完成/重新打开、查询任务 5 种操作，并理解"第一个"、"明天"、"下周"等相对指代。
- **多步 Agent 循环**：模型可以看到工具的真实执行结果后再次决策，因此"添加一个任务并把它标记完成"这类依赖前序结果的链式请求能一次做完。循环受步数、总预算与无进展检测三重约束；中断时返回已执行操作的真实摘要，不谎报成功。
- **删除可撤销**：AI 删除任务后，响应附带 HMAC 签名的短期撤销令牌，Toast 上一键恢复；无需任何服务端会话状态。
- **任务管理面板**：完整的 CRUD 操作、三状态流转（待办 → 进行中 → 已完成）、三级优先级、截止日期智能格式化、标签系统、搜索与状态筛选 Tab。
- **多用户认证与数据隔离**：自定义登录界面，IP 级速率限制（60s / 5 次），演示账户一键登录，跨标签页登录态同步。
- **云同步与离线降级**：数据存储采用 **CloudBase 云端 → localStorage 缓存 → 内置示例数据** 三级降级策略，确保各种网络状况下可用。
- **精致 UI/UX**：暗色/亮色双主题、响应式双栏布局、Toast 通知、键盘快捷键（`Ctrl+K` 搜索 / `Ctrl+Shift+K` 聚焦聊天）、Framer Motion 动画。

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) + Turbopack |
| 语言 | TypeScript |
| UI | React 19 + Tailwind CSS 4 + shadcn/ui |
| 动画 | Framer Motion |
| AI 模型 | DeepSeek (deepseek-flash, Function Calling API) |
| 云数据库 | 腾讯 CloudBase (HTTP API，无 SDK) |

## 项目结构

```
├── app/
│   ├── api/
│   │   ├── auth/login/route.ts    # 登录认证 API
│   │   ├── chat/route.ts           # AI 对话 API（工具调用执行）
│   │   └── tasks/route.ts          # 任务 CRUD API（CloudBase）
│   ├── components/                 # 业务组件（chat / todo / auth / toast）
│   ├── hooks/                      # use-auth / use-tasks / use-keyboard-shortcuts
│   ├── layout.tsx                  # 根布局
│   └── page.tsx                    # 主页面
├── components/ui/                  # shadcn/ui 基础组件
├── lib/                            # cloudbase / deepseek 客户端、任务纯函数、类型
├── scripts/
│   └── seed-demo-users.ts          # 演示用户初始化脚本
└── data/tasks.json                 # 示例数据
```

## Getting Started

### 1. 安装依赖

```bash
npm install
# 或
yarn install
# 或
pnpm install
# 或
bun install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env.local`（如不存在），填入以下变量：

```bash
CLOUDBASE_ENV_ID=your_cloudbase_env_id
CLOUDBASE_API_KEY=your_cloudbase_api_key
DEEPSEEK_API_KEY=your_deepseek_api_key
```

### 3. 启动开发服务器

```bash
npm run dev
# 或
yarn dev
# 或
pnpm dev
# 或
bun dev
```

打开 [http://localhost:3000](http://localhost:3000) 即可看到应用。

> 提示：你可以直接使用下方演示账户一键登录体验；要初始化演示用户，可运行 `npx tsx scripts/seed-demo-users.ts`。

## 演示账户

| 用户名 | 密码 | 预设任务 |
|--------|------|----------|
| demo | demo | 无预设（空白） |
| alice | 123 | 3 个任务 |
| bob | 123 | 4 个任务 |

## API 路由

| 路由 | 说明 |
|------|------|
| `POST /api/auth/login` | 登录认证（限流、统一错误消息） |
| `POST /api/chat` | AI 对话，运行有界 Agent 循环并返回更新后的任务列表（含 `steps` / `stopReason` / `undo`） |
| `GET /api/tasks` | 按用户名查询任务（CloudBase） |
| `PUT /api/tasks` | Upsert 写入任务列表（CloudBase） |
| `POST /api/undo` | 兑换删除操作的签名撤销令牌，返回恢复后的任务列表 |

## 可用脚本

```bash
npm run dev      # 启动开发服务器
npm run build    # 构建生产版本
npm run start    # 启动生产服务器
npm run lint     # ESLint 检查
```

## 部署

- 应用可部署到 Vercel 或任意支持 Node.js 的平台。
- 数据库使用腾讯 CloudBase Serverless 数据库，无需自建数据库。

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)
- [DeepSeek Function Calling](https://api-docs.deepseek.com/)
