"use client";

import { Search, X } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { api } from "~/trpc/react";

type TaskStatus = "todo" | "in_progress" | "completed" | "archived";
type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface TaskFiltersState {
  search: string;
  status: TaskStatus | "all";
  priority: TaskPriority | "all";
  clientId: string;
  projectId: string;
}

interface TaskFiltersProps {
  filters: TaskFiltersState;
  onFiltersChange: (filters: TaskFiltersState) => void;
}

const STATUS_OPTIONS: { value: TaskStatus | "all"; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

const PRIORITY_OPTIONS: { value: TaskPriority | "all"; label: string }[] = [
  { value: "all", label: "All Priorities" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export function TaskFilters({ filters, onFiltersChange }: TaskFiltersProps) {
  const { data: clients } = api.clients.getAll.useQuery();
  const { data: projects } = api.project.getAll.useQuery();

  // Filter projects by selected client
  const filteredProjects = filters.clientId
    ? projects?.filter((p) => p.client.id === filters.clientId)
    : projects;

  const updateFilter = <K extends keyof TaskFiltersState>(
    key: K,
    value: TaskFiltersState[K]
  ) => {
    const newFilters = { ...filters, [key]: value };

    // Reset projectId when clientId changes
    if (key === "clientId" && value !== filters.clientId) {
      newFilters.projectId = "";
    }

    onFiltersChange(newFilters);
  };

  const clearFilters = () => {
    onFiltersChange({
      search: "",
      status: "all",
      priority: "all",
      clientId: "",
      projectId: "",
    });
  };

  const hasActiveFilters =
    filters.search ||
    filters.status !== "all" ||
    filters.priority !== "all" ||
    filters.clientId ||
    filters.projectId;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search tasks..."
          value={filters.search}
          onChange={(e) => updateFilter("search", e.target.value)}
          className="w-[200px] pl-9"
        />
      </div>

      {/* Status */}
      <Select
        value={filters.status}
        onValueChange={(v) => updateFilter("status", v as TaskStatus | "all")}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Priority */}
      <Select
        value={filters.priority}
        onValueChange={(v) => updateFilter("priority", v as TaskPriority | "all")}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          {PRIORITY_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Client */}
      <Select
        value={filters.clientId || "all"}
        onValueChange={(v) => updateFilter("clientId", v === "all" ? "" : v)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Client" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Clients</SelectItem>
          {clients?.map((client) => (
            <SelectItem key={client.id} value={client.id}>
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: client.color }}
                />
                {client.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Project */}
      <Select
        value={filters.projectId || "all"}
        onValueChange={(v) => updateFilter("projectId", v === "all" ? "" : v)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Project" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Projects</SelectItem>
          {filteredProjects?.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: project.client.color }}
                />
                {project.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="h-9 px-2 text-muted-foreground"
        >
          <X className="mr-1 h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  );
}
