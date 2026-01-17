"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { TaskCard } from "~/components/task-card";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import { getTodaysTasks } from "~/lib/data/mock";

export function TodayTasks() {
  const todaysTasks = getTodaysTasks();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Today&apos;s Tasks</h2>
          <p className="text-sm text-muted-foreground">
            {todaysTasks.length} tasks to focus on
          </p>
        </div>
        <Button variant="ghost" size="sm" asChild className="gap-1">
          <Link href="/tasks">
            View all
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {todaysTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
          <p className="text-muted-foreground">No tasks for today</p>
          <p className="text-sm text-muted-foreground">
            Create a new task or check your backlog
          </p>
        </div>
      ) : (
        <ScrollArea className="h-[400px] pr-4">
          <div className="flex flex-col gap-3">
            {todaysTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
