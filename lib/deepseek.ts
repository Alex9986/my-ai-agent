interface DeepSeekMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: DeepSeekToolCall[];
}

interface DeepSeekToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface DeepSeekTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface DeepSeekResponse {
  choices?: {
    message: {
      role: string;
      content: string | null;
      tool_calls?: DeepSeekToolCall[];
    };
    finish_reason: string;
  }[];
}

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const MODEL = "deepseek-chat";

/** DeepSeek usually answers in 1–3s. Past this we treat the request as stuck. */
const REQUEST_TIMEOUT_MS = 20_000;
/** 1 initial attempt + 2 retries. */
const MAX_ATTEMPTS = 3;
/** Base delay for exponential backoff (600ms, then 1200ms). */
const RETRY_BASE_DELAY_MS = 600;

export type DeepSeekErrorKind =
  /** Server is missing DEEPSEEK_API_KEY — retrying can never help. */
  | "config"
  /** 4xx other than 429 (bad key, no balance, request rejected). */
  | "client"
  /** 429 — we are being throttled. */
  | "rate_limit"
  /** 5xx — DeepSeek had a bad moment. */
  | "server"
  /** Our own deadline fired. */
  | "timeout"
  /** DNS / TLS / connection reset. */
  | "network";

export class DeepSeekError extends Error {
  readonly kind: DeepSeekErrorKind;
  readonly status?: number;

  constructor(message: string, kind: DeepSeekErrorKind, status?: number) {
    super(message);
    this.name = "DeepSeekError";
    this.kind = kind;
    this.status = status;
  }
}

const RETRYABLE_KINDS: DeepSeekErrorKind[] = [
  "rate_limit",
  "server",
  "timeout",
  "network",
];

export function isRetryableKind(kind: DeepSeekErrorKind): boolean {
  return RETRYABLE_KINDS.includes(kind);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Exponential backoff with jitter. Honours `Retry-After` when DeepSeek sends
 * one, as long as it is a sane value (we never wait longer than 10s).
 */
function backoffDelay(attempt: number, retryAfterSeconds?: number): number {
  if (
    typeof retryAfterSeconds === "number" &&
    Number.isFinite(retryAfterSeconds) &&
    retryAfterSeconds > 0 &&
    retryAfterSeconds <= 10
  ) {
    return Math.round(retryAfterSeconds * 1000);
  }
  const base = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
  return Math.round(base + Math.random() * 250);
}

function classifyStatus(status: number): DeepSeekErrorKind {
  if (status === 429) return "rate_limit";
  if (status >= 500) return "server";
  return "client";
}

function truncate(text: string, max = 300): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

/**
 * POST to the chat-completions endpoint with a hard deadline and bounded
 * retries. Only transient failures (timeout / network / 429 / 5xx) are
 * retried — a bad API key or a rejected payload fails fast.
 */
async function postChatCompletion(
  body: Record<string, unknown>
): Promise<DeepSeekResponse> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new DeepSeekError("环境变量 DEEPSEEK_API_KEY 未配置", "config");
  }

  let lastError: DeepSeekError | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response: Response;

    try {
      response = await fetch(DEEPSEEK_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const interrupted =
        error instanceof DOMException &&
        (error.name === "TimeoutError" || error.name === "AbortError");

      lastError = interrupted
        ? new DeepSeekError(
            `DeepSeek 请求超时（${REQUEST_TIMEOUT_MS}ms）`,
            "timeout"
          )
        : new DeepSeekError(
            `无法连接 DeepSeek：${
              error instanceof Error ? error.message : String(error)
            }`,
            "network"
          );

      if (attempt < MAX_ATTEMPTS) {
        await sleep(backoffDelay(attempt));
        continue;
      }
      break;
    }

    if (response.ok) {
      try {
        return (await response.json()) as DeepSeekResponse;
      } catch {
        lastError = new DeepSeekError("DeepSeek 返回的不是合法 JSON", "server");
        if (attempt < MAX_ATTEMPTS) {
          await sleep(backoffDelay(attempt));
          continue;
        }
        break;
      }
    }

    const errorText = await response.text().catch(() => "");
    const kind = classifyStatus(response.status);
    lastError = new DeepSeekError(
      `DeepSeek API ${response.status}: ${truncate(errorText)}`,
      kind,
      response.status
    );

    if (attempt < MAX_ATTEMPTS && isRetryableKind(kind)) {
      const retryAfterHeader = response.headers.get("retry-after");
      await sleep(
        backoffDelay(
          attempt,
          retryAfterHeader == null ? undefined : Number(retryAfterHeader)
        )
      );
      continue;
    }
    break;
  }

  throw lastError ?? new DeepSeekError("DeepSeek 调用失败（未知原因）", "network");
}

