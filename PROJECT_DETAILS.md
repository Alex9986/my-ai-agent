# AI Todo — 用对话管理你的任务

> 一个基于自然语言对话的智能任务管理应用，通过 AI 助手用聊天的方式管理待办事项。

---

## 项目概述

**AI Todo** 是一款全栈 Web 应用，核心创新点在于将 **AI 对话** 与 **任务管理** 深度融合。用户不再需要手动点击按钮、填写表单来管理任务，而是可以直接用自然语言与 AI 对话——"帮我添加一个明天买菜的任务，高优先级"、"把第一个任务标记完成"——AI 理解意图后自动执行操作，并同步更新任务面板。

项目采用**双栏布局**：左侧 AI 对话面板 + 右侧任务列表面板，桌面端并排显示，移动端通过 Tab 切换。支持多用户登录、云端数据持久化、暗色模式、键盘快捷键等完整功能。

---

## 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 框架 | Next.js (App Router) | 16.2 |
| 语言 | TypeScript | 5.x |
| UI 库 | React | 19.2 |
| 样式 | Tailwind CSS + shadcn/ui | 4.x |
| 动画 | Framer Motion | 12.x |
| 图标 | Lucide React | 1.17 |
| AI 模型 | DeepSeek (deepseek-chat) | Function Calling API |
| 云数据库 | 腾讯 CloudBase (HTTP API) | — |
| 构建工具 | Turbopack (dev) | — |

---

## 核心功能

### 1. AI 对话任务管理（亮点功能）

- 集成 **DeepSeek API**，使用 **Function Calling（工具调用）** 机制
- AI 支持 5 种操作：添加任务、编辑任务、删除任务、标记完成/重新打开、查询任务
- 服务端将当前任务列表作为上下文注入 System Prompt，AI 可理解"第一个"、"倒数第二个"等相对指代
- 动态时区感知：前端通过 `Intl.DateTimeFormat` 获取浏览器时区，AI 据此理解"明天"、"下周"等相对时间
- 每次对话后 AI 返回完整更新后的任务列表，前端同步更新 UI

### 2. 任务管理面板

- 完整的 CRUD 操作：新增、编辑、删除、标记完成/进行中
- 三状态流转：`待办` → `进行中` → `已完成`
- 三级优先级：高（红色）、中（琥珀色）、低（绿色）
- 截止日期格式化：今天/明天/已过期 智能显示
- 标签（Tags）系统
- **搜索功能**：支持标题、描述、标签关键词搜索
- **筛选 Tab**：全部 / 待办 / 进行中 / 已完成，带数量计数器
- 智能排序：未完成任务按优先级（高→中→低），已完成排在最后
- 编辑对话框支持修改所有字段（标题、描述、优先级、状态、截止日期、标签）

### 3. 用户认证系统

- 自定义登录界面，与 CloudBase 数据库集成
- **IP 级别速率限制**：滑动窗口算法，每 IP 60 秒内最多 5 次尝试
- 密码输入框支持显示/隐藏切换
- 会话持久化：`localStorage` 存储登录态
- **跨标签页同步**：监听 `StorageEvent`，在一个标签页登出时自动同步到其他标签页
- **演示账户一键登录**：3 个预置演示账户，点击即可自动填充并登录
- 统一的错误提示（不区分"用户不存在"和"密码错误"）

### 4. 多用户数据隔离与云同步

- 数据存储策略：**Server → localStorage → 示例数据** 三级降级
  1. 优先从 CloudBase 云端加载（按用户名查询）
  2. 网络不可达时回退到 localStorage 缓存
  3. localStorage 无缓存时使用内置示例数据
- 任务变更后**自动同步**：fire-and-forget 模式写入服务器
- 每个用户拥有独立任务列表（多租户数据隔离）

### 5. UI/UX 细节

- **暗色/亮色模式**：完整双主题，使用 OKLCH 色彩空间，主题偏好持久化
- **响应式布局**：桌面端双栏并排，移动端 Tab 切换
- **Toast 通知系统**：基于 Context API，支持 4 种类型（成功/错误/信息/警告），4 秒自动消失，支持手动关闭
- **键盘快捷键**：`Ctrl+K` 聚焦搜索框，`Ctrl+Shift+K` 聚焦聊天输入框，自动适配 Mac（Cmd）与 Windows（Ctrl）
- **动画效果**：消息气泡渐入、任务项 layout 动画、TypingIndicator 三点跳动、Toast 进出、Shimmer 加载动画
- **空状态设计**：4 种过滤状态各有专用空状态文案
- **聊天建议气泡**：首次加载时展示快捷对话入口
- **输入框自动调整高度**（最大 150px），Enter 发送 / Shift+Enter 换行
- 自定义滚动条样式

---

## 架构设计

### 目录结构

