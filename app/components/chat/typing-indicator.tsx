"use client";

import { motion } from "framer-motion";
import { Bot } from "lucide-react";

export default function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="flex gap-3 mb-4"
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
        <Bot className="w-4 h-4 text-white" />
      </div>

      <div className="px-4 py-3 rounded-2xl rounded-tl-md bg-card border border-border shadow-sm">
        <div className="flex gap-1.5">
          <motion.span
            className="w-2 h-2 rounded-full bg-muted-foreground/40"
            animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.2, 1] }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: 0,
              ease: "easeInOut",
            }}
          />
          <motion.span
            className="w-2 h-2 rounded-full bg-muted-foreground/40"
            animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.2, 1] }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: 0.2,
              ease: "easeInOut",
            }}
          />
          <motion.span
            className="w-2 h-2 rounded-full bg-muted-foreground/40"
            animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.2, 1] }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: 0.4,
              ease: "easeInOut",
            }}
          />
        </div>
      </div>
    </motion.div>
  );
}
