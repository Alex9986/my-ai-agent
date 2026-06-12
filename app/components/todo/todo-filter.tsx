"use client";

import { cn } from "@/lib/utils";
import { TaskFilter as TaskFilterType } from "@/lib/types";
import { ListTodo, CheckCircle2, AlertCircle, Clock, Circle } from "lucide-react";

interface TodoFilterProps {
  currentFilter: TaskFilterType;
  onFilterChange: (filter: TaskFilterType) => void;
  counts: {
    all: number;
    pending: number;
    completed: number;
  };
}

const filters: {
  key: TaskFilterType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "all", label: "全部", icon: ListTodo },
  { key: "pending", label: "待办", icon: Clock },
  { key: "completed", label: "已完成", icon: CheckCircle2 },
];

export default function TodoFilter({
  currentFilter,
  onFilterChange,
  counts,
}: TodoFilterProps) {
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-muted/60">
      {filters.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => onFilterChange(key)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
            currentFilter === key
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-background/50"
          )}
        >
          <Icon className="w-3.5 h-3.5" />
          {label}
          <span
            className={cn(
              "ml-0.5 px-1.5 py-0.5 rounded-full text-[10px]",
              currentFilter === key
                ? "bg-muted text-muted-foreground"
                : "bg-background/50 text-muted-foreground/70"
            )}
          >
            {counts[key]}
          </span>
        </button>
      ))}
    </div>
  );
}
