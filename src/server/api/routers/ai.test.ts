import { describe, expect, it, vi, beforeEach } from "vitest";
import { createTestCaller, prismaMock } from "~/test/trpc-helper";

// Mock the AI service
vi.mock("~/server/services/ai", () => ({
  aiService: {
    isAvailable: vi.fn(),
    estimateTime: vi.fn(),
    suggestTags: vi.fn(),
    breakdownGoal: vi.fn(),
    getTaskGuidance: vi.fn(),
    analyzeProject: vi.fn(),
  },
}));

// Import after mocking
import { aiService } from "~/server/services/ai";

const mockAiService = aiService as unknown as {
  isAvailable: ReturnType<typeof vi.fn>;
  estimateTime: ReturnType<typeof vi.fn>;
  suggestTags: ReturnType<typeof vi.fn>;
  breakdownGoal: ReturnType<typeof vi.fn>;
  getTaskGuidance: ReturnType<typeof vi.fn>;
  analyzeProject: ReturnType<typeof vi.fn>;
};

const mockClient = {
  id: "client-1",
  name: "Test Client",
  color: "#6366f1",
  logo: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const mockProject = {
  id: "project-1",
  clientId: "client-1",
  name: "Test Project",
  description: null,
  status: "active" as const,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  client: mockClient,
};

const mockTask = {
  id: "task-1",
  projectId: "project-1",
  title: "Test Task",
  description: "Task description",
  status: "todo" as const,
  priority: "medium" as const,
  estimatedTime: null,
  dueDate: null,
  scheduledStart: null,
  tags: ["frontend"],
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  completedAt: null,
  isBillable: false,
  hourlyRate: null,
  currency: "USD",
  billingStatus: "pending" as const,
  googleEventId: null,
  project: mockProject,
};

describe("aiRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAiService.isAvailable.mockReturnValue(true);
  });

  describe("getStatus", () => {
    it("returns available true when AI service is configured", async () => {
      mockAiService.isAvailable.mockReturnValue(true);

      const caller = createTestCaller();
      const result = await caller.ai.getStatus();

      expect(result).toEqual({ available: true });
    });

    it("returns available false when AI service is not configured", async () => {
      mockAiService.isAvailable.mockReturnValue(false);

      const caller = createTestCaller();
      const result = await caller.ai.getStatus();

      expect(result).toEqual({ available: false });
    });
  });

  describe("estimateTime", () => {
    it("returns time estimate for a task", async () => {
      mockAiService.estimateTime.mockResolvedValue({
        estimatedMinutes: 60,
        confidence: "medium",
        reasoning: "Based on task complexity",
      });

      // Mock similar completed tasks query
      prismaMock.task.findMany.mockResolvedValue([
        {
          ...mockTask,
          id: "similar-1",
          title: "Similar task",
          status: "completed" as const,
          estimatedTime: 3600,
          timeEntries: [{ duration: 3300 }],
        },
      ] as any);

      const caller = createTestCaller();
      const result = await caller.ai.estimateTime({
        title: "Implement authentication",
        description: "Add login and signup forms",
      });

      expect(result).toEqual({
        success: true,
        data: {
          estimatedMinutes: 60,
          confidence: "medium",
          reasoning: "Based on task complexity",
        },
      });
    });

    it("returns error when AI service is unavailable", async () => {
      mockAiService.isAvailable.mockReturnValue(false);

      const caller = createTestCaller();
      const result = await caller.ai.estimateTime({
        title: "Test task",
      });

      expect(result).toEqual({
        success: false,
        error: "AI not configured",
      });
    });

    it("returns error when estimation fails", async () => {
      mockAiService.estimateTime.mockResolvedValue(null);
      prismaMock.task.findMany.mockResolvedValue([]);

      const caller = createTestCaller();
      const result = await caller.ai.estimateTime({
        title: "Test task",
      });

      expect(result).toEqual({
        success: false,
        error: "Failed to generate estimate",
      });
    });
  });

  describe("suggestTags", () => {
    it("returns tag suggestions for a task", async () => {
      mockAiService.suggestTags.mockResolvedValue({
        tags: ["auth", "security", "backend"],
        reasoning: "Task relates to authentication",
      });

      prismaMock.project.findUnique.mockResolvedValue({
        ...mockProject,
        tasks: [{ tags: ["frontend", "api"] }],
      } as any);

      const caller = createTestCaller();
      const result = await caller.ai.suggestTags({
        title: "Add password reset",
        projectId: "project-1",
      });

      expect(result).toEqual({
        success: true,
        data: {
          tags: ["auth", "security", "backend"],
          reasoning: "Task relates to authentication",
        },
      });
    });

    it("returns error when AI service is unavailable", async () => {
      mockAiService.isAvailable.mockReturnValue(false);

      const caller = createTestCaller();
      const result = await caller.ai.suggestTags({
        title: "Test task",
      });

      expect(result).toEqual({
        success: false,
        error: "AI not configured",
      });
    });
  });

  describe("breakdownGoal", () => {
    it("breaks down a goal into tasks", async () => {
      const mockBreakdown = {
        goal: "Learn React",
        tasks: [
          {
            title: "Read React docs",
            description: "Go through official documentation",
            estimatedMinutes: 120,
            order: 1,
            guidance: "Start with main concepts",
          },
          {
            title: "Build a todo app",
            description: "Practice with a simple project",
            estimatedMinutes: 180,
            order: 2,
            guidance: "Apply what you learned",
          },
        ],
        totalEstimatedTime: 300,
        summary: "Start with fundamentals then practice",
      };

      mockAiService.breakdownGoal.mockResolvedValue(mockBreakdown);

      const caller = createTestCaller();
      const result = await caller.ai.breakdownGoal({
        goal: "Learn React",
        context: "I know JavaScript",
      });

      expect(result).toEqual({
        success: true,
        data: mockBreakdown,
      });
    });

    it("returns error when breakdown fails", async () => {
      mockAiService.breakdownGoal.mockResolvedValue(null);

      const caller = createTestCaller();
      const result = await caller.ai.breakdownGoal({
        goal: "Test goal",
      });

      expect(result).toEqual({
        success: false,
        error: "Failed to breakdown goal",
      });
    });
  });

  describe("getTaskGuidance", () => {
    it("returns guidance for a task", async () => {
      prismaMock.task.findUnique.mockResolvedValue({
        ...mockTask,
        project: mockProject,
      } as any);

      mockAiService.getTaskGuidance.mockResolvedValue({
        taskId: "task-1",
        guidance: "Start by setting up the form component",
        suggestedPrompts: ["Create a login form with validation"],
        learningResources: [
          {
            title: "React Forms Guide",
            type: "article",
            description: "Learn form handling in React",
          },
        ],
        breakdownSuggestion: {
          shouldBreakdown: false,
        },
      });

      const caller = createTestCaller();
      const result = await caller.ai.getTaskGuidance({
        taskId: "task-1",
      });

      expect(result.success).toBe(true);
      expect(result.data?.guidance).toBeDefined();
      expect(result.data?.suggestedPrompts).toHaveLength(1);
    });

    it("returns error when task not found", async () => {
      prismaMock.task.findUnique.mockResolvedValue(null);

      const caller = createTestCaller();
      const result = await caller.ai.getTaskGuidance({
        taskId: "nonexistent",
      });

      expect(result).toEqual({
        success: false,
        error: "Task not found",
      });
    });
  });

  describe("analyzeProject", () => {
    it("analyzes project tasks and returns execution plan", async () => {
      const mockTasks = [
        { ...mockTask, id: "task-1", title: "Setup database", project: mockProject },
        { ...mockTask, id: "task-2", title: "Create API", project: mockProject },
      ];

      prismaMock.task.findMany.mockResolvedValue(mockTasks as any);

      mockAiService.analyzeProject.mockResolvedValue({
        tasks: [
          { taskId: "task-1", suggestedOrder: 1, estimatedMinutes: 60 },
          { taskId: "task-2", suggestedOrder: 2, estimatedMinutes: 120 },
        ],
        schedule: [
          {
            taskId: "task-1",
            suggestedStart: new Date("2024-02-01T09:00:00Z"),
            suggestedEnd: new Date("2024-02-01T10:00:00Z"),
          },
        ],
        summary: "Start with database",
        totalEstimatedTime: 180,
      });

      const caller = createTestCaller();
      const result = await caller.ai.analyzeProject({
        projectId: "project-1",
      });

      expect(result.success).toBe(true);
      expect(result.data?.tasks).toHaveLength(2);
      expect(result.data?.summary).toContain("database");
    });

    it("returns error when no tasks found", async () => {
      prismaMock.task.findMany.mockResolvedValue([]);

      const caller = createTestCaller();
      const result = await caller.ai.analyzeProject({
        projectId: "project-1",
      });

      expect(result).toEqual({
        success: false,
        error: "No tasks found in project",
      });
    });
  });

  describe("applySchedule", () => {
    it("updates tasks with suggested schedule times", async () => {
      // Mock task lookup for Google Calendar check
      prismaMock.task.findUnique.mockResolvedValue(mockTask as any);
      prismaMock.task.update.mockResolvedValue({
        ...mockTask,
        scheduledStart: new Date("2024-02-01T09:00:00Z"),
      } as any);

      const caller = createTestCaller();
      const result = await caller.ai.applySchedule({
        schedule: [
          {
            taskId: "task-1",
            suggestedStart: new Date("2024-02-01T09:00:00Z"),
          },
        ],
        syncToCalendar: false,
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0]!.success).toBe(true);
      expect(prismaMock.task.update).toHaveBeenCalledWith({
        where: { id: "task-1" },
        data: { scheduledStart: expect.any(Date) },
      });
    });

    it("reports errors for individual task updates", async () => {
      prismaMock.task.findUnique.mockResolvedValue(mockTask as any);
      prismaMock.task.update.mockRejectedValue(new Error("Update failed"));

      const caller = createTestCaller();
      const result = await caller.ai.applySchedule({
        schedule: [
          {
            taskId: "task-1",
            suggestedStart: new Date("2024-02-01T09:00:00Z"),
          },
        ],
        syncToCalendar: false,
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0]!.success).toBe(false);
      expect(result.results[0]!.error).toBe("Update failed");
    });
  });
});
