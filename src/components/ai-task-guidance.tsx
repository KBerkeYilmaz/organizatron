"use client";

import { useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  ExternalLink,
  Lightbulb,
  Loader2,
  Sparkles,
  Split,
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
import { api } from "~/trpc/react";
import type { AITaskGuidance } from "~/lib/ai-types";

interface AITaskGuidancePanelProps {
  taskId: string;
  taskTitle: string;
  onBreakdown?: (subtasks: string[]) => void;
}

export function AITaskGuidancePanel({
  taskId,
  taskTitle,
  onBreakdown,
}: AITaskGuidancePanelProps) {
  const [guidance, setGuidance] = useState<AITaskGuidance | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [copiedPrompt, setCopiedPrompt] = useState<number | null>(null);

  const guidanceMutation = api.ai.getTaskGuidance.useMutation({
    onSuccess: (result) => {
      if (result.success && result.data) {
        setGuidance(result.data);
      }
    },
  });

  const handleGetGuidance = () => {
    guidanceMutation.mutate({ taskId });
  };

  const handleCopyPrompt = async (prompt: string, index: number) => {
    await navigator.clipboard.writeText(prompt);
    setCopiedPrompt(index);
    setTimeout(() => setCopiedPrompt(null), 2000);
  };

  const handleBreakdown = () => {
    if (guidance?.breakdownSuggestion?.suggestedSubtasks) {
      onBreakdown?.(guidance.breakdownSuggestion.suggestedSubtasks);
    }
  };

  if (!guidance && !guidanceMutation.isPending) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Guidance
          </CardTitle>
          <CardDescription>
            Get AI-powered guidance for completing this task
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleGetGuidance}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Get guidance for &quot;{taskTitle}&quot;
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (guidanceMutation.isPending) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Guidance
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">
            Generating guidance...
          </span>
        </CardContent>
      </Card>
    );
  }

  if (guidanceMutation.error || !guidance) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Guidance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Failed to generate guidance. Please try again.
          </p>
          <Button variant="outline" onClick={handleGetGuidance}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                AI Guidance
              </CardTitle>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Main guidance */}
            <div>
              <div className="flex items-start gap-2 mb-2">
                <Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                <h4 className="font-medium text-sm">How to approach this</h4>
              </div>
              <p className="text-sm text-muted-foreground pl-6">
                {guidance.guidance}
              </p>
            </div>

            <Separator />

            {/* Learning resources */}
            {guidance.learningResources &&
              guidance.learningResources.length > 0 && (
                <>
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <BookOpen className="h-4 w-4 text-blue-500" />
                      <h4 className="font-medium text-sm">Learning Resources</h4>
                    </div>
                    <ScrollArea className="max-h-[200px]">
                      <div className="space-y-2 pl-6">
                        {guidance.learningResources.map((resource, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2 text-sm"
                          >
                            <Badge
                              variant="outline"
                              className="shrink-0 capitalize"
                            >
                              {resource.type}
                            </Badge>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <span className="font-medium truncate">
                                  {resource.title}
                                </span>
                                {resource.url && (
                                  <a
                                    href={resource.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline shrink-0"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                              <p className="text-muted-foreground text-xs">
                                {resource.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                  <Separator />
                </>
              )}

            {/* Suggested prompts */}
            {guidance.suggestedPrompts &&
              guidance.suggestedPrompts.length > 0 && (
                <>
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <ClipboardCopy className="h-4 w-4 text-green-500" />
                      <h4 className="font-medium text-sm">
                        Prompts for Claude Code
                      </h4>
                    </div>
                    <div className="space-y-2 pl-6">
                      {guidance.suggestedPrompts.map((prompt, idx) => (
                        <div
                          key={idx}
                          className="relative group rounded-md border bg-muted/50 p-3"
                        >
                          <p className="text-sm font-mono pr-8">{prompt}</p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleCopyPrompt(prompt, idx)}
                          >
                            {copiedPrompt === idx ? (
                              <span className="text-xs text-green-500">
                                Copied!
                              </span>
                            ) : (
                              <ClipboardCopy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

            {/* Breakdown suggestion */}
            {guidance.breakdownSuggestion?.shouldBreakdown &&
              guidance.breakdownSuggestion.suggestedSubtasks && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Split className="h-4 w-4 text-orange-500" />
                    <h4 className="font-medium text-sm">
                      Consider breaking this down
                    </h4>
                  </div>
                  <div className="pl-6 space-y-2">
                    <p className="text-sm text-muted-foreground">
                      This task might be easier to tackle in smaller pieces:
                    </p>
                    <ul className="text-sm space-y-1 list-disc pl-4">
                      {guidance.breakdownSuggestion.suggestedSubtasks.map(
                        (subtask, idx) => (
                          <li key={idx}>{subtask}</li>
                        )
                      )}
                    </ul>
                    {onBreakdown && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={handleBreakdown}
                      >
                        <Split className="h-4 w-4 mr-2" />
                        Break down into subtasks
                      </Button>
                    )}
                  </div>
                </div>
              )}

            {/* Refresh button */}
            <div className="pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={handleGetGuidance}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Regenerate guidance
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
