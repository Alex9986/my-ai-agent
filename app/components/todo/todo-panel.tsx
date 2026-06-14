"use client";

import { useState, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { ListTodo } from "lucide-react";
import TodoItem from "./todo-item";
import TodoFilter from "./todo-filter";
import TodoSearch from "./todo-search";
import TaskEditDialog from "./task-edit-dialog";
import EmptyState from "./empty-state";
import { Task, TaskFilter } from "@/lib/types";

interface TodoPanelProps {
  tasks: Task[];
  onComplete: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Task>) => Promise<void>;
}

export default function TodoPanel({
  tasks,
  onComplete,
  onDelete,
  onUpdate,
}: TodoPanelProps) {
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Status filter — mutually exclusive tabs
    if (filter === "pending") {
      result = result.filter((t) => t.status === "pending");
    } else if (filter === "in_progress") {
      result = result.filter((t) => t.status === "in_progress");
    } else if (filter === "completed") {
      result = result.filter((t) => t.status === "completed");
    }
    // "all" — no filter

    // Search filter (case-insensitive, across title / description / tags)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q)) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }

    return result;
  }, [tasks, filter, searchQuery]);

  const counts = useMemo(
    () => ({
      all: tasks.length,
      pending: tasks.filter((t) => t.status === "pending").length,
      in_progress: tasks.filter((t) => t.status === "in_progress").length,
      completed: tasks.filter((t) => t.status === "completed").length,
    }),
    [tasks]
  );

  const sortedTasks = useMemo(() => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return [...filteredTasks].sort((a, b) => {
      if (a.status === "completed" && b.status !== "completed") return 1;
      if (a.status !== "completed" && b.status === "completed") return -1;
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [filteredTasks]);

  const handleSave = async (id: string, updates: Partial<Task>) => {
    await onUpdate(id, updates);
    setEditingTask(null);
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border px-4 py-3 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-md shadow-violet-500/20">
            <ListTodo className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">我的任务</h2>
            <p className="text-[11px] text-muted-foreground">
              {counts.pending + counts.in_progress > 0
                ? `${counts.pending + counts.in_progress} 个待完成`
                : "全部完成！🎉"}
            </p>
          </div>
        </div>

        {/* Search */}
        <TodoSearch value={searchQuery} onChange={setSearchQuery} />

        {/* Filter tabs */}
        <TodoFilter
          currentFilter={filter}
          onFilterChange={setFilter}
          counts={counts}
        />
      </div>

      {/* Task list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-3 space-y-2">
          {sortedTasks.length === 0 ? (
            <EmptyState filter={filter} />
          ) : (
            <AnimatePresence mode="popLayout">
              {sortedTasks.map((task) => (
                <TodoItem
                  key={task.id}
                  task={task}
                  onComplete={onComplete}
                  onDelete={onDelete}
                  onEdit={setEditingTask}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Edit dialog */}
      <TaskEditDialog
        task={editingTask}
        open={editingTask !== null}
        onSave={handleSave}
        onClose={() => setEditingTask(null)}
      />
    </div>
  );
}
