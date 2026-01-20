"use client";

import { CheckCircle2, Circle, FolderKanban, Info, ListTodo, Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { PageHeader } from "~/components/page-header";
import { ProjectDialog } from "~/components/project-dialog";
import { ProjectsKanban } from "~/components/projects-kanban";
import { TaskDialog } from "~/components/task-dialog";
import type { KanbanTask } from "~/components/task-kanban-card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";
import type { ProjectStatus } from "~/lib/types";
import { api } from "~/trpc/react";

const PROJECT_STATUS_CONFIG: Record<ProjectStatus, { label: string; className: string }> = {
  planning: { label: "Planning", className: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  active: { label: "Active", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  on_hold: { label: "On Hold", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  completed: { label: "Completed", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  archived: { label: "Archived", className: "bg-zinc-500/10 text-zinc-500" },
};

export default function ProjectsPage() {
  const [clientId, setClientId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<{
    id: string;
    name: string;
    description: string | null;
    status: ProjectStatus;
    clientId: string;
    client: { id: string; name: string; color: string };
  } | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<KanbanTask | null>(null);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  // Queries
  const { data: clients, isLoading: clientsLoading } = api.clients.getAll.useQuery();
  const { data: activeTimer } = api.activeTimer.getCurrent.useQuery();
  const { data: recentlyActiveProject } = api.project.getMostRecentlyActive.useQuery();
  const { data: projects, isLoading: projectsLoading } = api.project.getByClientId.useQuery(
    { clientId },
    { enabled: !!clientId }
  );

  // Auto-select project from active timer or most recently active on mount
  useEffect(() => {
    if (hasAutoSelected || clientsLoading) return;

    // Priority 1: If there's an active timer, use its project
    if (activeTimer?.task?.project) {
      const timerProject = activeTimer.task.project;
      const timerClientId = timerProject.client.id;

      if (clients?.some((c) => c.id === timerClientId)) {
        setClientId(timerClientId);
        setProjectId(timerProject.id);
        setHasAutoSelected(true);
        return;
      }
    }

    // Priority 2: Use the most recently active project (based on time entries/task updates)
    if (recentlyActiveProject?.client) {
      const recentClientId = recentlyActiveProject.client.id;

      if (clients?.some((c) => c.id === recentClientId)) {
        setClientId(recentClientId);
        setProjectId(recentlyActiveProject.id);
        setHasAutoSelected(true);
        return;
      }
    }

    // Fallback: select first client if available
    if (clients && clients.length > 0 && !clientId) {
      const firstClient = clients[0];
      if (firstClient) {
        setClientId(firstClient.id);
        setHasAutoSelected(true);
      }
    }
  }, [activeTimer, recentlyActiveProject, clients, clientsLoading, hasAutoSelected, clientId]);

  // Auto-select first project when client changes and projects load
  useEffect(() => {
    if (projectsLoading || !projects || projects.length === 0) return;

    // If we have an active timer for this client, select that project
    if (activeTimer?.task?.project?.client.id === clientId) {
      const timerProjectId = activeTimer.task.project.id;
      if (projects.some((p) => p.id === timerProjectId)) {
        setProjectId(timerProjectId);
        return;
      }
    }

    // Otherwise select the first project if none selected
    if (!projectId || !projects.some((p) => p.id === projectId)) {
      const firstProject = projects[0];
      if (firstProject) {
        setProjectId(firstProject.id);
      }
    }
  }, [projects, projectsLoading, clientId, activeTimer, projectId]);

  const selectedClient = clients?.find((c: { id: string; name: string; color: string }) => c.id === clientId);
  const selectedProject = projects?.find((p) => p.id === projectId);

  // Calculate task stats for the selected project
  const taskStats = selectedProject?.tasks
    ? {
        total: selectedProject.tasks.length,
        completed: selectedProject.tasks.filter((t) => t.status === "completed").length,
        inProgress: selectedProject.tasks.filter((t) => t.status === "in_progress").length,
        todo: selectedProject.tasks.filter((t) => t.status === "todo").length,
      }
    : null;

  const handleClientChange = (id: string) => {
    setClientId(id);
    setProjectId(""); // Reset project when client changes
  };

  const handleAddTask = () => {
    setEditingTask(null);
    setTaskDialogOpen(true);
  };

  const handleEditTask = (task: KanbanTask) => {
    setEditingTask(task);
    setTaskDialogOpen(true);
  };

  const handleTaskDialogClose = (open: boolean) => {
    setTaskDialogOpen(open);
    if (!open) {
      setEditingTask(null);
    }
  };

  const subtitle = selectedProject
    ? `${selectedProject.name} - ${selectedClient?.name}`
    : "Select a project to view tasks";

  return (
    <>
      <PageHeader title="Projects" subtitle={subtitle} />

      {/* Filters */}
      <div className="flex shrink-0 items-center justify-between gap-4 border-b px-6 py-4">
        <div className="flex items-center gap-4">
        {/* Client dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Client:</span>
          <Select value={clientId} onValueChange={handleClientChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select client" />
            </SelectTrigger>
            <SelectContent>
              {clientsLoading ? (
                <div className="py-2 text-center text-sm text-muted-foreground">
                  Loading...
                </div>
              ) : clients?.length === 0 ? (
                <div className="py-2 text-center text-sm text-muted-foreground">
                  No clients found
                </div>
              ) : (
                clients?.map((client: { id: string; name: string; color: string }) => (
                  <SelectItem key={client.id} value={client.id}>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: client.color }}
                      />
                      {client.name}
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Project dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Project:</span>
          <Select
            value={projectId}
            onValueChange={setProjectId}
            disabled={!clientId}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={clientId ? "Select project" : "Select client first"} />
            </SelectTrigger>
            <SelectContent>
              {projectsLoading ? (
                <div className="py-2 text-center text-sm text-muted-foreground">
                  Loading...
                </div>
              ) : projects?.length === 0 ? (
                <div className="py-2 text-center text-sm text-muted-foreground">
                  No projects found
                </div>
              ) : (
                projects?.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        </div>

        <Button onClick={() => setProjectDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      {/* Project Info Bar - Shows when project is selected */}
      {selectedProject && (
        <div className="flex shrink-0 items-center justify-between gap-4 border-b bg-muted/30 px-6 py-3">
          <div className="flex items-center gap-6">
            {/* Status badge */}
            <Badge
              variant="secondary"
              className={cn("text-xs", PROJECT_STATUS_CONFIG[selectedProject.status as ProjectStatus].className)}
            >
              {PROJECT_STATUS_CONFIG[selectedProject.status as ProjectStatus].label}
            </Badge>

            {/* Task stats */}
            {taskStats && taskStats.total > 0 && (
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <ListTodo className="h-3.5 w-3.5" />
                  <span>{taskStats.total} tasks</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{taskStats.completed} done</span>
                </div>
                {taskStats.inProgress > 0 && (
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    <Circle className="h-3.5 w-3.5" />
                    <span>{taskStats.inProgress} in progress</span>
                  </div>
                )}
              </div>
            )}

            {/* Description toggle */}
            {selectedProject.description && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground"
                onClick={() => setDescriptionExpanded(!descriptionExpanded)}
              >
                <Info className="mr-1 h-3 w-3" />
                {descriptionExpanded ? "Hide" : "Info"}
              </Button>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-7"
            onClick={() => {
              setEditingProject({
                id: selectedProject.id,
                name: selectedProject.name,
                description: selectedProject.description ?? null,
                status: selectedProject.status as ProjectStatus,
                clientId: selectedProject.clientId,
                client: selectedClient!,
              });
              setProjectDialogOpen(true);
            }}
          >
            <Pencil className="mr-1 h-3 w-3" />
            Edit
          </Button>
        </div>
      )}

      {/* Project description (expanded) */}
      {selectedProject?.description && descriptionExpanded && (
        <div className="shrink-0 border-b bg-muted/20 px-6 py-3">
          <p className="text-sm text-muted-foreground">
            {selectedProject.description}
          </p>
        </div>
      )}

      {/* Kanban Board */}
      <main className="flex-1 overflow-y-auto p-6">
        {!clientId ? (
          <EmptyState
            icon={FolderKanban}
            title="Select a Client"
            description="Choose a client from the dropdown to view their projects."
          />
        ) : !projectId ? (
          <EmptyState
            icon={FolderKanban}
            title="Select a Project"
            description="Choose a project to view and manage its tasks."
          />
        ) : (
          <ProjectsKanban
            projectId={projectId}
            onAddTask={handleAddTask}
            onEditTask={handleEditTask}
          />
        )}
      </main>

      {/* Project Dialog */}
      <ProjectDialog
        open={projectDialogOpen}
        onOpenChange={(open) => {
          setProjectDialogOpen(open);
          if (!open) setEditingProject(null);
        }}
        project={editingProject}
        defaultClientId={clientId || undefined}
      />

      {/* Task Dialog */}
      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={handleTaskDialogClose}
        task={editingTask}
        defaultProjectId={projectId || undefined}
      />
    </>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-lg">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-[300px] mt-1">{description}</p>
    </div>
  );
}
