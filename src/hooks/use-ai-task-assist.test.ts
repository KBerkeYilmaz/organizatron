/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock tRPC - now uses single combined endpoint
const mockAssistMutate = vi.fn();
let assistIsPending = false;

vi.mock("~/trpc/react", () => ({
  api: {
    ai: {
      assistTaskCreation: {
        useMutation: () => ({
          mutate: mockAssistMutate,
          isPending: assistIsPending,
        }),
      },
    },
  },
}));

// Import after mocks
import { useAITaskAssist } from "./use-ai-task-assist";

// Match the constants from the hook
const AI_DEBOUNCE_MS = 2500;
const MIN_TITLE_LENGTH = 10;

// Helper to create combined response
const createAssistResponse = (
  timeEstimate: { estimatedMinutes: number; confidence: "low" | "medium" | "high"; reasoning: string },
  tagSuggestion: { tags: string[]; reasoning: string }
) => ({
  success: true as const,
  data: { timeEstimate, tagSuggestion },
});

describe("useAITaskAssist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    assistIsPending = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Initial State", () => {
    it("should start with no suggestions", () => {
      const { result } = renderHook(() =>
        useAITaskAssist({
          title: "",
          description: "",
          projectId: "",
          enabled: true,
        })
      );

      expect(result.current.timeEstimate).toBeNull();
      expect(result.current.tagSuggestions).toEqual([]);
      expect(result.current.hasUserSetTime).toBe(false);
      expect(result.current.hasUserEditedTags).toBe(false);
    });

    it("should expose all action handlers", () => {
      const { result } = renderHook(() =>
        useAITaskAssist({
          title: "",
          description: "",
          projectId: "",
          enabled: true,
        })
      );

      expect(typeof result.current.acceptTimeEstimate).toBe("function");
      expect(typeof result.current.dismissTimeEstimate).toBe("function");
      expect(typeof result.current.acceptTag).toBe("function");
      expect(typeof result.current.dismissTag).toBe("function");
      expect(typeof result.current.acceptAllTags).toBe("function");
      expect(typeof result.current.dismissAllTags).toBe("function");
    });
  });

  describe("Combined AI Assist", () => {
    it("should not call API when title is too short", () => {
      renderHook(() =>
        useAITaskAssist({
          title: "short", // Less than MIN_TITLE_LENGTH (10)
          description: "",
          projectId: "project-1",
          enabled: true,
        })
      );

      act(() => {
        vi.advanceTimersByTime(AI_DEBOUNCE_MS + 100);
      });

      expect(mockAssistMutate).not.toHaveBeenCalled();
    });

    it("should debounce API calls", () => {
      const { rerender } = renderHook(
        ({ title }) =>
          useAITaskAssist({
            title,
            description: "",
            projectId: "project-1",
            enabled: true,
          }),
        { initialProps: { title: "Build a new feature for the app" } }
      );

      // Before debounce completes - title change resets debounce
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Update title (resets debounce)
      rerender({ title: "Build a new feature for users" });

      // Advance past first debounce (but not second)
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Complete second debounce
      act(() => {
        vi.advanceTimersByTime(AI_DEBOUNCE_MS);
      });

      // Should have called with the updated title
      expect(mockAssistMutate).toHaveBeenCalledWith(
        {
          title: "Build a new feature for users",
          description: "",
          projectId: "project-1",
        },
        expect.any(Object)
      );
    });

    it("should call assistTaskCreation after debounce with valid title", () => {
      renderHook(() =>
        useAITaskAssist({
          title: "Build a new feature for the application",
          description: "Some description",
          projectId: "project-1",
          enabled: true,
        })
      );

      act(() => {
        vi.advanceTimersByTime(AI_DEBOUNCE_MS + 100);
      });

      expect(mockAssistMutate).toHaveBeenCalledWith(
        {
          title: "Build a new feature for the application",
          description: "Some description",
          projectId: "project-1",
        },
        expect.any(Object)
      );
    });

    it("should not call API when disabled", () => {
      renderHook(() =>
        useAITaskAssist({
          title: "Build a new feature for the app",
          description: "",
          projectId: "project-1",
          enabled: false,
        })
      );

      act(() => {
        vi.advanceTimersByTime(AI_DEBOUNCE_MS + 100);
      });

      expect(mockAssistMutate).not.toHaveBeenCalled();
    });

    it("should not call API when both time and tags are manually set", () => {
      const { result, rerender } = renderHook(
        ({ title }) =>
          useAITaskAssist({
            title,
            description: "",
            projectId: "project-1",
            enabled: true,
          }),
        { initialProps: { title: "" } }
      );

      // Set both flags before typing
      act(() => {
        result.current.setHasUserSetTime(true);
        result.current.setHasUserEditedTags(true);
      });

      // Now add a title
      rerender({ title: "Build a new feature for the app" });

      act(() => {
        vi.advanceTimersByTime(AI_DEBOUNCE_MS + 100);
      });

      expect(mockAssistMutate).not.toHaveBeenCalled();
    });

    it("should handle successful combined response", () => {
      mockAssistMutate.mockImplementation((_input, callbacks) => {
        callbacks?.onSuccess?.(
          createAssistResponse(
            { estimatedMinutes: 45, confidence: "medium", reasoning: "Based on similar tasks" },
            { tags: ["frontend", "react", "ui"], reasoning: "Based on title keywords" }
          )
        );
      });

      const { result } = renderHook(() =>
        useAITaskAssist({
          title: "Build a new feature for the app",
          description: "",
          projectId: "project-1",
          enabled: true,
        })
      );

      act(() => {
        vi.advanceTimersByTime(AI_DEBOUNCE_MS + 100);
      });

      expect(result.current.timeEstimate).toEqual({
        estimatedMinutes: 45,
        confidence: "medium",
        reasoning: "Based on similar tasks",
      });
      expect(result.current.tagSuggestions).toEqual(["frontend", "react", "ui"]);
      expect(result.current.tagReasoning).toBe("Based on title keywords");
    });

    it("should handle API error silently", () => {
      mockAssistMutate.mockImplementation((_input, callbacks) => {
        callbacks?.onError?.(new Error("API Error"));
      });

      const { result } = renderHook(() =>
        useAITaskAssist({
          title: "Build a new feature for the app",
          description: "",
          projectId: "project-1",
          enabled: true,
        })
      );

      act(() => {
        vi.advanceTimersByTime(AI_DEBOUNCE_MS + 100);
      });

      expect(result.current.timeEstimate).toBeNull();
      expect(result.current.tagSuggestions).toEqual([]);
    });

    it("should ignore stale responses", () => {
      let callCount = 0;
      const responses = [
        createAssistResponse(
          { estimatedMinutes: 30, confidence: "low", reasoning: "First" },
          { tags: ["old"], reasoning: "First" }
        ),
        createAssistResponse(
          { estimatedMinutes: 60, confidence: "high", reasoning: "Second" },
          { tags: ["new"], reasoning: "Second" }
        ),
      ];

      mockAssistMutate.mockImplementation((_input, callbacks) => {
        const responseIndex = callCount++;
        // Simulate async - second call responds immediately, first responds later
        if (responseIndex === 0) {
          // First call - don't respond yet
        } else {
          // Second call - respond immediately
          callbacks?.onSuccess?.(responses[1]);
        }
      });

      const { result, rerender } = renderHook(
        ({ title }) =>
          useAITaskAssist({
            title,
            description: "",
            projectId: "project-1",
            enabled: true,
          }),
        { initialProps: { title: "First task title here" } }
      );

      // Trigger first call
      act(() => {
        vi.advanceTimersByTime(AI_DEBOUNCE_MS + 100);
      });

      // Update title to trigger second call
      rerender({ title: "Second task title here" });

      act(() => {
        vi.advanceTimersByTime(AI_DEBOUNCE_MS + 100);
      });

      // Should have the second response (most recent)
      expect(result.current.timeEstimate?.reasoning).toBe("Second");
      expect(result.current.tagSuggestions).toEqual(["new"]);
    });

    it("should only set time estimate if user has not manually set it", () => {
      mockAssistMutate.mockImplementation((_input, callbacks) => {
        callbacks?.onSuccess?.(
          createAssistResponse(
            { estimatedMinutes: 45, confidence: "medium", reasoning: "AI suggestion" },
            { tags: ["frontend"], reasoning: "Tags" }
          )
        );
      });

      const { result, rerender } = renderHook(
        ({ title }) =>
          useAITaskAssist({
            title,
            description: "",
            projectId: "project-1",
            enabled: true,
          }),
        { initialProps: { title: "" } }
      );

      // User sets time first
      act(() => {
        result.current.setHasUserSetTime(true);
      });

      // Add title
      rerender({ title: "Build a new feature for the app" });

      act(() => {
        vi.advanceTimersByTime(AI_DEBOUNCE_MS + 100);
      });

      // Time estimate should NOT be set (user already set it)
      expect(result.current.timeEstimate).toBeNull();
      // But tags should still come through
      expect(result.current.tagSuggestions).toEqual(["frontend"]);
    });

    it("should only set tag suggestions if user has not manually edited tags", () => {
      mockAssistMutate.mockImplementation((_input, callbacks) => {
        callbacks?.onSuccess?.(
          createAssistResponse(
            { estimatedMinutes: 45, confidence: "medium", reasoning: "AI suggestion" },
            { tags: ["frontend"], reasoning: "Tags" }
          )
        );
      });

      const { result, rerender } = renderHook(
        ({ title }) =>
          useAITaskAssist({
            title,
            description: "",
            projectId: "project-1",
            enabled: true,
          }),
        { initialProps: { title: "" } }
      );

      // User edits tags first
      act(() => {
        result.current.setHasUserEditedTags(true);
      });

      // Add title
      rerender({ title: "Build a new feature for the app" });

      act(() => {
        vi.advanceTimersByTime(AI_DEBOUNCE_MS + 100);
      });

      // Tags should NOT be set (user already edited them)
      expect(result.current.tagSuggestions).toEqual([]);
      // But time estimate should still come through
      expect(result.current.timeEstimate?.estimatedMinutes).toBe(45);
    });
  });

  describe("Tag Actions", () => {
    it("should remove tag from suggestions when accepted", () => {
      mockAssistMutate.mockImplementation((_input, callbacks) => {
        callbacks?.onSuccess?.(
          createAssistResponse(
            { estimatedMinutes: 30, confidence: "low", reasoning: "Test" },
            { tags: ["frontend", "react", "ui"], reasoning: "Test" }
          )
        );
      });

      const { result } = renderHook(() =>
        useAITaskAssist({
          title: "Build a new feature for the app",
          description: "",
          projectId: "project-1",
          enabled: true,
        })
      );

      act(() => {
        vi.advanceTimersByTime(AI_DEBOUNCE_MS + 100);
      });

      expect(result.current.tagSuggestions).toHaveLength(3);

      act(() => {
        result.current.acceptTag("frontend");
      });

      expect(result.current.tagSuggestions).toEqual(["react", "ui"]);
    });

    it("should remove tag from suggestions when dismissed", () => {
      mockAssistMutate.mockImplementation((_input, callbacks) => {
        callbacks?.onSuccess?.(
          createAssistResponse(
            { estimatedMinutes: 30, confidence: "low", reasoning: "Test" },
            { tags: ["frontend", "react", "ui"], reasoning: "Test" }
          )
        );
      });

      const { result } = renderHook(() =>
        useAITaskAssist({
          title: "Build a new feature for the app",
          description: "",
          projectId: "project-1",
          enabled: true,
        })
      );

      act(() => {
        vi.advanceTimersByTime(AI_DEBOUNCE_MS + 100);
      });

      expect(result.current.tagSuggestions).toHaveLength(3);

      act(() => {
        result.current.dismissTag("react");
      });

      expect(result.current.tagSuggestions).toEqual(["frontend", "ui"]);
    });

    it("should accept all remaining tags", () => {
      mockAssistMutate.mockImplementation((_input, callbacks) => {
        callbacks?.onSuccess?.(
          createAssistResponse(
            { estimatedMinutes: 30, confidence: "low", reasoning: "Test" },
            { tags: ["frontend", "react", "ui"], reasoning: "Test" }
          )
        );
      });

      const { result } = renderHook(() =>
        useAITaskAssist({
          title: "Build a new feature for the app",
          description: "",
          projectId: "project-1",
          enabled: true,
        })
      );

      act(() => {
        vi.advanceTimersByTime(AI_DEBOUNCE_MS + 100);
      });

      expect(result.current.tagSuggestions).toHaveLength(3);

      // Dismiss one first
      act(() => {
        result.current.dismissTag("react");
      });

      // Accept all remaining
      let accepted: string[] = [];
      act(() => {
        accepted = result.current.acceptAllTags();
      });

      expect(accepted).toEqual(["frontend", "ui"]);
      expect(result.current.tagSuggestions).toEqual([]);
    });

    it("should clear all suggestions when dismissAll", () => {
      mockAssistMutate.mockImplementation((_input, callbacks) => {
        callbacks?.onSuccess?.(
          createAssistResponse(
            { estimatedMinutes: 30, confidence: "low", reasoning: "Test" },
            { tags: ["frontend", "react", "ui"], reasoning: "Test" }
          )
        );
      });

      const { result } = renderHook(() =>
        useAITaskAssist({
          title: "Build a new feature for the app",
          description: "",
          projectId: "project-1",
          enabled: true,
        })
      );

      act(() => {
        vi.advanceTimersByTime(AI_DEBOUNCE_MS + 100);
      });

      expect(result.current.tagSuggestions).toHaveLength(3);

      act(() => {
        result.current.dismissAllTags();
      });

      expect(result.current.tagSuggestions).toEqual([]);
      expect(result.current.tagReasoning).toBeNull();
    });
  });

  describe("Time Estimate Actions", () => {
    it("should return estimated minutes and set hasUserSetTime when accepted", () => {
      mockAssistMutate.mockImplementation((_input, callbacks) => {
        callbacks?.onSuccess?.(
          createAssistResponse(
            { estimatedMinutes: 45, confidence: "medium", reasoning: "Test" },
            { tags: [], reasoning: "Test" }
          )
        );
      });

      const { result } = renderHook(() =>
        useAITaskAssist({
          title: "Build a new feature for the app",
          description: "",
          projectId: "project-1",
          enabled: true,
        })
      );

      act(() => {
        vi.advanceTimersByTime(AI_DEBOUNCE_MS + 100);
      });

      expect(result.current.timeEstimate).not.toBeNull();

      let minutes = 0;
      act(() => {
        minutes = result.current.acceptTimeEstimate();
      });

      expect(minutes).toBe(45);
      expect(result.current.hasUserSetTime).toBe(true);
      expect(result.current.timeEstimate).toBeNull();
    });

    it("should clear estimate when dismissed", () => {
      mockAssistMutate.mockImplementation((_input, callbacks) => {
        callbacks?.onSuccess?.(
          createAssistResponse(
            { estimatedMinutes: 45, confidence: "medium", reasoning: "Test" },
            { tags: [], reasoning: "Test" }
          )
        );
      });

      const { result } = renderHook(() =>
        useAITaskAssist({
          title: "Build a new feature for the app",
          description: "",
          projectId: "project-1",
          enabled: true,
        })
      );

      act(() => {
        vi.advanceTimersByTime(AI_DEBOUNCE_MS + 100);
      });

      expect(result.current.timeEstimate).not.toBeNull();

      act(() => {
        result.current.dismissTimeEstimate();
      });

      expect(result.current.timeEstimate).toBeNull();
      expect(result.current.hasUserSetTime).toBe(false);
    });
  });

  describe("State Reset", () => {
    it("should reset all state when disabled", () => {
      const { result, rerender } = renderHook(
        ({ enabled }) =>
          useAITaskAssist({
            title: "Build a new feature for the app",
            description: "",
            projectId: "project-1",
            enabled,
          }),
        { initialProps: { enabled: true } }
      );

      // Set some state
      act(() => {
        result.current.setHasUserSetTime(true);
        result.current.setHasUserEditedTags(true);
      });

      // Disable (simulate switching to edit mode)
      rerender({ enabled: false });

      expect(result.current.timeEstimate).toBeNull();
      expect(result.current.tagSuggestions).toEqual([]);
      expect(result.current.hasUserSetTime).toBe(false);
      expect(result.current.hasUserEditedTags).toBe(false);
    });
  });
});
