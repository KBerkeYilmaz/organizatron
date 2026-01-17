"use client";

import { useEffect, useRef } from "react";
import { useAtom, useSetAtom } from "jotai";
import { timerStateAtom, type TimerState } from "~/store/timer-atoms";

const CHANNEL_NAME = "organizatron-timer-sync";

interface SyncMessage {
  type: "STATE_UPDATE";
  state: TimerState;
  timestamp: number;
  tabId: string;
}

/**
 * Syncs timer state across browser tabs using BroadcastChannel
 * When state changes in one tab, all other tabs receive the update
 */
export function useTimerSync() {
  const [timerState, setTimerState] = useAtom(timerStateAtom);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const tabIdRef = useRef<string>(
    typeof crypto !== "undefined"
      ? crypto.randomUUID()
      : Math.random().toString(36)
  );
  const lastBroadcastRef = useRef<number>(0);

  // Initialize BroadcastChannel
  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
      return;
    }

    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;

    // Handle incoming messages from other tabs
    channel.onmessage = (event: MessageEvent<SyncMessage>) => {
      const { type, state, timestamp, tabId } = event.data;

      // Ignore our own messages
      if (tabId === tabIdRef.current) return;

      // Ignore old messages
      if (timestamp < lastBroadcastRef.current) return;

      if (type === "STATE_UPDATE") {
        // Only update if the incoming state is newer or different
        setTimerState(state);
      }
    };

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [setTimerState]);

  // Broadcast state changes to other tabs
  useEffect(() => {
    if (!channelRef.current) return;

    const message: SyncMessage = {
      type: "STATE_UPDATE",
      state: timerState,
      timestamp: Date.now(),
      tabId: tabIdRef.current,
    };

    lastBroadcastRef.current = message.timestamp;
    channelRef.current.postMessage(message);
  }, [timerState]);
}
