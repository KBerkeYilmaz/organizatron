"use client";

import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { AITagSuggestionsInline } from "~/components/ai-tag-suggestions-inline";
import { AITimeEstimateInline } from "~/components/ai-time-estimate-inline";
import { Button } from "~/components/ui/button";
import { useAITaskAssist } from "~/hooks/use-ai-task-assist";
import { Calendar } from "~/components/ui/calendar";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "TRY", symbol: "₺", name: "Turkish Lira" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
] as const;

type TaskStatus = "todo" | "in_progress" | "completed" | "archived";
type TaskPriority = "low" | "medium" | "high" | "urgent";
type BillingStatus = "pending" | "paid";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  projectId: string;
  estimatedTime: number | null;
  dueDate: Date | null;
  scheduledStart: Date | null;
  tags: string[];
  // Billing
  isBillable: boolean;
  hourlyRate: number | null;
  currency: string;
  billingStatus: BillingStatus;
  project: {
    id: string;
    name: string;
    client: {
      id: string;
      name: string;
      color: string;
    };
  };
}

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  defaultProjectId?: string;
  defaultDueDate?: Date;
  defaultScheduledStart?: Date;
}

export function TaskDialog({
  open,
  onOpenChange,
  task,
  defaultProjectId,
  defaultDueDate,
  defaultScheduledStart,
}: TaskDialogProps) {
  const isEditing = !!task;

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [estimatedTime, setEstimatedTime] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [scheduledStart, setScheduledStart] = useState<Date | undefined>();
  const [tags, setTags] = useState("");
  // Billing state
  const [isBillable, setIsBillable] = useState(false);
  const [hourlyRate, setHourlyRate] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [billingStatus, setBillingStatus] = useState<BillingStatus>("pending");

  const utils = api.useUtils();

  // AI Task Assist hook (only active for new tasks)
  const aiAssist = useAITaskAssist({
    title,
    description,
    projectId,
    enabled: !isEditing && open,
  });

  // Populate form when editing
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setProjectId(task.projectId);
      setStatus(task.status);
      setPriority(task.priority);
      setEstimatedTime(
        task.estimatedTime ? String(Math.floor(task.estimatedTime / 60)) : ""
      );
      setDueDate(task.dueDate ? new Date(task.dueDate) : undefined);
      setScheduledStart(task.scheduledStart ? new Date(task.scheduledStart) : undefined);
      setTags(task.tags.join(", "));
      // Billing
      setIsBillable(task.isBillable);
      setHourlyRate(task.hourlyRate ? String(task.hourlyRate / 100) : "");
      setCurrency(task.currency);
      setBillingStatus(task.billingStatus);
    } else {
      resetForm();
      if (defaultProjectId) {
        setProjectId(defaultProjectId);
      }
      if (defaultDueDate) {
        setDueDate(defaultDueDate);
      }
      if (defaultScheduledStart) {
        setScheduledStart(defaultScheduledStart);
      }
    }
  }, [task, defaultProjectId, defaultDueDate, defaultScheduledStart, open]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setProjectId(defaultProjectId ?? "");
    setStatus("todo");
    setPriority("medium");
    setEstimatedTime("");
    setDueDate(undefined);
    setScheduledStart(undefined);
    setTags("");
    // Billing
    setIsBillable(false);
    setHourlyRate("");
    setCurrency("USD");
    setBillingStatus("pending");
  };

  // Queries
  const { data: projects, isLoading: projectsLoading } =
    api.project.getAll.useQuery();

  // Group projects by client
  const projectsByClient = projects?.reduce(
    (acc, project) => {
      const clientId = project.client.id;
      if (!acc[clientId]) {
        acc[clientId] = {
          client: project.client,
          projects: [],
        };
      }
      acc[clientId]!.projects.push(project);
      return acc;
    },
    {} as Record<
      string,
      {
        client: { id: string; name: string; color: string };
        projects: typeof projects;
      }
    >
  );

  // Mutations
  const createTask = api.task.create.useMutation({
    onSuccess: () => {
      void utils.task.getAll.invalidate();
      onOpenChange(false);
      resetForm();
    },
  });

  const updateTask = api.task.update.useMutation({
    onSuccess: () => {
      void utils.task.getAll.invalidate();
      void utils.task.getById.invalidate();
      onOpenChange(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !projectId) return;

    const parsedTags = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const parsedEstimatedTime = estimatedTime
      ? parseInt(estimatedTime) * 60
      : null;
    // Convert dollars to cents
    const parsedHourlyRate = hourlyRate
      ? Math.round(parseFloat(hourlyRate) * 100)
      : null;

    if (isEditing && task) {
      updateTask.mutate({
        id: task.id,
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        estimatedTime: parsedEstimatedTime,
        dueDate: dueDate ?? null,
        scheduledStart: scheduledStart ?? null,
        tags: parsedTags,
        isBillable,
        hourlyRate: parsedHourlyRate,
        currency,
        billingStatus,
      });
    } else {
      createTask.mutate({
        projectId,
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        priority,
        estimatedTime: parsedEstimatedTime ?? undefined,
        dueDate,
        scheduledStart,
        tags: parsedTags,
        isBillable,
        hourlyRate: parsedHourlyRate ?? undefined,
        currency,
        billingStatus: isBillable ? billingStatus : undefined,
      });
    }
  };

  const isPending = createTask.isPending || updateTask.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit} className="min-w-0">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Task" : "Create Task"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the task details below."
                : "Add a new task to your project."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="What needs to be done?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Add more details..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            {/* Project */}
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projectsLoading ? (
                    <div className="flex items-center justify-center py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : (
                    projectsByClient &&
                    Object.values(projectsByClient).map(
                      ({ client, projects: clientProjects }) => (
                        <div key={client.id}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-2">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: client.color }}
                            />
                            {client.name}
                          </div>
                          {clientProjects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </div>
                      )
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Status & Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as TaskStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={priority}
                  onValueChange={(v) => setPriority(v as TaskPriority)}
                >
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

            {/* Scheduled Start (Date & Time) - shown when set */}
            {scheduledStart && (
              <div className="space-y-2">
                <Label>Scheduled Start</Label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "flex-1 justify-start text-left font-normal",
                          !scheduledStart && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {scheduledStart ? format(scheduledStart, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={scheduledStart}
                        onSelect={(date) => {
                          if (date && scheduledStart) {
                            // Preserve the time when changing date
                            date.setHours(scheduledStart.getHours());
                            date.setMinutes(scheduledStart.getMinutes());
                          }
                          setScheduledStart(date);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                  <Input
                    type="time"
                    className="w-[120px]"
                    value={scheduledStart ? format(scheduledStart, "HH:mm") : ""}
                    onChange={(e) => {
                      if (scheduledStart && e.target.value) {
                        const [hours, minutes] = e.target.value.split(":").map(Number);
                        const newDate = new Date(scheduledStart);
                        newDate.setHours(hours ?? 0);
                        newDate.setMinutes(minutes ?? 0);
                        setScheduledStart(newDate);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setScheduledStart(undefined)}
                    title="Clear scheduled start"
                  >
                    ×
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  When you plan to work on this task
                </p>
              </div>
            )}

            {/* Estimated Time & Due Date */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="estimatedTime">Estimated Time (minutes)</Label>
                <Input
                  id="estimatedTime"
                  type="number"
                  placeholder="e.g. 60"
                  value={estimatedTime}
                  onChange={(e) => {
                    setEstimatedTime(e.target.value);
                    aiAssist.setHasUserSetTime(true);
                  }}
                  min={1}
                />
                {/* AI Time Estimate - only show when creating new task */}
                {!isEditing && aiAssist.isEstimatingTime && !aiAssist.timeEstimate && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Estimating time...</span>
                  </div>
                )}
                {!isEditing && aiAssist.timeEstimate && !aiAssist.hasUserSetTime && (
                  <AITimeEstimateInline
                    estimate={aiAssist.timeEstimate}
                    onAccept={() => {
                      const minutes = aiAssist.acceptTimeEstimate();
                      setEstimatedTime(String(minutes));
                    }}
                    onDismiss={aiAssist.dismissTimeEstimate}
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label>Due Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dueDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={setDueDate}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                placeholder="design, frontend, urgent (comma separated)"
                value={tags}
                onChange={(e) => {
                  setTags(e.target.value);
                  aiAssist.setHasUserEditedTags(true);
                }}
              />
              {/* AI Tag Suggestions - only show when creating new task */}
              {!isEditing && aiAssist.isSuggestingTags && aiAssist.tagSuggestions.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Finding relevant tags...</span>
                </div>
              )}
              {!isEditing && aiAssist.tagSuggestions.length > 0 && !aiAssist.hasUserEditedTags && (
                <AITagSuggestionsInline
                  suggestions={aiAssist.tagSuggestions}
                  reasoning={aiAssist.tagReasoning}
                  onAccept={(tag) => {
                    const currentTags = tags
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean);
                    if (!currentTags.includes(tag)) {
                      setTags([...currentTags, tag].join(", "));
                    }
                    aiAssist.acceptTag(tag);
                  }}
                  onAcceptAll={() => {
                    const currentTags = tags
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean);
                    const newTags = [
                      ...new Set([...currentTags, ...aiAssist.acceptAllTags()]),
                    ];
                    setTags(newTags.join(", "));
                  }}
                  onDismissAll={aiAssist.dismissAllTags}
                />
              )}
            </div>

            {/* Billing Section */}
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="billable">Billable Task</Label>
                  <p className="text-xs text-muted-foreground">
                    Track time for invoicing
                  </p>
                </div>
                <Switch
                  id="billable"
                  checked={isBillable}
                  onCheckedChange={setIsBillable}
                />
              </div>

              {isBillable && (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="hourlyRate">Hourly Rate</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          {CURRENCIES.find((c) => c.code === currency)?.symbol ?? "$"}
                        </span>
                        <Input
                          id="hourlyRate"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={hourlyRate}
                          onChange={(e) => setHourlyRate(e.target.value)}
                          className="pl-7"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Currency</Label>
                      <Select value={currency} onValueChange={setCurrency}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map((curr) => (
                            <SelectItem key={curr.code} value={curr.code}>
                              {curr.symbol} {curr.code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Payment Status</Label>
                    <Select
                      value={billingStatus}
                      onValueChange={(v) => setBillingStatus(v as BillingStatus)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-amber-500" />
                            Pending
                          </span>
                        </SelectItem>
                        <SelectItem value="paid">
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            Paid
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
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
            <Button type="submit" disabled={!title.trim() || !projectId || isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? "Saving..." : "Creating..."}
                </>
              ) : isEditing ? (
                "Save Changes"
              ) : (
                "Create Task"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
