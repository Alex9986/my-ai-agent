"use client";

import { useEffect } from "react";

/**
 * A minimal keyboard shortcut hook.
 * Pass a map of key combos (e.g. "ctrl+k") → handler.
 * Automatically normalizes Mac (Cmd) vs Windows/Linux (Ctrl).
 */
export function useKeyboardShortcuts(
  shortcuts: Record<string, (e: KeyboardEvent) => void>,
  deps: unknown[] = []
) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const mod = isMac ? e.metaKey : e.ctrlKey;

      for (const [combo, fn] of Object.entries(shortcuts)) {
        const parts = combo.toLowerCase().split("+");
        const key = parts[parts.length - 1];
        const modParts = parts.slice(0, -1);
        const wantsMod = modParts.includes("ctrl") || modParts.includes("cmd") || modParts.includes("mod");
        const wantsShift = modParts.includes("shift");

        const modMatch = wantsMod ? mod : !mod;
        const shiftMatch = wantsShift ? e.shiftKey : !e.shiftKey;
        const keyMatch = e.key.toLowerCase() === key;

        if (modMatch && shiftMatch && keyMatch) {
          e.preventDefault();
          fn(e);
          return;
        }
      }
    }

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortcuts, ...deps]);
}
