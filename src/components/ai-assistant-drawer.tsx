"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  Bot,
  ChevronDown,
  ClipboardCopy,
  Loader2,
  SendHorizonal,
  Sparkles,
  Target,
  Lightbulb,
  Calendar,
} from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Textarea } from "~/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { cn } from "~/lib/utils";

interface TaskContext {
  id: string;
  title: string;
  description?: string | null;
  projectName: string;
  priority: string;
  tags: string[];
}

interface AIAssistantDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskContext?: TaskContext;
  onGoalBreakdown?: () => void;
  onTaskGuidance?: () => void;
  onProjectPlanner?: () => void;
}

const suggestedQuestions = [
  "How should I approach this task?",
  "What resources can help me learn this?",
  "Can you break this down into smaller steps?",
  "What are the best practices for this?",
];

// Helper to extract text content from message parts
function getMessageText(message: { parts: Array<{ type: string; text?: string }> }): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export function AIAssistantDrawer({
  open,
  onOpenChange,
  taskContext,
  onGoalBreakdown,
  onTaskGuidance,
  onProjectPlanner,
}: AIAssistantDrawerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [input, setInput] = useState("");

  // Memoize transport to prevent recreation on every render
  const transport = useMemo(
    () => new DefaultChatTransport({
      api: "/api/ai/chat",
      body: { taskContext },
    }),
    [taskContext]
  );

  const { messages, sendMessage, status, setMessages } = useChat({
    transport,
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Reset chat when drawer closes
  useEffect(() => {
    if (!open) {
      setMessages([]);
      setInput("");
    }
  }, [open, setMessages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input.trim() });
    setInput("");
  };

  const handleCopyMessage = async (content: string, index: number) => {
    await navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSuggestedQuestion = (question: string) => {
    if (isLoading) return;
    sendMessage({ text: question });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-[450px]"
      >
        <SheetHeader className="border-b px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-base">AI Assistant</SheetTitle>
                <SheetDescription className="text-xs">
                  Your productivity coach
                </SheetDescription>
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Task Context */}
        {taskContext && (
          <div className="border-b px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Current Task</p>
                <p className="font-medium text-sm truncate">{taskContext.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {taskContext.projectName}
                </p>
              </div>
              <Badge variant="outline" className="shrink-0 capitalize text-xs">
                {taskContext.priority}
              </Badge>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <Collapsible open={showQuickActions} onOpenChange={setShowQuickActions}>
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center justify-between border-b px-4 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors">
              <span>Quick Actions</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  showQuickActions && "rotate-180"
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="border-b">
            <div className="grid grid-cols-3 gap-2 p-3">
              <Button
                variant="outline"
                size="sm"
                className="flex h-auto flex-col gap-1 py-3"
                onClick={onGoalBreakdown}
              >
                <Target className="h-4 w-4" />
                <span className="text-xs">Goal Breakdown</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex h-auto flex-col gap-1 py-3"
                onClick={onTaskGuidance}
                disabled={!taskContext}
              >
                <Lightbulb className="h-4 w-4" />
                <span className="text-xs">Task Guidance</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex h-auto flex-col gap-1 py-3"
                onClick={onProjectPlanner}
              >
                <Calendar className="h-4 w-4" />
                <span className="text-xs">Plan Project</span>
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4 p-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bot className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-sm text-muted-foreground mb-4">
                  {taskContext
                    ? `Ask me anything about "${taskContext.title}"`
                    : "Ask me anything about your tasks and productivity!"}
                </p>
                <div className="flex flex-col gap-2 w-full">
                  {suggestedQuestions.map((question, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      className="text-xs justify-start text-left h-auto py-2 px-3"
                      onClick={() => handleSuggestedQuestion(question)}
                    >
                      {question}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message, index) => {
                const content = getMessageText(message);
                return (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.role === "assistant" && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Sparkles className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "group relative max-w-[85%] rounded-lg px-3 py-2 text-sm",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      <p className="whitespace-pre-wrap">{content}</p>
                      {message.role === "assistant" && content && status !== "streaming" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute -right-2 -top-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleCopyMessage(content, index)}
                        >
                          {copiedIndex === index ? (
                            <span className="text-[10px] text-green-500">
                              Copied!
                            </span>
                          ) : (
                            <ClipboardCopy className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                    </div>
                    {message.role === "user" && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
                        <span className="text-xs font-medium text-primary-foreground">
                          You
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            {status === "submitted" && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">
                    Thinking...
                  </span>
                </div>
              </div>
            )}
            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="border-t p-4">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                taskContext
                  ? `Ask about "${taskContext.title}"...`
                  : "Ask me anything..."
              }
              className="min-h-[44px] max-h-[120px] resize-none"
              rows={1}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
              className="shrink-0"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SendHorizonal className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground text-center">
            AI responses may not always be accurate. Verify important information.
          </p>
        </form>
      </SheetContent>
    </Sheet>
  );
}
