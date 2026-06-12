"use client";

import { useState, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { ListTodo } from "lucide-react";
import TodoItem from "./todo-item";
import TodoFilter from "./todo-filter";
import EmptyState from "./empty-state";
import { Task, TaskFilter } from "@/lib/types";

interface TodoPanelProps {
  tasks: Task[];
  onComplete: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}

export default function TodoPanel({ tasks, onComplete, onDelete }: TodoPanelProps) {
  const [filter, setFilter] = useState<TaskFilter>("all");

  const filteredTasks = useMemo(() => {
    if (filter === "all") return tasks;
    if (filter === "completed")
      return tasks.filter((t) => t.status === "completed");
    return tasks.filter((t) => t.status !== "completed");
  }, [tasks, filter]);

  const counts = useMemo(
    () => ({
      all: tasks.length,
      pending: tasks.filter((t) => t.status !== "completed").length,
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

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-md shadow-violet-500/20">
            <ListTodo className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">我的任务</h2>
            <p className="text-[11px] text-muted-foreground">
              {counts.pending > 0
                ? `${counts.pending} 个待完成`
                : "全部完成！🎉"}
            </p>
          </div>
        </div>

        <TodoFilter
          currentFilter={filter}
          onFilterChange={setFilter}
          counts={counts}
        />
      </div>

      {/* Task list — plain overflow-y-auto */}
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
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
