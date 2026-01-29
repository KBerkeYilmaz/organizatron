"use client";

import { useState } from "react";
import { BookOpen, Clock, Loader2, Plus, Sparkles, X } from "lucide-react";

import { Badge } from "~/components/ui/badge";
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
import { ScrollArea } from "~/components/ui/scroll-area";
import { Textarea } from "~/components/ui/textarea";
import { api } from "~/trpc/react";
import type { AIBreakdownTask, AITaskBreakdown } from "~/lib/ai-types";

interface AIGoalBreakdownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onTasksCreated?: () => void;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function TaskCard({
  task,
  isSelected,
  onToggle,
}: {
  task: AIBreakdownTask;
  isSelected: boolean;
  onToggle: () => void;
}) {
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
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              {task.order}.
            </span>
            <h4 className="font-medium truncate">{task.title}</h4>
          </div>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {task.description}
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0">
          <Clock className="h-3 w-3 mr-1" />
          {formatMinutes(task.estimatedMinutes)}
        </Badge>
      </div>

      {task.guidance && (
        <p className="text-sm text-muted-foreground mt-2 italic">
          {task.guidance}
        </p>
      )}

      {task.learningResources && task.learningResources.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {task.learningResources.map((resource, idx) => (
            <Badge key={idx} variant="outline" className="text-xs">
              <BookOpen className="h-3 w-3 mr-1" />
              {resource.title}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function AIGoalBreakdown({
  open,
  onOpenChange,
  projectId,
  onTasksCreated,
}: AIGoalBreakdownProps) {
  const [goal, setGoal] = useState("");
  const [context, setContext] = useState("");
  const [breakdown, setBreakdown] = useState<AITaskBreakdown | null>(null);
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());

  const breakdownMutation = api.ai.breakdownGoal.useMutation({
    onSuccess: (result) => {
      if (result.success && result.data) {
        setBreakdown(result.data);
        // Select all tasks by default
        setSelectedTasks(new Set(result.data.tasks.map((_, i) => i)));
      }
    },
  });

  const createTaskMutation = api.task.create.useMutation();
  const utils = api.useUtils();

  const handleBreakdown = () => {
    if (!goal.trim()) return;
    breakdownMutation.mutate({
      goal: goal.trim(),
      context: context.trim() || undefined,
    });
  };

  const handleToggleTask = (index: number) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedTasks(newSelected);
  };

  const handleAddToProject = async () => {
    if (!breakdown) return;

    const tasksToCreate = breakdown.tasks.filter((_, i) =>
      selectedTasks.has(i)
    );

    for (const task of tasksToCreate) {
      await createTaskMutation.mutateAsync({
        projectId,
        title: task.title,
        description: task.description,
        estimatedTime: task.estimatedMinutes * 60, // Convert to seconds
        tags: [],
      });
    }

    await utils.task.getAll.invalidate();
    onTasksCreated?.();
    handleReset();
    onOpenChange(false);
  };

  const handleReset = () => {
    setGoal("");
    setContext("");
    setBreakdown(null);
    setSelectedTasks(new Set());
  };

  const selectedCount = selectedTasks.size;
  const totalTime = breakdown?.tasks
    .filter((_, i) => selectedTasks.has(i))
    .reduce((sum, t) => sum + t.estimatedMinutes, 0) ?? 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleReset();
        onOpenChange(isOpen);
      }}
    >
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Goal Breakdown
          </DialogTitle>
          <DialogDescription>
            Enter a goal and let AI break it down into actionable tasks with
            time estimates and learning resources.
          </DialogDescription>
        </DialogHeader>

        {!breakdown ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="goal">What do you want to achieve?</Label>
              <Input
                id="goal"
                placeholder="e.g., Improve my CV for senior developer positions"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleBreakdown();
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="context">
                Additional context{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="context"
                placeholder="e.g., I have 3 years of experience with React and Node.js"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 py-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-medium">{breakdown.goal}</h3>
                <p className="text-sm text-muted-foreground">
                  {breakdown.summary}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>

            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-3">
                {breakdown.tasks.map((task, index) => (
                  <TaskCard
                    key={index}
                    task={task}
                    isSelected={selectedTasks.has(index)}
                    onToggle={() => handleToggleTask(index)}
                  />
                ))}
              </div>
            </ScrollArea>

            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {selectedCount} of {breakdown.tasks.length} tasks selected
                {selectedCount > 0 && (
                  <span className="ml-2">
                    ({formatMinutes(totalTime)} total)
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {!breakdown ? (
            <Button
              onClick={handleBreakdown}
              disabled={!goal.trim() || breakdownMutation.isPending}
            >
              {breakdownMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Break it down
                </>
              )}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddToProject}
                disabled={selectedCount === 0 || createTaskMutation.isPending}
              >
                {createTaskMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Add {selectedCount} task{selectedCount !== 1 ? "s" : ""} to
                    project
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
