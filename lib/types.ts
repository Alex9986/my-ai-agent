export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: "high" | "medium" | "low";
  status: "pending" | "in_progress" | "completed";
  dueDate?: string; // ISO 8601
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  /** True for locally-generated failure notices — never sent back to the model. */
  isError?: boolean;
}

export interface ChatRequest {
  messages: Pick<ChatMessage, "role" | "content">[];
  tasks: Task[];
  timezone: string;
}

/**
 * Why the agent loop handed control back. A turn that ends anywhere other than
 * `no_tool_calls` ran out of room rather than finishing on its own.
 */
export type StopReason =
  /** The model stopped asking for tools and produced an answer. */
  | "no_tool_calls"
  /** Hit the step ceiling with work possibly still pending. */
  | "max_steps"
  /** Ran out of the whole-turn time budget before a final answer. */
  | "deadline"
  /** The model kept requesting the exact same call and was cut off. */
  | "no_progress"
  /** A DeepSeek call failed after at least one tool had already run. */
  | "error";

/**
 * A one-click "put that back" offer attached to a destructive operation.
 * The token is server-signed, so the client cannot invent a restore payload.
 */
export interface UndoOffer {
  token: string;
  /** User-facing description of what was removed. */
  description: string;
  expiresAt: string;
}

export interface ChatResponse {
  message: string;
  tasks: Task[];
  /** True when the AI wording was unavailable and a local result summary was used. */
  degraded?: boolean;
  /** Model round-trips actually used for this turn. */
  steps?: number;
  stopReason?: StopReason;
  /** Present when this turn deleted something that can still be restored. */
  undo?: UndoOffer;
}

export interface UndoRequest {
  token: string;
  /** The client's current list — the server is stateless and holds no copy. */
  tasks: Task[];
}

export interface UndoResponse {
  tasks: Task[];
  restored?: { id: string; title: string };
}

export type TaskFilter = "all" | "pending" | "in_progress" | "completed";

export type PriorityFilter = "all" | "high" | "medium" | "low";
