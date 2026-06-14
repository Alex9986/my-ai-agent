"use client";

import { useState, useEffect } from "react";
import { Save, AlertCircle, Clock, Circle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Task } from "@/lib/types";

interface TaskEditDialogProps {
  task: Task | null;
  open: boolean;
  onSave: (id: string, updates: Partial<Task>) => Promise<void>;
  onClose: () => void;
}

const priorityConfig: Record<
  Task["priority"],
  { label: string; icon: typeof AlertCircle; color: string; ring: string }
> = {
  high: {
    label: "高",
    icon: AlertCircle,
    color: "text-red-500",
    ring: "ring-red-500/20",
  },
  medium: {
    label: "中",
    icon: Clock,
    color: "text-amber-500",
    ring: "ring-amber-500/20",
  },
  low: {
    label: "低",
    icon: Circle,
    color: "text-emerald-500",
    ring: "ring-emerald-500/20",
  },
};

export default function TaskEditDialog({
  task,
  open,
  onSave,
  onClose,
}: TaskEditDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [status, setStatus] = useState<Task["status"]>("pending");
  const [dueDate, setDueDate] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset form when task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setPriority(task.priority);
      setStatus(task.status);
      // Format ISO date to datetime-local input value
      setDueDate(
        task.dueDate
          ? new Date(task.dueDate).toISOString().slice(0, 16)
          : ""
      );
      setTagsInput(task.tags.join(", "));
    }
  }, [task]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !title.trim() || saving) return;

    setSaving(true);

    const tags = tagsInput
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean);

    const updates: Partial<Task> = {
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      status,
      dueDate: dueDate || undefined,
      tags,
    };

    await onSave(task.id, updates);
    setSaving(false);
  };

  const handleDialogClose = () => {
    if (!saving) onClose();
  };

  const priorityOptions: Task["priority"][] = ["high", "medium", "low"];

  // Build formatted due date string for display
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleDialogClose()}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={!saving}
      >
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>编辑任务</DialogTitle>
            <DialogDescription>
              修改任务的详细信息，完成后点击保存。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                任务标题 <span className="text-red-500">*</span>
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="输入任务标题"
                required
                className="w-full"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                描述
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="添加详细描述（可选）"
                rows={3}
                className={cn(
                  "w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5",
                  "text-sm transition-colors outline-none",
                  "placeholder:text-muted-foreground",
                  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  "dark:bg-input/30"
                )}
              />
            </div>

            {/* Priority + Status row */}
            <div className="grid grid-cols-2 gap-3">
              {/* Priority */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  优先级
                </label>
                <div className="flex gap-1 p-1 rounded-lg bg-muted/60">
                  {priorityOptions.map((p) => {
                    const cfg = priorityConfig[p];
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all",
                          priority === p
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Icon className={cn("w-3 h-3", cfg.color)} />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  状态
                </label>
                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as Task["status"])
                  }
                  className={cn(
                    "w-full h-8 rounded-lg border border-input bg-transparent px-2.5",
                    "text-xs transition-colors outline-none",
                    "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                    "dark:bg-input/30"
                  )}
                >
                  <option value="pending">待办</option>
                  <option value="in_progress">进行中</option>
                  <option value="completed">已完成</option>
                </select>
              </div>
            </div>

            {/* Due Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                截止日期
              </label>
              <div className="flex gap-2">
                <input
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={today + "T00:00"}
                  className={cn(
                    "flex-1 h-8 rounded-lg border border-input bg-transparent px-2.5",
                    "text-xs transition-colors outline-none",
                    "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                    "dark:bg-input/30"
                  )}
                />
                {dueDate && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground"
                    onClick={() => setDueDate("")}
                  >
                    清除
                  </Button>
                )}
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                标签
              </label>
              <Input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="用逗号分隔，如：工作, 紧急"
                className="w-full"
              />
              {tagsInput
                .split(/[,，]/)
                .map((t) => t.trim())
                .filter(Boolean).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {tagsInput
                    .split(/[,，]/)
                    .map((t) => t.trim())
                    .filter(Boolean)
                    .map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="text-[10px] h-5 px-1.5"
                      >
                        {tag}
                      </Badge>
                    ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleDialogClose}
              disabled={saving}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || saving}
              className="gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
