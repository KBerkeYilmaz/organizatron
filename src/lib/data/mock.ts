import type {
  Client,
  ClientTimeSummary,
  Project,
  ProjectTimeSummary,
  Task,
  TimeEntry,
  TimePeriod,
} from "../types";

// ============================================================================
// CLIENTS
// ============================================================================
export const clients: Client[] = [
  {
    id: "client-1",
    name: "Acme Corp",
    color: "#10b981", // emerald
    logo: "🏢",
    createdAt: new Date("2025-01-01"),
  },
  {
    id: "client-2",
    name: "StartupXYZ",
    color: "#8b5cf6", // violet
    logo: "🚀",
    createdAt: new Date("2025-01-05"),
  },
  {
    id: "client-3",
    name: "Personal",
    color: "#f59e0b", // amber
    logo: "👤",
    createdAt: new Date("2025-01-01"),
  },
];

// ============================================================================
// PROJECTS
// ============================================================================
export const projects: Project[] = [
  {
    id: "proj-1",
    clientId: "client-3", // Personal
    name: "Organizatron",
    description: "AI-powered task organizer",
    createdAt: new Date("2025-01-10"),
  },
  {
    id: "proj-2",
    clientId: "client-3", // Personal
    name: "Portfolio Redesign",
    description: "Personal website update",
    createdAt: new Date("2025-01-12"),
  },
  {
    id: "proj-3",
    clientId: "client-1", // Acme Corp
    name: "E-commerce Platform",
    description: "Main shopping platform development",
    createdAt: new Date("2025-01-05"),
  },
  {
    id: "proj-4",
    clientId: "client-1", // Acme Corp
    name: "Admin Dashboard",
    description: "Internal admin tools",
    createdAt: new Date("2025-01-08"),
  },
  {
    id: "proj-5",
    clientId: "client-2", // StartupXYZ
    name: "Mobile App MVP",
    description: "React Native mobile application",
    createdAt: new Date("2025-01-10"),
  },
];

// ============================================================================
// TASKS
// ============================================================================
export const tasks: Task[] = [
  // Organizatron tasks
  {
    id: "task-1",
    title: "Design dashboard layout",
    description: "Create the main dashboard with task overview and timer",
    projectId: "proj-1",
    status: "in_progress",
    priority: "high",
    estimatedTime: 7200,
    tags: ["design", "ui"],
    createdAt: new Date("2025-01-15"),
  },
  {
    id: "task-2",
    title: "Implement timer component",
    description: "Build the active timer with start/stop/pause functionality",
    projectId: "proj-1",
    status: "todo",
    priority: "high",
    estimatedTime: 5400,
    dueDate: new Date("2025-01-20"),
    tags: ["feature", "ui"],
    createdAt: new Date("2025-01-15"),
  },
  {
    id: "task-3",
    title: "Set up Supabase integration",
    projectId: "proj-1",
    status: "todo",
    priority: "medium",
    estimatedTime: 3600,
    tags: ["backend"],
    createdAt: new Date("2025-01-14"),
  },
  // Portfolio tasks
  {
    id: "task-4",
    title: "Update hero section",
    projectId: "proj-2",
    status: "in_progress",
    priority: "medium",
    estimatedTime: 3600,
    tags: ["design"],
    createdAt: new Date("2025-01-16"),
  },
  // Acme Corp tasks
  {
    id: "task-5",
    title: "Product listing page",
    description: "Build the main product grid with filters",
    projectId: "proj-3",
    status: "in_progress",
    priority: "urgent",
    estimatedTime: 14400,
    dueDate: new Date("2025-01-18"),
    tags: ["feature", "frontend"],
    createdAt: new Date("2025-01-10"),
  },
  {
    id: "task-6",
    title: "Shopping cart API",
    projectId: "proj-3",
    status: "todo",
    priority: "high",
    estimatedTime: 10800,
    dueDate: new Date("2025-01-22"),
    tags: ["backend", "api"],
    createdAt: new Date("2025-01-12"),
  },
  {
    id: "task-7",
    title: "User management module",
    projectId: "proj-4",
    status: "in_progress",
    priority: "high",
    estimatedTime: 7200,
    tags: ["feature"],
    createdAt: new Date("2025-01-14"),
  },
  // StartupXYZ tasks
  {
    id: "task-8",
    title: "Setup React Native project",
    projectId: "proj-5",
    status: "completed",
    priority: "high",
    tags: ["setup"],
    createdAt: new Date("2025-01-10"),
    completedAt: new Date("2025-01-11"),
  },
  {
    id: "task-9",
    title: "Authentication flow",
    projectId: "proj-5",
    status: "in_progress",
    priority: "high",
    estimatedTime: 10800,
    tags: ["feature", "auth"],
    createdAt: new Date("2025-01-12"),
  },
];

