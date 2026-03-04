"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  Sparkles,
  Wand2,
} from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { api } from "~/trpc/react";
import type { AIProjectPlan, AITaskAnalysis, AIScheduleSlot } from "~/lib/ai-types";

interface AIProjectPlannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  onScheduleApplied?: () => void;
}

interface ToolAction {
  tool: string;
  result: unknown;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// Helper to format action results for display
function formatActionResult(action: ToolAction): string {
  const result = action.result as Record<string, unknown>;
  if (result.success && result.message) {
    return result.message as string;
  }
  return JSON.stringify(result);
}

interface TaskPlanCardProps {
  task: AITaskAnalysis;
  schedule?: AIScheduleSlot;
  taskTitle: string;
  isSelected: boolean;
  onToggle: () => void;
}

function TaskPlanCard({
  task,
  schedule,
  taskTitle,
  isSelected,
  onToggle,
}: TaskPlanCardProps) {
  return (
    <div
      className={`rounded-lg border p-4 transition-colors cursor-pointer ${
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50"
      }`}
      onClick={onToggle}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-medium text-sm">
            {task.suggestedOrder}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium truncate">{taskTitle}</h4>
            {task.guidance && (
              <p className="text-sm text-muted-foreground line-clamp-1">
                {task.guidance}
              </p>
            )}
          </div>
        </div>
        <Badge variant="secondary" className="shrink-0">
          <Clock className="h-3 w-3 mr-1" />
          {formatMinutes(task.estimatedMinutes)}
        </Badge>
      </div>

      {/* Dependencies */}
      <div className="flex flex-wrap gap-2 mt-3">
        {task.blockedBy && task.blockedBy.length > 0 && (
          <Badge variant="outline" className="text-xs text-orange-600">
            Blocked by: {task.blockedBy.length} task
            {task.blockedBy.length > 1 ? "s" : ""}
          </Badge>
        )}
        {task.enables && task.enables.length > 0 && (
          <Badge variant="outline" className="text-xs text-green-600">
            Enables: {task.enables.length} task
            {task.enables.length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Schedule */}
      {schedule && (
        <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>
            {format(schedule.suggestedStart, "EEE, MMM d")} at{" "}
            {format(schedule.suggestedStart, "h:mm a")}
          </span>
          <ArrowRight className="h-3 w-3" />
          <span>{format(schedule.suggestedEnd, "h:mm a")}</span>
        </div>
      )}
    </div>
  );
}

export function AIProjectPlanner({
  open,
  onOpenChange,
  projectId,
  projectName,
  onScheduleApplied,
}: AIProjectPlannerProps) {
  const [plan, setPlan] = useState<AIProjectPlan | null>(null);
  const [actions, setActions] = useState<ToolAction[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [syncToCalendar, setSyncToCalendar] = useState(true);

  const utils = api.useUtils();

  // Use the agentic endpoint with tool calling
  const analyzeMutation = api.ai.getAgenticProjectPlan.useMutation({
    onSuccess: (result) => {
      if (result.success && result.data) {
        setPlan(result.data.plan);
        setActions(result.data.actions);
        // Select all tasks by default
        if (result.data.plan) {
          setSelectedTasks(new Set(result.data.plan.tasks.map((t) => t.taskId)));
        }
        // If AI took actions, invalidate task list to show updates
        if (result.data.actions.length > 0) {
          void utils.task.getAll.invalidate();
        }
      }
    },
  });

  const applyScheduleMutation = api.ai.applySchedule.useMutation({
    onSuccess: () => {
      onScheduleApplied?.();
      handleReset();
      onOpenChange(false);
    },
  });

  // Fetch tasks to get titles
  const { data: tasks } = api.task.getAll.useQuery(
    { projectId },
    { enabled: open }
  );

  // Build task titles map from fetched tasks
  const taskTitlesMap = tasks
    ? Object.fromEntries(tasks.map((t) => [t.id, t.title]))
    : {};

  const handleAnalyze = () => {
    analyzeMutation.mutate({ projectId });
  };

  const handleToggleTask = (taskId: string) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedTasks(newSelected);
  };

  const handleApplySchedule = () => {
    if (!plan) return;

    const schedule = plan.schedule
      .filter((s) => selectedTasks.has(s.taskId))
      .map((s) => ({
        taskId: s.taskId,
        suggestedStart: s.suggestedStart,
      }));

    applyScheduleMutation.mutate({
      schedule,
      syncToCalendar,
    });
  };

  const handleReset = () => {
    setPlan(null);
    setActions([]);
    setSelectedTasks(new Set());
  };

  const selectedCount = selectedTasks.size;
  const totalTime =
    plan?.tasks
      .filter((t) => selectedTasks.has(t.taskId))
      .reduce((sum, t) => sum + t.estimatedMinutes, 0) ?? 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleReset();
        onOpenChange(isOpen);
      }}
    >
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Project Planner
          </DialogTitle>
          <DialogDescription>
            Analyze tasks in &quot;{projectName}&quot; and let AI optimize the
            execution order with scheduling suggestions.
          </DialogDescription>
        </DialogHeader>

        {!plan ? (
          <div className="py-8 flex flex-col items-center justify-center">
            {analyzeMutation.isPending ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">
                  Analyzing project and taking actions...
                </p>
              </>
            ) : analyzeMutation.error ? (
              <>
                <p className="text-destructive mb-4">
                  {analyzeMutation.error.message}
                </p>
                <Button onClick={handleAnalyze}>Try Again</Button>
              </>
            ) : (
              <>
                <Sparkles className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground mb-6 text-center max-w-md">
                  AI will analyze your tasks to suggest the best execution order
                  based on dependencies, priorities, and deadlines. It may also
                  update estimates, priorities, and create subtasks as needed.
                </p>
                <Button
                  size="lg"
                  onClick={handleAnalyze}
                  disabled={!tasks || tasks.length === 0}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Analyze Project
                </Button>
                {tasks && tasks.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-4">
                    No incomplete tasks found in this project.
                  </p>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col py-4">
            {/* Scrollable content area */}
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4">
                {/* Actions taken by AI */}
                {actions.length > 0 && (
                  <>
                    <Card className="border-purple-200 dark:border-purple-800">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Wand2 className="h-4 w-4 text-purple-500" />
                          Actions Taken
                          <Badge variant="secondary" className="ml-auto">
                            {actions.length} action{actions.length > 1 ? "s" : ""}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="text-xs">
                          AI made the following changes to optimize your project
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {actions.map((action, idx) => (
                            <div
                              key={idx}
                              className="flex items-start gap-2 text-sm rounded-md bg-green-50 dark:bg-green-950/20 p-2"
                            >
                              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <span className="font-medium capitalize">
                                  {action.tool.replace(/([A-Z])/g, " $1").trim()}
                                </span>
                                <p className="text-muted-foreground text-xs mt-0.5">
                                  {formatActionResult(action)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                    <Separator />
                  </>
                )}

                {/* Summary */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Analysis Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{plan.summary}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <Badge variant="secondary">
                        {plan.tasks.length} tasks
                      </Badge>
                      <Badge variant="secondary">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatMinutes(plan.totalEstimatedTime)} total
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Task list */}
                <div className="space-y-3">
                  {plan.tasks
                    .sort((a, b) => a.suggestedOrder - b.suggestedOrder)
                    .map((task) => (
                      <TaskPlanCard
                        key={task.taskId}
                        task={task}
                        schedule={plan.schedule.find(
                          (s) => s.taskId === task.taskId
                        )}
                        taskTitle={taskTitlesMap[task.taskId] ?? "Unknown task"}
                        isSelected={selectedTasks.has(task.taskId)}
                        onToggle={() => handleToggleTask(task.taskId)}
                      />
                    ))}
                </div>
              </div>
            </ScrollArea>

            {/* Footer info - stays fixed at bottom */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t shrink-0">
              <div className="text-sm text-muted-foreground">
                {selectedCount} of {plan.tasks.length} tasks selected
                {selectedCount > 0 && (
                  <span className="ml-2">
                    ({formatMinutes(totalTime)} total)
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="sync-calendar"
                  checked={syncToCalendar}
                  onCheckedChange={setSyncToCalendar}
                />
                <Label htmlFor="sync-calendar" className="text-sm">
                  Sync to Google Calendar
                </Label>
              </div>
            </div>
          </div>
        )}

        {plan && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApplySchedule}
              disabled={selectedCount === 0 || applyScheduleMutation.isPending}
            >
              {applyScheduleMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Apply Schedule
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
