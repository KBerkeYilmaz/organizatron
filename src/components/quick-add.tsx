"use client";

import { Loader2, Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

interface QuickAddProps {
  className?: string;
}

type AddMode = "task" | "project" | "client";

export function QuickAdd({ className }: QuickAddProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AddMode>("task");

  // Task form state
  const [taskTitle, setTaskTitle] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("in_progress");
  const [selectedPriority, setSelectedPriority] = useState<string>("medium");
  const [startTimerAfter, setStartTimerAfter] = useState(false);

  // Project form state
  const [projectName, setProjectName] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");

  // Client form state
  const [clientName, setClientName] = useState("");
  const [clientColor, setClientColor] = useState("#6366f1");

  const utils = api.useUtils();

  // Queries
  const { data: projects, isLoading: projectsLoading } =
    api.project.getAll.useQuery();
  const { data: clients, isLoading: clientsLoading } =
    api.clients.getAll.useQuery();

  // Mutations
  const createTask = api.task.create.useMutation({
    onSuccess: async (task) => {
      void utils.task.getAll.invalidate();
      if (startTimerAfter && task.status === "in_progress") {
        startTimer.mutate({ taskId: task.id });
      }
      resetAndClose();
    },
  });

  const createProject = api.project.create.useMutation({
    onSuccess: (project) => {
      void utils.project.getAll.invalidate();
      // Switch to task mode with the new project selected
      setSelectedProjectId(project.id);
      setMode("task");
      setProjectName("");
      setSelectedClientId("");
    },
  });

  const createClient = api.clients.create.useMutation({
    onSuccess: (client) => {
      void utils.clients.getAll.invalidate();
      // Switch to project mode with the new client selected
      setSelectedClientId(client.id);
      setMode("project");
      setClientName("");
      setClientColor("#6366f1");
    },
  });

  const startTimer = api.activeTimer.start.useMutation({
    onSuccess: () => {
      void utils.activeTimer.getCurrent.invalidate();
    },
  });

  const resetAndClose = () => {
    setTaskTitle("");
    setSelectedProjectId("");
    setSelectedStatus("in_progress");
    setSelectedPriority("medium");
    setStartTimerAfter(false);
    setProjectName("");
    setSelectedClientId("");
    setClientName("");
    setClientColor("#6366f1");
    setMode("task");
    setOpen(false);
  };

  const handleSubmitTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !selectedProjectId) return;

    createTask.mutate({
      projectId: selectedProjectId,
      title: taskTitle.trim(),
      status: selectedStatus as "todo" | "in_progress" | "completed" | "archived",
      priority: selectedPriority as "low" | "medium" | "high" | "urgent",
    });
  };

  const handleSubmitProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !selectedClientId) return;

    createProject.mutate({
      clientId: selectedClientId,
      name: projectName.trim(),
    });
  };

  const handleSubmitClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return;

    createClient.mutate({
      name: clientName.trim(),
      color: clientColor,
    });
  };

  const isPending =
    createTask.isPending || createProject.isPending || createClient.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className={cn(
            "gap-2 shadow-lg transition-all hover:scale-105 hover:shadow-xl",
            className
          )}
        >
          <Plus className="h-4 w-4" />
          Quick Add
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {/* Mode tabs */}
        <div className="flex gap-1 border-b pb-2">
          <Button
            type="button"
            variant={mode === "task" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setMode("task")}
            className="h-8"
          >
            Task
          </Button>
          <Button
            type="button"
            variant={mode === "project" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setMode("project")}
            className="h-8"
          >
            Project
          </Button>
          <Button
            type="button"
            variant={mode === "client" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setMode("client")}
            className="h-8"
          >
            Client
          </Button>
        </div>

        {/* Task Form */}
        {mode === "task" && (
          <form onSubmit={handleSubmitTask}>
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">
                Add New Task
              </DialogTitle>
              <DialogDescription>
                Create a task and optionally start the timer immediately.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="task-title">Task</Label>
                <Input
                  id="task-title"
                  placeholder="What needs to be done?"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="text-base"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label>Project</Label>
                {projects?.length === 0 ? (
                  <div className="rounded-md border border-dashed p-3 text-center">
                    <p className="text-sm text-muted-foreground mb-2">
                      No projects yet
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setMode("project")}
                    >
                      Create a project first
                    </Button>
                  </div>
                ) : (
                  <Select
                    value={selectedProjectId}
                    onValueChange={setSelectedProjectId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projectsLoading ? (
                        <div className="flex items-center justify-center py-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : (
                        projects?.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            <div className="flex items-center gap-2">
                              {project.client && (
                                <span
                                  className="inline-block h-2 w-2 rounded-full"
                                  style={{ backgroundColor: project.client.color }}
                                />
                              )}
                              <span>
                                {project.client?.name} · {project.name}
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">To Do</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedStatus === "in_progress" && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={startTimerAfter}
                    onChange={(e) => setStartTimerAfter(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm">Start timer immediately</span>
                </label>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetAndClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  !taskTitle.trim() || !selectedProjectId || isPending
                }
              >
                {createTask.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Task"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}

        {/* Project Form */}
        {mode === "project" && (
          <form onSubmit={handleSubmitProject}>
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">
                Add New Project
              </DialogTitle>
              <DialogDescription>
                Create a project under a client.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="project-name">Project Name</Label>
                <Input
                  id="project-name"
                  placeholder="e.g. Website Redesign"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="text-base"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label>Client</Label>
                {clients?.length === 0 ? (
                  <div className="rounded-md border border-dashed p-3 text-center">
                    <p className="text-sm text-muted-foreground mb-2">
                      No clients yet
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setMode("client")}
                    >
                      Create a client first
                    </Button>
                  </div>
                ) : (
                  <Select
                    value={selectedClientId}
                    onValueChange={setSelectedClientId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientsLoading ? (
                        <div className="flex items-center justify-center py-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : (
                        clients?.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-block h-2 w-2 rounded-full"
                                style={{ backgroundColor: client.color }}
                              />
                              <span>{client.name}</span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetAndClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!projectName.trim() || !selectedClientId || isPending}
              >
                {createProject.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Project"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}

        {/* Client Form */}
        {mode === "client" && (
          <form onSubmit={handleSubmitClient}>
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">
                Add New Client
              </DialogTitle>
              <DialogDescription>
                Create a client to organize your projects.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="client-name">Client Name</Label>
                <Input
                  id="client-name"
                  placeholder="e.g. Acme Corp"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="text-base"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="client-color">Color</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    id="client-color"
                    value={clientColor}
                    onChange={(e) => setClientColor(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded border p-1"
                  />
                  <Input
                    value={clientColor}
                    onChange={(e) => setClientColor(e.target.value)}
                    className="flex-1 font-mono"
                    placeholder="#6366f1"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetAndClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!clientName.trim() || isPending}
              >
                {createClient.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Client"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
