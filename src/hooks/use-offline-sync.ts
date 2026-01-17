"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import {
  getQueuedActions,
  removeAction,
  incrementRetry,
  clearQueue,
  hasPendingActions,
  type QueuedAction,
} from "~/lib/offline-queue";

/**
 * Hook that syncs queued offline actions when the network comes back online.
 * Also provides network status information.
 */
export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const syncingRef = useRef(false);

  // tRPC mutations for syncing
  const startMutation = api.activeTimer.start.useMutation();
  const pauseMutation = api.activeTimer.pause.useMutation();
  const resumeMutation = api.activeTimer.resume.useMutation();
  const stopMutation = api.activeTimer.stop.useMutation();
  const discardMutation = api.activeTimer.discard.useMutation();

  // Update pending count
  const updatePendingCount = useCallback(() => {
    setPendingCount(getQueuedActions().length);
  }, []);

  // Process a single queued action
  const processAction = useCallback(
    async (action: QueuedAction): Promise<boolean> => {
      try {
        switch (action.type) {
          case "start":
            if (action.payload?.taskId) {
              await startMutation.mutateAsync({ taskId: action.payload.taskId });
            }
            break;
          case "pause":
            await pauseMutation.mutateAsync();
            break;
          case "resume":
            await resumeMutation.mutateAsync();
            break;
          case "stop":
            await stopMutation.mutateAsync();
            break;
          case "discard":
            await discardMutation.mutateAsync();
            break;
        }
        return true;
      } catch (error) {
        console.error(`Failed to sync action ${action.type}:`, error);
        return false;
      }
    },
    [startMutation, pauseMutation, resumeMutation, stopMutation, discardMutation]
  );

  // Sync all queued actions
  const syncQueue = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;

    const actions = getQueuedActions();
    if (actions.length === 0) return;

    syncingRef.current = true;
    setIsSyncing(true);

    let successCount = 0;
    let failCount = 0;

    // Process actions in order
    for (const action of actions) {
      const success = await processAction(action);

      if (success) {
        removeAction(action.id);
        successCount++;
      } else {
        // Increment retry count, remove if max retries exceeded
        const canRetry = incrementRetry(action.id);
        if (!canRetry) {
          failCount++;
        }
      }

      updatePendingCount();
    }

    syncingRef.current = false;
    setIsSyncing(false);

    // Show summary toast
    if (successCount > 0 || failCount > 0) {
      if (failCount === 0) {
        toast.success("Synced offline actions", {
          description: `${successCount} action${successCount > 1 ? "s" : ""} synced successfully`,
        });
      } else {
        toast.warning("Partial sync completed", {
          description: `${successCount} synced, ${failCount} failed`,
        });
      }
    }
  }, [processAction, updatePendingCount]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Back online", {
        description: hasPendingActions()
          ? "Syncing pending actions..."
          : "Connection restored",
      });
      // Sync after a short delay to ensure connection is stable
      setTimeout(syncQueue, 1000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("You're offline", {
        description: "Actions will be queued and synced when you're back online",
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial pending count
    updatePendingCount();

    // Try to sync on mount if online and have pending actions
    if (navigator.onLine && hasPendingActions()) {
      syncQueue();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncQueue, updatePendingCount]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    syncQueue,
    clearQueue,
  };
}
