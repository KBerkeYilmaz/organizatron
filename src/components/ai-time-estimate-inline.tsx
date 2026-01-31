"use client";

import { Check, HelpCircle, Sparkles, X } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import type { AITimeEstimate } from "~/lib/ai-types";

interface AITimeEstimateInlineProps {
  estimate: AITimeEstimate;
  onAccept: () => void;
  onDismiss: () => void;
}

const confidenceColors = {
  low: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  high: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function AITimeEstimateInline({
  estimate,
  onAccept,
  onDismiss,
}: AITimeEstimateInlineProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 mt-1.5 p-2 rounded-md bg-muted/50 border border-border animate-in fade-in slide-in-from-top-1 duration-200">
        <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-sm font-medium">
          ~{formatMinutes(estimate.estimatedMinutes)}
        </span>
        <Badge
          variant="secondary"
          className={`text-xs px-1.5 py-0 ${confidenceColors[estimate.confidence]}`}
        >
          {estimate.confidence}
        </Badge>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-5 w-5"
            >
              <HelpCircle className="h-3 w-3 text-muted-foreground" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-xs">{estimate.reasoning}</p>
          </TooltipContent>
        </Tooltip>

        <div className="flex-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
              onClick={onAccept}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">Use this estimate</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={onDismiss}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">Dismiss</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
