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

export interface ChatResponse {
  message: string;
  tasks: Task[];
  /** True when the AI wording was unavailable and a local result summary was used. */
  degraded?: boolean;
}

export type TaskFilter = "all" | "pending" | "in_progress" | "completed";

export type PriorityFilter = "all" | "high" | "medium" | "low";
