"use client";

import { useRef, useEffect } from "react";
import { MessageCircle, Sparkles } from "lucide-react";
import ChatMessage from "./chat-message";
import ChatInput from "./chat-input";
import TypingIndicator from "./typing-indicator";
import { ChatMessage as ChatMessageType } from "@/lib/types";

interface ChatPanelProps {
  messages: ChatMessageType[];
  loading: boolean;
  onSend: (message: string) => void;
}

export default function ChatPanel({
  messages,
  loading,
  onSend,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">AI 对话</h2>
            <p className="text-[11px] text-muted-foreground">
              用自然语言管理你的任务
            </p>
          </div>
        </div>
      </div>

      {/* Messages — use plain overflow-y-auto, no ScrollArea */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto"
      >
        <div className="p-4 min-h-full flex flex-col">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center flex-1 text-center py-12 px-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center mb-4">
                <MessageCircle className="w-8 h-8 text-indigo-500 dark:text-indigo-400" />
              </div>
              <h3 className="text-base font-medium text-foreground mb-1.5">
                开始对话
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                试试说：&ldquo;帮我添加一个明天买菜的任务，高优先级&rdquo;
              </p>
              <div className="flex flex-wrap gap-2 mt-4 justify-center">
                <SuggestionChip
                  text="添加一个任务"
                  onClick={() => onSend("帮我添加一个任务")}
                />
                <SuggestionChip
                  text="我今天有哪些任务"
                  onClick={() => onSend("我今天有哪些任务")}
                />
                <SuggestionChip
                  text="查看高优先级任务"
                  onClick={() => onSend("帮我查看高优先级任务")}
                />
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              role={msg.role as "user" | "assistant"}
              content={msg.content}
              timestamp={msg.timestamp}
            />
          ))}

          {loading && <TypingIndicator />}
        </div>
      </div>

      {/* Input */}
      <ChatInput onSend={onSend} disabled={loading} />
    </div>
  );
}

function SuggestionChip({
  text,
  onClick,
}: {
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 text-xs rounded-full border border-border/60 bg-muted/50 hover:bg-muted hover:border-indigo-300 dark:hover:border-indigo-700 text-muted-foreground hover:text-foreground transition-colors"
    >
      {text}
    </button>
  );
}
