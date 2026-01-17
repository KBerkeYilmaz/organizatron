"use client";

import { Plus } from "lucide-react";
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
import { cn } from "~/lib/utils";

interface QuickAddProps {
  className?: string;
}

export function QuickAdd({ className }: QuickAddProps) {
  const [open, setOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In real app, this would create the task
    console.log("Creating task:", taskTitle);
    setTaskTitle("");
    setOpen(false);
  };

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
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              Add New Task
            </DialogTitle>
            <DialogDescription>
              Create a new task quickly. You can add more details later.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="What needs to be done?"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              className="text-base"
              autoFocus
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Pro tip: Use #project to assign, @today for due date, !high for
              priority
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!taskTitle.trim()}>
              Add Task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