```
├── app/
│   ├── api/
│   │   ├── auth/login/route.ts    # 登录认证 API
│   │   ├── chat/route.ts           # AI 对话 API（工具调用执行）
│   │   └── tasks/route.ts          # 任务 CRUD API（CloudBase）
│   ├── components/
│   │   ├── auth/login-form.tsx     # 登录表单
│   │   ├── chat/
│   │   │   ├── chat-panel.tsx      # 聊天面板
│   │   │   ├── chat-input.tsx      # 聊天输入框
│   │   │   ├── chat-message.tsx    # 消息气泡
│   │   │   └── typing-indicator.tsx # 输入中动画
│   │   ├── toast/toast-provider.tsx # Toast 通知系统
│   │   └── todo/
│   │       ├── todo-panel.tsx      # 任务面板
│   │       ├── todo-item.tsx       # 任务卡片
│   │       ├── todo-filter.tsx     # 状态筛选
│   │       ├── todo-search.tsx     # 搜索框
│   │       ├── task-edit-dialog.tsx # 编辑对话框
│   │       └── empty-state.tsx     # 空状态
│   ├── hooks/
│   │   ├── use-auth.ts            # 认证状态 Hook
│   │   ├── use-tasks.ts           # 任务状态 Hook（云同步）
│   │   └── use-keyboard-shortcuts.ts # 快捷键 Hook
│   ├── layout.tsx                  # 根布局
│   ├── page.tsx                    # 主页面（组合所有模块）
│   └── globals.css                 # 全局样式 + 主题
├── components/ui/                  # shadcn/ui 基础组件
├── lib/
│   ├── cloudbase.ts               # CloudBase HTTP API 客户端
│   ├── deepseek.ts                # DeepSeek AI 客户端
│   ├── task-utils.ts              # 纯函数任务工具
│   ├── types.ts                   # TypeScript 类型定义
│   └── utils.ts                   # cn() 工具函数
├── scripts/
│   └── seed-demo-users.ts         # 演示用户初始化脚本
└── memory/                        # Claude Code 记忆系统
```

### 数据流

```
[用户输入] → ChatInput → POST /api/chat → DeepSeek API (Function Calling)
    → 服务端执行工具调用（纯函数） → 返回更新后任务列表
    → 前端替换全部任务 → 自动同步 PUT /api/tasks → CloudBase

[直接任务操作] → TodoPanel (complete/delete/update)
    → useTasks Hook 更新本地状态
    → 异步 PUT /api/tasks → CloudBase（fire-and-forget）
```

### 关键技术决策

1. **服务端无状态**：AI Chat API 不维护会话状态，依赖客户端每次都发送完整任务列表，设计简洁且易于水平扩展
2. **纯函数模式**：`lib/task-utils.ts` 中所有任务操作都是纯函数（`Task[] → Task[]`），便于测试和复用
3. **无 SDK 依赖**：CloudBase 集成完全通过 HTTP API 实现，未引入重量级 SDK，保持依赖精简
4. **三级降级策略**：确保在各种网络状况下应用均可使用

---

## API 路由详情

### `POST /api/auth/login`
- 输入校验（长度限制、类型检查）
- IP 滑动窗口限流（60s / 5次）
- CloudBase 凭证查询 + 密码比对
- 安全的统一错误消息（防止用户枚举）

### `POST /api/chat`
- 接收消息历史 + 任务列表 + 时区
- 调用 DeepSeek API（带 5 个 Function Tools 定义）
- 两轮调用：第一轮获取 tool_calls，构建 tool 消息后第二轮获取最终回复
- 执行工具调用操作任务列表，返回完整更新后的列表

### `GET /api/tasks`
- 按 `username` 查询 CloudBase `user_tasks` 集合
- 自动确保集合存在（`ensureCollection`）

### `PUT /api/tasks`
- Upsert 模式：已存在则更新，否则创建
- 存储 `username` + `tasks[]` + `updatedAt`

---

## 部署与运维

- 使用腾讯 CloudBase 作为 Serverless 数据库（无需自建数据库）
- Next.js 应用可部署到 Vercel 或任意支持 Node.js 的平台
- 数据库初始化脚本 `scripts/seed-demo-users.ts`，运行：`npx tsx scripts/seed-demo-users.ts`
- 环境变量：`CLOUDBASE_ENV_ID`、`CLOUDBASE_API_KEY`、`DEEPSEEK_API_KEY`

---

## 项目亮点总结（适合简历）

1. **AI + 传统 CRUD 的融合实践**：不是简单的"ChatBot 问答"，而是 AI Function Calling 驱动真实业务操作
2. **全栈 TypeScript**：从前端 Hooks 到后端 API Route 到数据库客户端，全链路类型安全
3. **多层级数据策略**：云端优先 + 本地缓存 + 离线降级，保证应用在各种网络状况下的可用性
4. **完整的认证体系**：速率限制、跨标签页同步、安全错误消息、演示账户
5. **精致的 UI/UX**：响应式、暗色模式、Toast 通知、键盘快捷键、Framer Motion 动画过渡
6. **Serverless 架构**：Next.js API Routes + CloudBase 云数据库，零服务器运维
7. **无冗余依赖**：CloudBase 通过原生 HTTP API 调用，DeepSeek 通过原生 fetch 调用，未引入重量级 ORM 或 SDK
8. **组件化与关注点分离**：Custom Hooks 封装业务逻辑、纯函数工具模块、UI 组件纯粹渲染

---

## 演示账户

| 用户名 | 密码 | 预设任务 |
|--------|------|----------|
| test1 | pass123 | 无预设（空白） |
| demo | demo | 无预设（空白） |
| dev | dev | 无预设（空白） |
| alice | 123 | 3 个任务（设计稿评审、瑜伽课、买生日礼物） |
| bob | 123 | 4 个任务（修 Bug、写周报、学 Rust、换机油） |
