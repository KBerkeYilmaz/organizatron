"use client";

import { Plus, Sparkles, X } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

interface AITagSuggestionsInlineProps {
  suggestions: string[];
  reasoning?: string | null;
  onAccept: (tag: string) => void;
  onAcceptAll: () => void;
  onDismissAll: () => void;
}

export function AITagSuggestionsInline({
  suggestions,
  reasoning,
  onAccept,
  onAcceptAll,
  onDismissAll,
}: AITagSuggestionsInlineProps) {
  if (suggestions.length === 0) return null;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 mt-1.5 p-2 rounded-md bg-muted/50 border border-border animate-in fade-in slide-in-from-top-1 duration-200 flex-wrap">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 shrink-0">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </div>
          </TooltipTrigger>
          {reasoning && (
            <TooltipContent side="top" className="max-w-xs">
              <p className="text-xs">{reasoning}</p>
            </TooltipContent>
          )}
        </Tooltip>

        {suggestions.map((tag) => (
          <Tooltip key={tag}>
            <TooltipTrigger asChild>
              <Badge
                variant="secondary"
                className="cursor-pointer hover:bg-primary/20 transition-colors gap-1 pr-1"
                onClick={() => onAccept(tag)}
              >
                {tag}
                <Plus className="h-3 w-3" />
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-xs">Add tag</p>
            </TooltipContent>
          </Tooltip>
        ))}

        <div className="flex-1" />

        {suggestions.length > 1 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2 text-primary hover:text-primary"
            onClick={onAcceptAll}
          >
            Add all
          </Button>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={onDismissAll}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">Dismiss suggestions</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
