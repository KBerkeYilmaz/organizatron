"use client";

import { FolderKanban, Plus } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "~/components/page-header";
import { ProjectDialog } from "~/components/project-dialog";
import { ProjectsKanban } from "~/components/projects-kanban";
import { TaskDialog } from "~/components/task-dialog";
import type { KanbanTask } from "~/components/task-kanban-card";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { api } from "~/trpc/react";

export default function ProjectsPage() {
  const [clientId, setClientId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<KanbanTask | null>(null);

  // Queries
  const { data: clients, isLoading: clientsLoading } = api.clients.getAll.useQuery();
  const { data: projects, isLoading: projectsLoading } = api.project.getByClientId.useQuery(
    { clientId },
    { enabled: !!clientId }
  );

  const selectedClient = clients?.find((c: { id: string; name: string; color: string }) => c.id === clientId);
  const selectedProject = projects?.find((p) => p.id === projectId);

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
        onOpenChange={setProjectDialogOpen}
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
