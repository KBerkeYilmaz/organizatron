"use client";

import { useEffect, useCallback } from "react";

type HotkeyHandler = () => void;

interface HotkeyConfig {
  key: string;
  handler: HotkeyHandler;
  enabled?: boolean;
  /** Prevent default browser behavior */
  preventDefault?: boolean;
  /** Also trigger on key repeat (holding key down) */
  allowRepeat?: boolean;
}

/**
 * Hook for handling keyboard shortcuts
 * Automatically ignores hotkeys when user is typing in inputs/textareas
 */
export function useHotkeys(hotkeys: HotkeyConfig[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Ignore if user is typing in an input, textarea, or contenteditable
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.closest("[data-radix-select-viewport]") // Ignore when select is open
      ) {
        return;
      }

      for (const hotkey of hotkeys) {
        if (hotkey.enabled === false) continue;
        if (!hotkey.allowRepeat && event.repeat) continue;

        const keyMatch = event.key.toLowerCase() === hotkey.key.toLowerCase();

        if (keyMatch) {
          if (hotkey.preventDefault) {
            event.preventDefault();
          }
          hotkey.handler();
          return;
        }
      }
    },
    [hotkeys]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