function buildSystemPrompt(timezone: string): string {
  const now = new Date().toLocaleString("zh-CN", { timeZone: timezone });

  return `你是一个友好的 Todo List 助手，名叫"小助手"。你可以帮助用户管理他们的任务列表。

用户可以用自然语言与你交流，你需要理解他们的意图，并通过调用函数来执行操作。

你的能力：
- 添加新任务（包括标题、描述、优先级、截止日期、标签）
- 编辑已有任务
- 删除任务
- 标记任务完成或取消完成
- 查询任务列表（可按状态、优先级、关键词筛选）
- 设置任务优先级

重要：任务列表的排序规则（与用户界面上看到的完全一致）：
- 未完成的任务排在前面，已完成的任务排在最后
- 未完成的任务按优先级排序：高优先级 → 中优先级 → 低优先级
- 每个任务都有一个 "index" 字段，表示它在列表中的位置（从1开始）
- 当用户说"第一个"、"倒数第二个"、"最后一个"等位置时，请根据这个排序后的 index 来判断
- 例如："倒数第二个任务"指的是列表中 index 为 N-1 的那个任务（N 为任务总数）

回复风格：
- 使用中文回复
- 友好、热情，适当使用表情符号
- 每次操作后简要确认做了什么
- 如果用户只是聊天，就友好地聊天
- 如果用户的问题不涉及任务操作，直接回答即可

当前日期时间：${now}
请根据当前日期理解用户说的"明天"、"下周"等相对时间。
用户所在的时区是 ${timezone}，所有截止日期请基于此时区计算。`;
}

const TOOLS: DeepSeekTool[] = [
  {
    type: "function",
    function: {
      name: "add_task",
      description: "添加一个新的待办任务",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "任务标题",
          },
          description: {
            type: "string",
            description: "任务详细描述（可选）",
          },
          priority: {
            type: "string",
            enum: ["high", "medium", "low"],
            description: "优先级：high=高, medium=中, low=低。默认medium",
          },
          dueDate: {
            type: "string",
            description: "截止日期，格式为ISO 8601（如 2026-06-12T15:00:00）。如果用户没有指定时间，默认为当天23:59:59。如果用户没有指定日期，则不设置。",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "标签列表，如 ['工作', '紧急']",
          },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_task",
      description: "更新一个已有任务的信息",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "要更新的任务ID",
          },
          title: {
            type: "string",
            description: "新的任务标题",
          },
          description: {
            type: "string",
            description: "新的任务描述",
          },
          priority: {
            type: "string",
            enum: ["high", "medium", "low"],
            description: "新的优先级",
          },
          dueDate: {
            type: "string",
            description: "新的截止日期，ISO 8601格式",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "新的标签列表",
          },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_task",
      description: "删除一个任务",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "要删除的任务ID",
          },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_task",
      description: "标记任务为完成或取消完成",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "任务ID",
          },
          completed: {
            type: "boolean",
            description: "true=标记完成, false=取消完成（重新打开）",
          },
        },
        required: ["id", "completed"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_tasks",
      description: "查询任务列表，可按条件筛选",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["all", "pending", "completed"],
            description: "按状态筛选",
          },
          priority: {
            type: "string",
            enum: ["all", "high", "medium", "low"],
            description: "按优先级筛选",
          },
          search: {
            type: "string",
            description: "关键词搜索（在标题、描述、标签中搜索）",
          },
        },
      },
    },
  },
];

/** One tool call the model asked for, with arguments already parsed. */
export interface ToolInvocation {
  id: string;
  name: string;
  args: Record<string, unknown>;
  /** Set when the model emitted arguments that are not a valid JSON object. */
  argumentsError?: string;
}

