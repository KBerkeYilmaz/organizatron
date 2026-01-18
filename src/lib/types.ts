export type Priority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "todo" | "in_progress" | "completed" | "archived";
export type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "archived";
export type BillingStatus = "pending" | "paid";
export type TimePeriod = "today" | "week" | "month";

export interface Client {
  id: string;
  name: string;
  color: string;
  logo?: string; // URL or emoji for now
  createdAt: Date;
}

export interface Project {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  createdAt: Date;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  estimatedTime?: number; // in seconds
  dueDate?: Date;
  tags: string[];
  createdAt: Date;
  completedAt?: Date;
}

export interface TimeEntry {
  id: string;
  taskId: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // in seconds
  notes?: string;
}

export interface ActiveTimer {
  taskId: string;
  startTime: Date;
  elapsed: number; // in seconds
}

// Aggregated view types
export interface ClientTimeSummary {
  client: Client;
  totalTime: number; // in seconds
  projectCount: number;
  taskCount: number;
}

export interface ProjectTimeSummary {
  project: Project;
  client: Client;
  totalTime: number;
  taskCount: number;
  completedTaskCount: number;
}
