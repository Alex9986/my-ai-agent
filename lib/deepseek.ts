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
  choices: {
    message: {
      role: string;
      content: string | null;
      tool_calls?: DeepSeekToolCall[];
    };
    finish_reason: string;
  }[];
}

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

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

export interface DeepSeekCallResult {
  message: string;
  toolCalls: Array<{
    name: string;
    arguments: Record<string, unknown>;
  }>;
}

export async function callDeepSeek(
  messages: { role: string; content: string }[],
  currentTasks: Record<string, unknown>[],
  timezone: string
): Promise<DeepSeekCallResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not set in environment variables");
  }

  // Build task context for the system prompt
  const taskContext =
    currentTasks.length > 0
      ? `\n\n当前用户的任务列表（JSON格式，供你参考）：\n${JSON.stringify(currentTasks, null, 2)}\n\n当用户提到"这个任务"、"刚才那个"等模糊指代时，请根据对话上下文和这个任务列表来判断具体是哪个任务。`
      : "\n\n用户当前没有任何任务。";

  const systemPrompt = buildSystemPrompt(timezone);

  const chatMessages: DeepSeekMessage[] = [
    { role: "system", content: systemPrompt + taskContext },
    ...messages.map((m) => ({
      role: m.role as DeepSeekMessage["role"],
      content: m.content,
    })),
  ];

  // First call - may return tool_calls
  const response = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: chatMessages,
      tools: TOOLS,
      tool_choice: "auto",
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} ${errorText}`);
  }

  const data: DeepSeekResponse = await response.json();
  const choice = data.choices[0];
  const message = choice.message;

  // If the model wants to call tools
  if (message.tool_calls && message.tool_calls.length > 0) {
    const toolCalls = message.tool_calls.map((tc) => ({
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    }));

    // For the second call, we need to ask DeepSeek to generate a final response
    // after the tool calls are executed (handled by the caller)
    // We return the tool calls so the caller can execute and then call again
    const toolResults = toolCalls.map((tc) => ({
      name: tc.name,
      arguments: tc.arguments,
    }));

    // Make the follow-up call to get the final message
    const followUpMessages: DeepSeekMessage[] = [
      ...chatMessages,
      {
        role: "assistant",
        content: message.content || "",
        tool_calls: message.tool_calls,
      },
      ...message.tool_calls.map((tc) => ({
        role: "tool" as const,
        tool_call_id: tc.id,
        content: JSON.stringify({ success: true }),
      })),
    ];

    const followUpResponse = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: followUpMessages,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!followUpResponse.ok) {
      // If follow-up fails, return a default message
      return {
        message: "好的，已经处理完成！✅",
        toolCalls: toolResults,
      };
    }

    const followUpData: DeepSeekResponse = await followUpResponse.json();
    const finalContent = followUpData.choices[0]?.message?.content || "好的，已经处理完成！✅";

    return {
      message: finalContent,
      toolCalls: toolResults,
    };
  }

  // No tool calls - just a text response
  return {
    message: message.content || "嗯，我理解了。有什么我可以帮你的吗？",
    toolCalls: [],
  };
}
