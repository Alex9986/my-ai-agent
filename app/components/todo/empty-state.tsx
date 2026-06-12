"use client";

import { ClipboardList } from "lucide-react";

interface EmptyStateProps {
  filter: string;
}

export default function EmptyState({ filter }: EmptyStateProps) {
  const messages: Record<string, { title: string; description: string }> = {
    all: {
      title: "还没有任务",
      description: "通过左侧对话告诉 AI 你想添加什么任务吧！",
    },
    pending: {
      title: "所有任务都完成了！",
      description: "太棒了！通过对话添加更多任务吧。",
    },
    completed: {
      title: "还没有已完成的任务",
      description: "完成任务后它们会出现在这里。",
    },
  };

  const msg = messages[filter] || messages.all;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center mb-4">
        <ClipboardList className="w-8 h-8 text-indigo-500 dark:text-indigo-400" />
      </div>
      <h3 className="text-base font-medium text-foreground mb-1.5">
        {msg.title}
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs">{msg.description}</p>
    </div>
  );
}
