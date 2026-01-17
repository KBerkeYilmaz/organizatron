"use client";

import { useDocumentTitle } from "~/hooks/use-document-title";
import { useTimerHotkeys } from "~/hooks/use-timer-hotkeys";
import { useTimerSync } from "~/hooks/use-timer-sync";
import { useOfflineSync } from "~/hooks/use-offline-sync";

interface TimerProviderProps {
  children: React.ReactNode;
}

/**
 * Provider component that initializes timer-related features:
 * - Document title updates (shows timer in tab)
 * - Keyboard shortcuts (Space, S, D)
 * - Cross-tab sync (BroadcastChannel)
 * - Offline action queue sync
 *
 * Place this near the root of your app, inside the Jotai Provider.
 */
export function TimerProvider({ children }: TimerProviderProps) {
  // Initialize all timer features
  useDocumentTitle();
  useTimerHotkeys();
  useTimerSync();
  useOfflineSync();

  return <>{children}</>;
}
