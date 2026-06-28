"use client";

import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TodoSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export default function TodoSearch({ value, onChange }: TodoSearchProps) {
  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="搜索任务... (Ctrl+K)"
        className={cn(
          "w-full h-8 pl-7.5 pr-7 rounded-lg text-xs",
          "bg-muted/60 border border-transparent",
          "placeholder:text-muted-foreground/60",
          "focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/30",
          "transition-all duration-200"
        )}
        data-shortcut="search"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className={cn(
            "absolute right-1.5 top-1/2 -translate-y-1/2",
            "w-5 h-5 rounded-md flex items-center justify-center",
            "text-muted-foreground hover:text-foreground hover:bg-muted",
            "transition-colors"
          )}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
