"use client";

import { X } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { api } from "~/trpc/react";

export interface TimeEntryFiltersState {
  clientId: string | null;
  projectId: string | null;
  taskId: string | null;
}

interface TimeEntryFiltersProps {
  filters: TimeEntryFiltersState;
  onFiltersChange: (filters: TimeEntryFiltersState) => void;
}

export function TimeEntryFilters({ filters, onFiltersChange }: TimeEntryFiltersProps) {
  const { data: clients } = api.clients.getAll.useQuery();
  const { data: projects } = api.project.getAll.useQuery();
  const { data: tasks } = api.task.getAll.useQuery();

  // Filter projects by selected client
  const filteredProjects = filters.clientId
    ? projects?.filter((p) => p.client.id === filters.clientId)
    : projects;

  // Filter tasks by selected project (and client)
  const filteredTasks = filters.projectId
    ? tasks?.filter((t) => t.project.id === filters.projectId)
    : filters.clientId
      ? tasks?.filter((t) => t.project.client.id === filters.clientId)
      : tasks;

  const updateFilter = <K extends keyof TimeEntryFiltersState>(
    key: K,
    value: TimeEntryFiltersState[K]
  ) => {
    const newFilters = { ...filters, [key]: value };

    // Reset dependent filters when parent changes
    if (key === "clientId" && value !== filters.clientId) {
      newFilters.projectId = null;
      newFilters.taskId = null;
    }
    if (key === "projectId" && value !== filters.projectId) {
      newFilters.taskId = null;
    }

    onFiltersChange(newFilters);
  };

  const clearFilters = () => {
    onFiltersChange({
      clientId: null,
      projectId: null,
      taskId: null,
    });
  };

  const hasActiveFilters = filters.clientId || filters.projectId || filters.taskId;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Client */}
      <div className="flex items-center gap-1.5">
        <Select
          value={filters.clientId ?? "all"}
          onValueChange={(v) => updateFilter("clientId", v === "all" ? null : v)}
        >
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="All Clients" />
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
        {filters.clientId && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => updateFilter("clientId", null)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Project */}
      <div className="flex items-center gap-1.5">
        <Select
          value={filters.projectId ?? "all"}
          onValueChange={(v) => updateFilter("projectId", v === "all" ? null : v)}
        >
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="All Projects" />
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
        {filters.projectId && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => updateFilter("projectId", null)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Task */}
      <div className="flex items-center gap-1.5">
        <Select
          value={filters.taskId ?? "all"}
          onValueChange={(v) => updateFilter("taskId", v === "all" ? null : v)}
        >
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="All Tasks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tasks</SelectItem>
            {filteredTasks?.map((task) => (
              <SelectItem key={task.id} value={task.id}>
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: task.project.client.color }}
                  />
                  <span className="truncate max-w-[140px]">{task.title}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filters.taskId && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => updateFilter("taskId", null)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Clear all filters */}
      {hasActiveFilters && (
        <Button
          variant="outline"
          size="sm"
          onClick={clearFilters}
          className="h-9 gap-1.5"
        >
          <X className="h-3.5 w-3.5" />
          Clear All
        </Button>
      )}
    </div>
  );
}
