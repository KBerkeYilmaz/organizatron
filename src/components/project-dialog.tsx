"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Textarea } from "~/components/ui/textarea";
import type { ProjectStatus } from "~/lib/types";
import { api } from "~/trpc/react";

const PROJECT_STATUSES: { value: ProjectStatus; label: string; color: string }[] = [
  { value: "planning", label: "Planning", color: "bg-violet-500" },
  { value: "active", label: "Active", color: "bg-emerald-500" },
  { value: "on_hold", label: "On Hold", color: "bg-amber-500" },
  { value: "completed", label: "Completed", color: "bg-blue-500" },
  { value: "archived", label: "Archived", color: "bg-zinc-400" },
];

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  clientId: string;
  client: {
    id: string;
    name: string;
    color: string;
  };
}

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project | null;
  defaultClientId?: string;
}

export function ProjectDialog({
  open,
  onOpenChange,
  project,
  defaultClientId,
}: ProjectDialogProps) {
  const isEditing = !!project;

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("active");

  const utils = api.useUtils();

  // Populate form when editing
  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description ?? "");
      setClientId(project.clientId);
      setStatus(project.status);
    } else {
      resetForm();
      if (defaultClientId) {
        setClientId(defaultClientId);
      }
    }
  }, [project, defaultClientId, open]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setClientId(defaultClientId ?? "");
    setStatus("active");
  };

  // Queries
  const { data: clients, isLoading: clientsLoading } = api.clients.getAll.useQuery();

  // Mutations
  const createProject = api.project.create.useMutation({
    onSuccess: () => {
      void utils.project.getAll.invalidate();
      void utils.project.getByClientId.invalidate();
      onOpenChange(false);
      resetForm();
    },
  });

  const updateProject = api.project.update.useMutation({
    onSuccess: () => {
      void utils.project.getAll.invalidate();
      void utils.project.getByClientId.invalidate();
      void utils.project.getById.invalidate();
      onOpenChange(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !clientId) return;

    if (isEditing && project) {
      updateProject.mutate({
        id: project.id,
        name: name.trim(),
        description: description.trim() || null,
        status,
      });
    } else {
      createProject.mutate({
        clientId,
        name: name.trim(),
        description: description.trim() || undefined,
        status,
      });
    }
  };

  const isPending = createProject.isPending || updateProject.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Project" : "Create Project"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the project details below."
                : "Add a new project for a client."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                placeholder="e.g. Website Redesign"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief project description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            {/* Client */}
            <div className="space-y-2">
              <Label>Client</Label>
              <Select
                value={clientId}
                onValueChange={setClientId}
                disabled={isEditing}
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

            {/* Status */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${s.color}`} />
                        {s.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || !clientId || isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? "Saving..." : "Creating..."}
                </>
              ) : isEditing ? (
                "Save Changes"
              ) : (
                "Create Project"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
