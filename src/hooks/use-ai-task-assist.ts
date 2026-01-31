"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AITagSuggestion, AITimeEstimate } from "~/lib/ai-types";
import { api } from "~/trpc/react";

import { useDebounce } from "./use-debounce";

/** Minimum title length to trigger AI assist */
const MIN_TITLE_LENGTH = 10;

/**
 * Debounce delay for AI calls (ms)
 * With Groq's generous limits (30 RPM, 14,400 RPD), we can be more responsive
 */
const AI_DEBOUNCE_MS = 800;

export interface UseAITaskAssistOptions {
  /** Task title */
  title: string;
  /** Task description */
  description: string;
  /** Selected project ID (needed for tag context) */
  projectId: string;
  /** Whether AI assist is enabled (false when editing existing task) */
  enabled: boolean;
}

export interface UseAITaskAssistReturn {
  // Time estimation
  timeEstimate: AITimeEstimate | null;
  isEstimatingTime: boolean;
  hasUserSetTime: boolean;
  setHasUserSetTime: (value: boolean) => void;
  acceptTimeEstimate: () => number;
  dismissTimeEstimate: () => void;

  // Tag suggestions
  tagSuggestions: string[];
  tagReasoning: string | null;
  isSuggestingTags: boolean;
  hasUserEditedTags: boolean;
  setHasUserEditedTags: (value: boolean) => void;
  acceptTag: (tag: string) => void;
  dismissTag: (tag: string) => void;
  acceptAllTags: () => string[];
  dismissAllTags: () => void;
}

export function useAITaskAssist({
  title,
  description,
  projectId,
  enabled,
}: UseAITaskAssistOptions): UseAITaskAssistReturn {
  // Time estimation state
  const [timeEstimate, setTimeEstimate] = useState<AITimeEstimate | null>(null);
  const [hasUserSetTime, setHasUserSetTime] = useState(false);

  // Tag suggestions state
  const [tagSuggestion, setTagSuggestion] = useState<AITagSuggestion | null>(
    null
  );
  const [dismissedTags, setDismissedTags] = useState<Set<string>>(new Set());
  const [acceptedTags, setAcceptedTags] = useState<Set<string>>(new Set());
  const [hasUserEditedTags, setHasUserEditedTags] = useState(false);

  // Request tracking to ignore stale responses
  const requestId = useRef(0);

  // Debounced values
  const debouncedTitle = useDebounce(title, AI_DEBOUNCE_MS);
  const debouncedDescription = useDebounce(description, AI_DEBOUNCE_MS);

  // Track if we've already fetched for this input to avoid duplicate calls
  const lastFetchKey = useRef<string>("");

  // Single combined tRPC mutation (saves API quota!)
  const assistMutation = api.ai.assistTaskCreation.useMutation();

  // Reset state when dialog opens/closes or switches between create/edit
  useEffect(() => {
    if (!enabled) {
      setTimeEstimate(null);
      setTagSuggestion(null);
      setDismissedTags(new Set());
      setAcceptedTags(new Set());
      setHasUserSetTime(false);
      setHasUserEditedTags(false);
      lastFetchKey.current = "";
    }
  }, [enabled]);

  // Combined AI assist effect - ONE API call for both time + tags
  useEffect(() => {
    // Skip if disabled or title too short
    if (!enabled || debouncedTitle.length < MIN_TITLE_LENGTH) {
      return;
    }

    // Skip if user has manually set both time and tags (nothing to suggest)
    if (hasUserSetTime && hasUserEditedTags) {
      return;
    }

    // Create a unique key for this request
    const fetchKey = `${debouncedTitle}|${debouncedDescription}|${projectId}`;

    // Skip if we already fetched for this exact input
    if (lastFetchKey.current === fetchKey) {
      return;
    }

    // Mark as fetched to prevent duplicate calls
    lastFetchKey.current = fetchKey;
    const currentRequestId = ++requestId.current;

    assistMutation.mutate(
      {
        title: debouncedTitle,
        description: debouncedDescription,
        projectId: projectId || undefined,
      },
      {
        onSuccess: (result) => {
          // Ignore stale responses
          if (currentRequestId !== requestId.current) return;

          if (result.success && result.data) {
            // Only set time estimate if user hasn't manually set it
            if (!hasUserSetTime) {
              setTimeEstimate(result.data.timeEstimate);
            }
            // Only set tag suggestions if user hasn't manually edited tags
            if (!hasUserEditedTags) {
              setTagSuggestion(result.data.tagSuggestion);
              setDismissedTags(new Set());
              setAcceptedTags(new Set());
            }
          }
        },
        onError: () => {
          // Ignore stale responses
          if (currentRequestId !== requestId.current) return;
          // Silent failure - AI is an enhancement, not critical
        },
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTitle, debouncedDescription, projectId, enabled, hasUserSetTime, hasUserEditedTags]);

  // Time estimation actions
  const acceptTimeEstimate = useCallback(() => {
    const minutes = timeEstimate?.estimatedMinutes ?? 0;
    setHasUserSetTime(true);
    setTimeEstimate(null);
    return minutes;
  }, [timeEstimate]);

  const dismissTimeEstimate = useCallback(() => {
    setTimeEstimate(null);
    // Clear fetch key so new suggestions can be fetched if user keeps typing
    lastFetchKey.current = "";
  }, []);

  // Tag suggestion actions
  const acceptTag = useCallback((tag: string) => {
    setAcceptedTags((prev) => new Set(prev).add(tag));
  }, []);

  const dismissTag = useCallback((tag: string) => {
    setDismissedTags((prev) => new Set(prev).add(tag));
  }, []);

  const acceptAllTags = useCallback(() => {
    const available =
      tagSuggestion?.tags.filter(
        (tag) => !dismissedTags.has(tag) && !acceptedTags.has(tag)
      ) ?? [];
    setAcceptedTags((prev) => {
      const next = new Set(prev);
      available.forEach((tag) => next.add(tag));
      return next;
    });
    return available;
  }, [tagSuggestion, dismissedTags, acceptedTags]);

  const dismissAllTags = useCallback(() => {
    setTagSuggestion(null);
    setDismissedTags(new Set());
    setAcceptedTags(new Set());
    // Clear fetch key so new suggestions can be fetched if user keeps typing
    lastFetchKey.current = "";
  }, []);

  // Compute available tag suggestions (not dismissed or accepted)
  const tagSuggestions =
    tagSuggestion?.tags.filter(
      (tag) => !dismissedTags.has(tag) && !acceptedTags.has(tag)
    ) ?? [];

  return {
    // Time estimation
    timeEstimate,
    isEstimatingTime: assistMutation.isPending,
    hasUserSetTime,
    setHasUserSetTime,
    acceptTimeEstimate,
    dismissTimeEstimate,

    // Tag suggestions
    tagSuggestions,
    tagReasoning: tagSuggestion?.reasoning ?? null,
    isSuggestingTags: assistMutation.isPending,
    hasUserEditedTags,
    setHasUserEditedTags,
    acceptTag,
    dismissTag,
    acceptAllTags,
    dismissAllTags,
  };
}
