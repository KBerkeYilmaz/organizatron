"use client";

import { Pause, Play } from "lucide-react";
import type { VariantProps } from "class-variance-authority";

import { Button, buttonVariants } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useTimer } from "~/hooks/use-timer";
import { cn } from "~/lib/utils";
import type { TimerTask } from "~/store/timer-atoms";

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

interface TaskTimerButtonProps extends Omit<ButtonProps, "onClick"> {
  task: TimerTask;
  showTooltip?: boolean;
  iconSize?: "sm" | "md" | "lg";
}

/**
 * A reusable button component that handles timer start/pause/switch logic.
 *
 * - If no timer is active → Shows play button, starts timer on click
 * - If a different task's timer is active → Shows play button, switches to this task on click
 * - If this task's timer is running → Shows pause button, pauses on click
 * - If this task's timer is paused → Shows play button, resumes on click
 */
export function TaskTimerButton({
  task,
  showTooltip = true,
  iconSize = "sm",
  className,
  variant = "ghost",
  size = "icon",
  ...props
}: TaskTimerButtonProps) {
  const { switchTask, pause, resume, timerState, isActive, isRunning, isPaused } = useTimer();

  const isThisTask = timerState.task?.id === task.id;
  const isThisTaskRunning = isThisTask && isRunning;
  const isThisTaskPaused = isThisTask && isPaused;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isThisTaskRunning) {
      // This task is running → pause it
      pause();
    } else if (isThisTaskPaused) {
      // This task is paused → resume it
      resume();
    } else {
      // Either no timer or different task → switch/start
      switchTask(task);
    }
  };

  const getTooltipText = () => {
    if (isThisTaskRunning) {
      return "Pause timer";
    }
    if (isThisTaskPaused) {
      return "Resume timer";
    }
    if (isActive) {
      return "Switch to this task";
    }
    return "Start timer";
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const ButtonElement = (
    <Button
      variant={variant}
      size={size}
      className={cn(
        isThisTaskRunning && "bg-primary text-primary-foreground hover:bg-primary/90",
        className
      )}
      onClick={handleClick}
      {...props}
    >
      {isThisTaskRunning ? (
        <Pause className={cn(iconSizes[iconSize], "fill-current")} />
      ) : (
        <Play className={cn(iconSizes[iconSize], "fill-current")} />
      )}
      <span className="sr-only">{getTooltipText()}</span>
    </Button>
  );

  if (!showTooltip) {
    return ButtonElement;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{ButtonElement}</TooltipTrigger>
        <TooltipContent side="top">
          <p>{getTooltipText()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
