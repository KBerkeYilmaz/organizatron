/**
 * AI Types for Organizatron
 *
 * These types define the structure of AI responses for task management,
 * goal breakdown, and intelligent scheduling features.
 */

/** Learning resource suggested by AI */
export interface AILearningResource {
  title: string;
  type: "article" | "video" | "course" | "documentation";
  url?: string;
  description: string;
}

/** Time estimation result from AI */
export interface AITimeEstimate {
  estimatedMinutes: number;
  confidence: "low" | "medium" | "high";
  reasoning: string;
}

/** Tag suggestion result from AI */
export interface AITagSuggestion {
  tags: string[];
  reasoning: string;
}

/** Combined task creation assist result (single API call for rate limiting) */
export interface AITaskAssist {
  timeEstimate: AITimeEstimate;
  tagSuggestion: AITagSuggestion;
}

/** Single task in a goal breakdown */
export interface AIBreakdownTask {
  title: string;
  description: string;
  estimatedMinutes: number;
  order: number;
  learningResources?: AILearningResource[];
  guidance?: string;
}

/** Result of breaking down a goal into tasks */
export interface AITaskBreakdown {
  goal: string;
  tasks: AIBreakdownTask[];
  totalEstimatedTime: number;
  summary: string;
}

/** Task analysis in a project plan */
export interface AITaskAnalysis {
  taskId: string;
  suggestedOrder: number;
  estimatedMinutes: number;
  blockedBy?: string[];
  enables?: string[];
  guidance?: string;
}

/** Scheduled time slot for a task */
export interface AIScheduleSlot {
  taskId: string;
  suggestedStart: Date;
  suggestedEnd: Date;
}

/** Result of analyzing a project and suggesting execution order */
export interface AIProjectPlan {
  tasks: AITaskAnalysis[];
  schedule: AIScheduleSlot[];
  summary: string;
  totalEstimatedTime: number;
}

/** Suggestion to break down a large task */
export interface AIBreakdownSuggestion {
  shouldBreakdown: boolean;
  suggestedSubtasks?: string[];
}

/** Guidance for completing a specific task */
export interface AITaskGuidance {
  taskId: string;
  guidance: string;
  suggestedPrompts?: string[];
  learningResources?: AILearningResource[];
  breakdownSuggestion?: AIBreakdownSuggestion;
}

/** Context about a task for AI processing */
export interface TaskContext {
  id: string;
  title: string;
  description?: string | null;
  priority: string;
  status: string;
  dueDate?: Date | null;
  estimatedTime?: number | null;
  tags: string[];
  projectName: string;
  clientName: string;
}
