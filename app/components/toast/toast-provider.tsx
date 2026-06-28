"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const iconMap: Record<ToastType, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const colorMap: Record<ToastType, string> = {
  success: "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950",
  error: "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950",
  info: "border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950",
  warning: "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950",
};

const iconColorMap: Record<ToastType, string> = {
  success: "text-emerald-500",
  error: "text-red-500",
  info: "text-indigo-500",
  warning: "text-amber-500",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}

      {/* Toast container — fixed bottom-right */}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2 pointer-events-none"
        style={{ maxWidth: "380px" }}
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => {
            const Icon = iconMap[t.type];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, x: 80, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 80, scale: 0.95 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className={cn(
                  "pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 shadow-lg",
                  colorMap[t.type]
                )}
              >
                <Icon className={cn("w-4 h-4 flex-shrink-0 mt-0.5", iconColorMap[t.type])} />
                <p className="text-xs text-foreground flex-1 leading-relaxed">{t.message}</p>
                <button
                  onClick={() => removeToast(t.id)}
                  className="flex-shrink-0 -mr-0.5 -mt-0.5 p-0.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