// ============================================================================
// TIME ENTRIES - Realistic data for the past week
// ============================================================================
const today = new Date();
const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

function daysAgo(days: number, hour: number, minute = 0): Date {
  const date = new Date(startOfToday);
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date;
}

export const timeEntries: TimeEntry[] = [
  // Today
  {
    id: "entry-1",
    taskId: "task-1", // Organizatron - Dashboard
    startTime: daysAgo(0, 9, 0),
    endTime: daysAgo(0, 11, 30),
    duration: 9000, // 2.5h
    notes: "Layout structure and components",
  },
  {
    id: "entry-2",
    taskId: "task-5", // Acme - Product listing
    startTime: daysAgo(0, 13, 0),
    endTime: daysAgo(0, 16, 0),
    duration: 10800, // 3h
    notes: "Product grid implementation",
  },
  {
    id: "entry-3",
    taskId: "task-9", // StartupXYZ - Auth
    startTime: daysAgo(0, 16, 30),
    endTime: daysAgo(0, 18, 0),
    duration: 5400, // 1.5h
  },
  // Yesterday
  {
    id: "entry-4",
    taskId: "task-7", // Acme - Admin
    startTime: daysAgo(1, 9, 0),
    endTime: daysAgo(1, 12, 0),
    duration: 10800, // 3h
  },
  {
    id: "entry-5",
    taskId: "task-5", // Acme - Product listing
    startTime: daysAgo(1, 13, 0),
    endTime: daysAgo(1, 17, 0),
    duration: 14400, // 4h
  },
  {
    id: "entry-6",
    taskId: "task-4", // Portfolio - Hero
    startTime: daysAgo(1, 19, 0),
    endTime: daysAgo(1, 20, 0),
    duration: 3600, // 1h
  },
  // 2 days ago
  {
    id: "entry-7",
    taskId: "task-9", // StartupXYZ - Auth
    startTime: daysAgo(2, 9, 0),
    endTime: daysAgo(2, 14, 0),
    duration: 18000, // 5h
  },
  {
    id: "entry-8",
    taskId: "task-1", // Organizatron - Dashboard
    startTime: daysAgo(2, 15, 0),
    endTime: daysAgo(2, 17, 0),
    duration: 7200, // 2h
  },
  // 3 days ago
  {
    id: "entry-9",
    taskId: "task-5", // Acme - Product listing
    startTime: daysAgo(3, 9, 0),
    endTime: daysAgo(3, 13, 0),
    duration: 14400, // 4h
  },
  {
    id: "entry-10",
    taskId: "task-7", // Acme - Admin
    startTime: daysAgo(3, 14, 0),
    endTime: daysAgo(3, 18, 0),
    duration: 14400, // 4h
  },
  // 4 days ago
  {
    id: "entry-11",
    taskId: "task-9", // StartupXYZ - Auth
    startTime: daysAgo(4, 9, 0),
    endTime: daysAgo(4, 12, 0),
    duration: 10800, // 3h
  },
  {
    id: "entry-12",
    taskId: "task-5", // Acme - Product listing
    startTime: daysAgo(4, 13, 0),
    endTime: daysAgo(4, 17, 0),
    duration: 14400, // 4h
  },
  // 5 days ago
  {
    id: "entry-13",
    taskId: "task-7", // Acme - Admin
    startTime: daysAgo(5, 9, 0),
    endTime: daysAgo(5, 15, 0),
    duration: 21600, // 6h
  },
  {
    id: "entry-14",
    taskId: "task-8", // StartupXYZ - Setup (completed)
    startTime: daysAgo(5, 16, 0),
    endTime: daysAgo(5, 18, 0),
    duration: 7200, // 2h
  },
  // 6 days ago
  {
    id: "entry-15",
    taskId: "task-5", // Acme - Product listing
    startTime: daysAgo(6, 9, 0),
    endTime: daysAgo(6, 14, 0),
    duration: 18000, // 5h
  },
  {
    id: "entry-16",
    taskId: "task-9", // StartupXYZ - Auth
    startTime: daysAgo(6, 15, 0),
    endTime: daysAgo(6, 18, 0),
    duration: 10800, // 3h
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getClient(clientId: string): Client | undefined {
  return clients.find((c) => c.id === clientId);
}

export function getProject(projectId: string): Project | undefined {
  return projects.find((p) => p.id === projectId);
}

export function getTask(taskId: string): Task | undefined {
  return tasks.find((t) => t.id === taskId);
}

export function getClientForProject(projectId: string): Client | undefined {
  const project = getProject(projectId);
  if (!project) return undefined;
  return getClient(project.clientId);
}

export function getProjectsForClient(clientId: string): Project[] {
  return projects.filter((p) => p.clientId === clientId);
}

export function getTasksForProject(projectId: string): Task[] {
  return tasks.filter((t) => t.projectId === projectId);
}

// Get time entries within a date range
export function getTimeEntriesInRange(start: Date, end: Date): TimeEntry[] {
  return timeEntries.filter((entry) => {
    const entryDate = new Date(entry.startTime);
    return entryDate >= start && entryDate < end;
  });
}

// Get date range for a period
export function getDateRange(period: TimePeriod): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  if (period === "today") {
    return { start, end };
  }

  if (period === "week") {
    const dayOfWeek = start.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday = 0
    start.setDate(start.getDate() - diff);
    end.setDate(start.getDate() + 7);
    return { start, end };
  }

  if (period === "month") {
    start.setDate(1);
    end.setMonth(end.getMonth() + 1);
    end.setDate(1);
    return { start, end };
  }

  return { start, end };
}

// Get client time summaries for a period
export function getClientTimeSummaries(period: TimePeriod): ClientTimeSummary[] {
  const { start, end } = getDateRange(period);
  const entries = getTimeEntriesInRange(start, end);

  const clientTimes = new Map<string, { time: number; projects: Set<string>; tasks: Set<string> }>();

  for (const entry of entries) {
    const task = getTask(entry.taskId);
    if (!task) continue;

    const project = getProject(task.projectId);
    if (!project) continue;

    const clientId = project.clientId;
    const existing = clientTimes.get(clientId) ?? {
      time: 0,
      projects: new Set<string>(),
      tasks: new Set<string>(),
    };

    existing.time += entry.duration;
    existing.projects.add(project.id);
    existing.tasks.add(task.id);
    clientTimes.set(clientId, existing);
  }

  const summaries: ClientTimeSummary[] = [];
  for (const [clientId, data] of clientTimes) {
    const client = getClient(clientId);
    if (!client) continue;

    summaries.push({
      client,
      totalTime: data.time,
      projectCount: data.projects.size,
      taskCount: data.tasks.size,
    });
  }

  return summaries.sort((a, b) => b.totalTime - a.totalTime);
}

// Get project time summaries for a client in a period
export function getProjectTimeSummaries(
  clientId: string,
  period: TimePeriod
): ProjectTimeSummary[] {
  const { start, end } = getDateRange(period);
  const entries = getTimeEntriesInRange(start, end);
  const clientProjects = getProjectsForClient(clientId);
  const client = getClient(clientId);

  if (!client) return [];

  const projectTimes = new Map<string, { time: number; tasks: Set<string>; completedTasks: Set<string> }>();

  for (const entry of entries) {
    const task = getTask(entry.taskId);
    if (!task) continue;

    const project = getProject(task.projectId);
    if (!project || project.clientId !== clientId) continue;

    const existing = projectTimes.get(project.id) ?? {
      time: 0,
      tasks: new Set<string>(),
      completedTasks: new Set<string>(),
    };

    existing.time += entry.duration;
    existing.tasks.add(task.id);
    if (task.status === "completed") {
      existing.completedTasks.add(task.id);
    }
    projectTimes.set(project.id, existing);
  }

  const summaries: ProjectTimeSummary[] = [];
  for (const project of clientProjects) {
    const data = projectTimes.get(project.id);
    if (!data) continue;

    summaries.push({
      project,
      client,
      totalTime: data.time,
      taskCount: data.tasks.size,
      completedTaskCount: data.completedTasks.size,
    });
  }

  return summaries.sort((a, b) => b.totalTime - a.totalTime);
}

// Get today's tasks (in progress or due today)
export function getTodaysTasks(): Task[] {
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const tomorrow = new Date(todayDate);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return tasks.filter((task) => {
    if (task.status === "completed" || task.status === "archived") return false;
    if (task.status === "in_progress") return true;
    if (task.dueDate) {
      const due = new Date(task.dueDate);
      due.setHours(0, 0, 0, 0);
      return due >= todayDate && due < tomorrow;
    }
    return false;
  });
}

// Get total time for a period
export function getTotalTimeForPeriod(period: TimePeriod): number {
  const { start, end } = getDateRange(period);
  const entries = getTimeEntriesInRange(start, end);
  return entries.reduce((sum, entry) => sum + entry.duration, 0);
}