/**
 * Everything needed to ask the model for the wording of an answer, *after*
 * the tool calls have actually been executed.
 */
export interface Continuation {
  /** The exact message array used for the intent call (system prompt + history). */
  prefixMessages: DeepSeekMessage[];
  /** The assistant turn carrying tool_calls — ids must be echoed back verbatim. */
  assistantMessage: DeepSeekMessage;
}

export interface IntentResult {
  /** Direct answer — set only when the model chose not to touch any tool. */
  message: string | null;
  toolCalls: ToolInvocation[];
  /** Non-null when the model asked for tools. Pass to generateReply(). */
  continuation: Continuation | null;
}

function buildChatMessages(
  messages: { role: string; content: string }[],
  currentTasks: Record<string, unknown>[],
  timezone: string
): DeepSeekMessage[] {
  const taskContext =
    currentTasks.length > 0
      ? `\n\n当前用户的任务列表（JSON格式，供你参考）：\n${JSON.stringify(currentTasks, null, 2)}\n\n当用户提到"这个任务"、"刚才那个"等模糊指代时，请根据对话上下文和这个任务列表来判断具体是哪个任务。`
      : "\n\n用户当前没有任何任务。";

  return [
    { role: "system", content: buildSystemPrompt(timezone) + taskContext },
    ...messages.map((m) => ({
      role: m.role as DeepSeekMessage["role"],
      content: m.content,
    })),
  ];
}

/**
 * Parses the `arguments` string the model produced. A malformed payload must
 * not blow up the whole request — it is reported back as `argumentsError`
 * so the caller can skip that single tool call.
 */
function parseArguments(
  raw: string
): { args: Record<string, unknown> } | { error: string } {
  if (!raw || !raw.trim()) return { args: {} };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { args: parsed as Record<string, unknown> };
    }
    return { error: "参数不是一个 JSON 对象" };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "参数不是合法 JSON",
    };
  }
}

/**
 * Round 1 — ask the model what it wants to do.
 * Nothing in the task list has been modified when this returns.
 */
export async function requestIntent(
  messages: { role: string; content: string }[],
  currentTasks: Record<string, unknown>[],
  timezone: string
): Promise<IntentResult> {
  const prefixMessages = buildChatMessages(messages, currentTasks, timezone);

  const data = await postChatCompletion({
    model: MODEL,
    messages: prefixMessages,
    tools: TOOLS,
    tool_choice: "auto",
    temperature: 0.7,
    max_tokens: 2048,
  });

  const message = data.choices?.[0]?.message;
  if (!message) {
    throw new DeepSeekError("DeepSeek 没有返回任何候选结果", "server");
  }

  const rawToolCalls = message.tool_calls ?? [];

  if (rawToolCalls.length === 0) {
    return {
      message: message.content?.trim() || "嗯，我理解了。有什么我可以帮你的吗？",
      toolCalls: [],
      continuation: null,
    };
  }

  const toolCalls: ToolInvocation[] = rawToolCalls.map((call) => {
    const parsed = parseArguments(call.function.arguments);
    if ("error" in parsed) {
      return {
        id: call.id,
        name: call.function.name,
        args: {},
        argumentsError: parsed.error,
      };
    }
    return { id: call.id, name: call.function.name, args: parsed.args };
  });

  return {
    message: null,
    toolCalls,
    continuation: {
      prefixMessages,
      assistantMessage: {
        role: "assistant",
        content: message.content ?? "",
        tool_calls: rawToolCalls,
      },
    },
  };
}

/**
 * Round 2 — hand the *real* execution results back to the model and ask it to
 * phrase the outcome. Returns null when the model produced no usable text;
 * throws DeepSeekError when the call itself failed.
 */
export async function generateReply(
  continuation: Continuation,
  toolResults: { toolCallId: string; content: string }[]
): Promise<string | null> {
  const data = await postChatCompletion({
    model: MODEL,
    messages: [
      ...continuation.prefixMessages,
      continuation.assistantMessage,
      ...toolResults.map((result) => ({
        role: "tool" as const,
        tool_call_id: result.toolCallId,
        content: result.content,
      })),
    ],
    temperature: 0.7,
    max_tokens: 1024,
  });

  return data.choices?.[0]?.message?.content?.trim() || null;
}
