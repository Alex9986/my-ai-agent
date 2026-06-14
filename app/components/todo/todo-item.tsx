"use client";

import { motion } from "framer-motion";
import {
  Calendar,
  Tag,
  CheckCircle2,
  Circle,
  PlayCircle,
  Trash2,
  Edit3,
  AlertCircle,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Task } from "@/lib/types";
import { useState } from "react";

interface TodoItemProps {
  task: Task;
  onComplete: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
}

const priorityConfig = {
  high: {
    label: "高",
    icon: AlertCircle,
    color: "text-red-500",
    bg: "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900",
    badgeVariant: "destructive" as const,
  },
  medium: {
    label: "中",
    icon: Clock,
    color: "text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900",
    badgeVariant: "default" as const,
  },
  low: {
    label: "低",
    icon: Circle,
    color: "text-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900",
    badgeVariant: "secondary" as const,
  },
};

export default function TodoItem({ task, onComplete, onDelete, onEdit }: TodoItemProps) {
  const [showActions, setShowActions] = useState(false);
  const isCompleted = task.status === "completed";
  const isInProgress = task.status === "in_progress";
  const pConfig = priorityConfig[task.priority];

  const Icon = pConfig.icon;

  const formatDueDate = (dateStr?: string) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday = date.toDateString() === now.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();
    const isPast = date < now && !isToday;

    const timeStr = date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    if (isToday) return { text: `今天 ${timeStr}`, urgent: true };
    if (isTomorrow) return { text: `明天 ${timeStr}`, urgent: false };
    if (isPast && !isCompleted)
      return {
        text: `已过期 ${date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}`,
        urgent: true,
      };

    return {
      text: date.toLocaleDateString("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      urgent: false,
    };
  };

  const dueDate = formatDueDate(task.dueDate);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, height: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn(
        "group relative rounded-xl border p-3.5 transition-all duration-200",
        "hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800",
        isCompleted ? "opacity-60" : "",
        isInProgress && !isCompleted
          ? "border-l-4 border-l-indigo-500 dark:border-l-indigo-400"
          : "border-l",
        pConfig.bg
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-start gap-3">
        {/* Complete button */}
        <button
          onClick={() => onComplete(task.id, !isCompleted)}
          className={cn(
            "flex-shrink-0 mt-0.5 transition-colors",
            isCompleted
              ? "text-emerald-500 hover:text-emerald-600"
              : isInProgress
                ? "text-indigo-500 hover:text-indigo-600"
                : "text-muted-foreground/40 hover:text-emerald-500"
          )}
        >
          {isCompleted ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : isInProgress ? (
            <PlayCircle className="w-5 h-5" />
          ) : (
            <Circle className="w-5 h-5" />
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3
              className={cn(
                "text-sm font-medium leading-snug",
                isCompleted
                  ? "line-through text-muted-foreground"
                  : "text-foreground"
              )}
            >
              {task.title}
            </h3>

            {/* Action buttons */}
            <div
              className={cn(
                "flex items-center gap-1 transition-opacity",
                showActions ? "opacity-100" : "opacity-0"
              )}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg hover:bg-background/80"
                onClick={() => onEdit(task)}
              >
                <Edit3 className="w-3.5 h-3.5 text-muted-foreground hover:text-indigo-500" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg hover:bg-background/80"
                onClick={() => onDelete(task.id)}
              >
                <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-red-500" />
              </Button>
            </div>
          </div>

          {task.description && (
            <p
              className={cn(
                "text-xs text-muted-foreground mt-1 line-clamp-2",
                isCompleted && "line-through"
              )}
            >
              {task.description}
            </p>
          )}

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {/* Priority */}
            <Badge
              variant={pConfig.badgeVariant}
              className={cn(
                "text-[10px] h-5 px-1.5 gap-1 font-normal",
                task.priority === "medium" &&
                  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 hover:bg-amber-100",
                task.priority === "low" &&
                  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 hover:bg-emerald-100"
              )}
            >
              <Icon className="w-3 h-3" />
              {pConfig.label}优先级
            </Badge>

            {/* Due date */}
            {dueDate && (
              <span
                className={cn(
                  "flex items-center gap-1 text-[10px] text-muted-foreground",
                  dueDate.urgent &&
                    !isCompleted &&
                    "text-red-500 font-medium"
                )}
              >
                <Calendar className="w-3 h-3" />
                {dueDate.text}
              </span>
            )}

            {/* Tags */}
            {task.tags.length > 0 && (
              <div className="flex items-center gap-1">
                <Tag className="w-3 h-3 text-muted-foreground/60" />
                {task.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
