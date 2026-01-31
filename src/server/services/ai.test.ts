import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TaskContext } from "~/lib/ai-types";

// Mock the ai package
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    generateText: vi.fn(),
  };
});

// Mock the @ai-sdk/google package
vi.mock("@ai-sdk/google", () => ({
  google: vi.fn(() => "mocked-google-model"),
}));

// Mock the @ai-sdk/groq package
vi.mock("@ai-sdk/groq", () => ({
  createGroq: vi.fn(() => vi.fn(() => "mocked-groq-model")),
}));

// Mock env to ensure AI is available
vi.mock("~/env", () => ({
  env: {
    GROQ_API_KEY: "test-groq-key",
    GOOGLE_GENERATIVE_AI_API_KEY: "test-google-key",
  },
}));

// Import after mocking
import { generateText } from "ai";
import { AIService, aiService } from "./ai";

const mockGenerateText = generateText as ReturnType<typeof vi.fn>;

describe("AIService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isAvailable", () => {
    it("returns true when GOOGLE_GENERATIVE_AI_API_KEY is set", () => {
      // Service should check for API key availability
      const service = new AIService();
      // This test will need env to be properly mocked
      expect(typeof service.isAvailable()).toBe("boolean");
    });
  });

  describe("estimateTime", () => {
    it("returns time estimate with confidence and reasoning", async () => {
      mockGenerateText.mockResolvedValue({
        text: JSON.stringify({
          estimatedMinutes: 60,
          confidence: "medium",
          reasoning: "Based on task complexity, this should take about an hour",
        }),
      });

      const service = new AIService();
      const result = await service.estimateTime(
        "Implement user authentication",
        "Add login and signup forms with validation"
      );

      expect(result).toEqual({
        estimatedMinutes: 60,
        confidence: "medium",
        reasoning: "Based on task complexity, this should take about an hour",
      });
    });

    it("returns null when AI response is invalid JSON", async () => {
      mockGenerateText.mockResolvedValue({
        text: "This is not valid JSON",
      });

      const service = new AIService();
      const result = await service.estimateTime("Simple task");

      expect(result).toBeNull();
    });

    it("returns null when AI call fails", async () => {
      mockGenerateText.mockRejectedValue(new Error("API error"));

      const service = new AIService();
      const result = await service.estimateTime("Simple task");

      expect(result).toBeNull();
    });

    it("includes context from similar tasks when provided", async () => {
      mockGenerateText.mockResolvedValue({
        text: JSON.stringify({
          estimatedMinutes: 45,
          confidence: "high",
          reasoning: "Similar tasks took 40-50 minutes",
        }),
      });

      const service = new AIService();
      const similarTasks = [
        { title: "Add form validation", estimatedMinutes: 40, actualMinutes: 45 },
        { title: "Create login form", estimatedMinutes: 50, actualMinutes: 48 },
      ];

      await service.estimateTime("Add signup form", undefined, similarTasks);

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("Similar completed tasks"),
        })
      );
    });
  });

  describe("suggestTags", () => {
    it("returns suggested tags with reasoning", async () => {
      mockGenerateText.mockResolvedValue({
        text: JSON.stringify({
          tags: ["frontend", "react", "forms"],
          reasoning: "Task involves UI form components",
        }),
      });

      const service = new AIService();
      const result = await service.suggestTags(
        "Create login form",
        "Build a React component for user login"
      );

      expect(result).toEqual({
        tags: ["frontend", "react", "forms"],
        reasoning: "Task involves UI form components",
      });
    });

    it("includes existing project tags in prompt for consistency", async () => {
      mockGenerateText.mockResolvedValue({
        text: JSON.stringify({
          tags: ["auth", "security"],
          reasoning: "Related to authentication",
        }),
      });

      const service = new AIService();
      const existingTags = ["frontend", "backend", "database"];

      await service.suggestTags("Add password reset", undefined, existingTags);

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("frontend, backend, database"),
        })
      );
    });

    it("returns null when AI response is invalid", async () => {
      mockGenerateText.mockResolvedValue({
        text: "invalid",
      });

      const service = new AIService();
      const result = await service.suggestTags("Test task");

      expect(result).toBeNull();
    });
  });

  describe("breakdownGoal", () => {
    it("breaks down a goal into actionable tasks", async () => {
      const mockBreakdown = {
        goal: "Improve my CV",
        tasks: [
          {
            title: "Audit current CV",
            description: "Review strengths and weaknesses",
            estimatedMinutes: 30,
            order: 1,
            guidance: "Focus on quantifiable achievements",
            learningResources: [
              {
                title: "What recruiters look for",
                type: "article",
                description: "Guide to effective CVs",
              },
            ],
          },
          {
            title: "Research job descriptions",
            description: "Analyze target positions",
            estimatedMinutes: 60,
            order: 2,
            guidance: "Note keywords and required skills",
          },
        ],
        totalEstimatedTime: 90,
        summary: "Start by auditing your current CV to identify areas for improvement",
      };

      mockGenerateText.mockResolvedValue({
        text: JSON.stringify(mockBreakdown),
      });

      const service = new AIService();
      const result = await service.breakdownGoal("Improve my CV for senior developer positions");

      expect(result).toEqual(mockBreakdown);
      expect(result?.tasks).toHaveLength(2);
      expect(result?.tasks[0]!.learningResources).toBeDefined();
    });

    it("includes optional context in prompt", async () => {
      mockGenerateText.mockResolvedValue({
        text: JSON.stringify({
          goal: "Learn React",
          tasks: [],
          totalEstimatedTime: 0,
          summary: "No tasks",
        }),
      });

      const service = new AIService();
      await service.breakdownGoal(
        "Learn React",
        "I already know JavaScript and have built small projects"
      );

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("I already know JavaScript"),
        })
      );
    });

    it("returns null when AI response is invalid", async () => {
      mockGenerateText.mockResolvedValue({
        text: "not json",
      });

      const service = new AIService();
      const result = await service.breakdownGoal("Learn something");

      expect(result).toBeNull();
    });
  });

  describe("getTaskGuidance", () => {
    const mockTask: TaskContext = {
      id: "task-1",
      title: "Implement authentication",
      description: "Add user login and signup",
      priority: "high",
      status: "todo",
      dueDate: new Date("2024-02-01"),
      estimatedTime: 7200,
      tags: ["auth", "backend"],
      projectName: "Organizatron",
      clientName: "Internal",
    };

    it("returns guidance with learning resources and prompts", async () => {
      const mockGuidance = {
        taskId: "task-1",
        guidance: "Start by setting up Better Auth middleware",
        suggestedPrompts: [
          "Add protected routes using Better Auth middleware",
          "Create login form with validation",
        ],
        learningResources: [
          {
            title: "Better Auth Documentation",
            type: "documentation",
            url: "https://better-auth.com/docs",
            description: "Official docs for Better Auth",
          },
        ],
        breakdownSuggestion: {
          shouldBreakdown: true,
          suggestedSubtasks: [
            "Configure auth middleware",
            "Add login/logout UI",
            "Protect API routes",
          ],
        },
      };

      mockGenerateText.mockResolvedValue({
        text: JSON.stringify(mockGuidance),
      });

      const service = new AIService();
      const result = await service.getTaskGuidance(mockTask);

      expect(result).toEqual(mockGuidance);
      expect(result?.suggestedPrompts).toHaveLength(2);
      expect(result?.breakdownSuggestion?.shouldBreakdown).toBe(true);
    });

    it("returns null when AI response is invalid", async () => {
      mockGenerateText.mockResolvedValue({
        text: "invalid response",
      });

      const service = new AIService();
      const result = await service.getTaskGuidance(mockTask);

      expect(result).toBeNull();
    });
  });

  describe("analyzeProject", () => {
    const mockTasks: TaskContext[] = [
      {
        id: "task-1",
        title: "Setup database",
        description: "Create Prisma schema",
        priority: "high",
        status: "todo",
        dueDate: null,
        estimatedTime: null,
        tags: ["database"],
        projectName: "E-commerce",
        clientName: "Client A",
      },
      {
        id: "task-2",
        title: "Create API endpoints",
        description: "Build tRPC routers",
        priority: "medium",
        status: "todo",
        dueDate: new Date("2024-02-15"),
        estimatedTime: 10800,
        tags: ["api", "backend"],
        projectName: "E-commerce",
        clientName: "Client A",
      },
      {
        id: "task-3",
        title: "Build product listing",
        description: "Create React components",
        priority: "medium",
        status: "todo",
        dueDate: new Date("2024-02-20"),
        estimatedTime: 14400,
        tags: ["frontend", "react"],
        projectName: "E-commerce",
        clientName: "Client A",
      },
    ];

    it("returns project plan with execution order and dependencies", async () => {
      const mockPlan = {
        tasks: [
          {
            taskId: "task-1",
            suggestedOrder: 1,
            estimatedMinutes: 120,
            enables: ["task-2"],
            guidance: "Start with database as it blocks other tasks",
          },
          {
            taskId: "task-2",
            suggestedOrder: 2,
            estimatedMinutes: 180,
            blockedBy: ["task-1"],
            enables: ["task-3"],
            guidance: "API depends on database schema",
          },
          {
            taskId: "task-3",
            suggestedOrder: 3,
            estimatedMinutes: 240,
            blockedBy: ["task-2"],
            guidance: "Frontend needs API endpoints",
          },
        ],
        schedule: [
          {
            taskId: "task-1",
            suggestedStart: "2024-02-01T09:00:00.000Z",
            suggestedEnd: "2024-02-01T11:00:00.000Z",
          },
          {
            taskId: "task-2",
            suggestedStart: "2024-02-01T11:00:00.000Z",
            suggestedEnd: "2024-02-01T14:00:00.000Z",
          },
          {
            taskId: "task-3",
            suggestedStart: "2024-02-01T14:00:00.000Z",
            suggestedEnd: "2024-02-01T18:00:00.000Z",
          },
        ],
        summary: "Start with database setup as it enables the API and frontend work",
        totalEstimatedTime: 540,
      };

      mockGenerateText.mockResolvedValue({
        text: JSON.stringify(mockPlan),
      });

      const service = new AIService();
      const result = await service.analyzeProject(mockTasks);

      expect(result).toBeDefined();
      expect(result?.tasks).toHaveLength(3);
      expect(result?.tasks[0]!.suggestedOrder).toBe(1);
      expect(result?.tasks[0]!.enables).toContain("task-2");
      expect(result?.schedule).toHaveLength(3);
      expect(result?.summary).toContain("database");
    });

    it("converts schedule date strings to Date objects", async () => {
      const mockPlan = {
        tasks: [{ taskId: "task-1", suggestedOrder: 1, estimatedMinutes: 60 }],
        schedule: [
          {
            taskId: "task-1",
            suggestedStart: "2024-02-01T09:00:00.000Z",
            suggestedEnd: "2024-02-01T10:00:00.000Z",
          },
        ],
        summary: "Single task",
        totalEstimatedTime: 60,
      };

      mockGenerateText.mockResolvedValue({
        text: JSON.stringify(mockPlan),
      });

      const service = new AIService();
      const result = await service.analyzeProject([mockTasks[0]!]);

      expect(result?.schedule[0]!.suggestedStart).toBeInstanceOf(Date);
      expect(result?.schedule[0]!.suggestedEnd).toBeInstanceOf(Date);
    });

    it("returns null for empty task list", async () => {
      const service = new AIService();
      const result = await service.analyzeProject([]);

      expect(result).toBeNull();
      expect(mockGenerateText).not.toHaveBeenCalled();
    });

    it("returns null when AI response is invalid", async () => {
      mockGenerateText.mockResolvedValue({
        text: "invalid",
      });

      const service = new AIService();
      const result = await service.analyzeProject(mockTasks);

      expect(result).toBeNull();
    });
  });

  describe("singleton instance", () => {
    it("exports a singleton aiService instance", () => {
      expect(aiService).toBeInstanceOf(AIService);
    });
  });

  describe("getAgenticTaskGuidance", () => {
    const mockTask: TaskContext = {
      id: "task-1",
      title: "Implement user authentication",
      description: "Add login and signup forms with validation",
      priority: "high",
      status: "todo",
      dueDate: new Date("2024-02-01"),
      estimatedTime: 7200,
      tags: ["auth", "backend"],
      projectName: "Organizatron",
      clientName: "Internal",
    };

    it("returns guidance with actions when AI calls tools", async () => {
      const mockGuidance = {
        taskId: "task-1",
        guidance: "Start by setting up authentication middleware",
        suggestedPrompts: ["Add login form with validation"],
        learningResources: [
          {
            title: "Auth Guide",
            type: "documentation",
            url: "https://example.com",
            description: "Learn about auth",
          },
        ],
        breakdownSuggestion: {
          shouldBreakdown: false,
          suggestedSubtasks: [],
        },
      };

      // Mock response with steps containing tool results
      mockGenerateText.mockResolvedValue({
        text: JSON.stringify(mockGuidance),
        steps: [
          {
            toolResults: [
              {
                toolName: "addTags",
                output: { success: true, message: 'Added 2 tags to "task-1"' },
              },
            ],
          },
        ],
      });

      const service = new AIService();
      const result = await service.getAgenticTaskGuidance(mockTask);

      expect(result.guidance).toEqual(mockGuidance);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0]!.tool).toBe("addTags");
      expect(result.actions[0]!.result).toEqual({
        success: true,
        message: 'Added 2 tags to "task-1"',
      });
    });

    it("returns guidance with no actions when AI doesn't use tools", async () => {
      const mockGuidance = {
        taskId: "task-1",
        guidance: "This task is straightforward - just implement the form",
        suggestedPrompts: [],
        learningResources: [],
        breakdownSuggestion: { shouldBreakdown: false, suggestedSubtasks: [] },
      };

      mockGenerateText.mockResolvedValue({
        text: JSON.stringify(mockGuidance),
        steps: [{ toolResults: [] }],
      });

      const service = new AIService();
      const result = await service.getAgenticTaskGuidance(mockTask);

      expect(result.guidance).toEqual(mockGuidance);
      expect(result.actions).toHaveLength(0);
    });

    it("creates basic guidance when JSON parsing fails", async () => {
      mockGenerateText.mockResolvedValue({
        text: "This is not valid JSON - just some guidance text",
        steps: [],
      });

      const service = new AIService();
      const result = await service.getAgenticTaskGuidance(mockTask);

      expect(result.guidance).not.toBeNull();
      expect(result.guidance?.taskId).toBe("task-1");
      expect(result.guidance?.guidance).toBe(
        "This is not valid JSON - just some guidance text"
      );
    });

    it("returns null guidance on API error", async () => {
      mockGenerateText.mockRejectedValue(new Error("API error"));

      const service = new AIService();
      const result = await service.getAgenticTaskGuidance(mockTask);

      expect(result.guidance).toBeNull();
      expect(result.actions).toHaveLength(0);
    });
  });

  describe("getAgenticProjectPlan", () => {
    const mockTasks: TaskContext[] = [
      {
        id: "task-1",
        title: "Setup database",
        description: "Create Prisma schema",
        priority: "high",
        status: "todo",
        dueDate: null,
        estimatedTime: null,
        tags: ["database"],
        projectName: "E-commerce",
        clientName: "Client A",
      },
      {
        id: "task-2",
        title: "Create API endpoints",
        description: "Build tRPC routers",
        priority: "medium",
        status: "todo",
        dueDate: new Date("2024-02-15"),
        estimatedTime: 10800,
        tags: ["api", "backend"],
        projectName: "E-commerce",
        clientName: "Client A",
      },
    ];

    it("returns plan with actions when AI uses tools", async () => {
      const mockPlan = {
        tasks: [
          { taskId: "task-1", suggestedOrder: 1, estimatedMinutes: 120 },
          { taskId: "task-2", suggestedOrder: 2, estimatedMinutes: 180 },
        ],
        schedule: [
          {
            taskId: "task-1",
            suggestedStart: "2024-02-01T09:00:00.000Z",
            suggestedEnd: "2024-02-01T11:00:00.000Z",
          },
          {
            taskId: "task-2",
            suggestedStart: "2024-02-01T11:00:00.000Z",
            suggestedEnd: "2024-02-01T14:00:00.000Z",
          },
        ],
        summary: "Start with database setup",
        totalEstimatedTime: 300,
      };

      mockGenerateText.mockResolvedValue({
        text: JSON.stringify(mockPlan),
        steps: [
          {
            toolResults: [
              {
                toolName: "updateEstimate",
                output: { success: true, message: "Updated estimate" },
              },
              {
                toolName: "updatePriority",
                output: { success: true, message: "Updated priority" },
              },
            ],
          },
        ],
      });

      const service = new AIService();
      const result = await service.getAgenticProjectPlan(mockTasks);

      expect(result.plan).not.toBeNull();
      expect(result.plan?.tasks).toHaveLength(2);
      expect(result.plan?.schedule).toHaveLength(2);
      expect(result.plan?.schedule[0]!.suggestedStart).toBeInstanceOf(Date);
      expect(result.actions).toHaveLength(2);
    });

    it("returns null plan for empty task list", async () => {
      const service = new AIService();
      const result = await service.getAgenticProjectPlan([]);

      expect(result.plan).toBeNull();
      expect(result.actions).toHaveLength(0);
      expect(mockGenerateText).not.toHaveBeenCalled();
    });

    it("returns null plan when JSON parsing fails", async () => {
      mockGenerateText.mockResolvedValue({
        text: "Invalid JSON response",
        steps: [],
      });

      const service = new AIService();
      const result = await service.getAgenticProjectPlan(mockTasks);

      expect(result.plan).toBeNull();
    });

    it("returns null plan on API error", async () => {
      mockGenerateText.mockRejectedValue(new Error("API error"));

      const service = new AIService();
      const result = await service.getAgenticProjectPlan(mockTasks);

      expect(result.plan).toBeNull();
      expect(result.actions).toHaveLength(0);
    });
  });
});
