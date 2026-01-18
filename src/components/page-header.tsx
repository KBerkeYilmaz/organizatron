"use client";

import { Activity } from "lucide-react";
import { useState } from "react";

import { ActivitySidebar } from "~/components/activity-sidebar";
import { QuickAdd } from "~/components/quick-add";
import { ThemeToggle } from "~/components/theme-toggle";
import { Button } from "~/components/ui/button";
import { SidebarTrigger } from "~/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
}

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  const [activityOpen, setActivityOpen] = useState(false);

  return (
    <>
      <header className="flex h-[65px] shrink-0 items-center border-b bg-background px-6">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-4">
            <SidebarTrigger className="-ml-2" />
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setActivityOpen(true)}
                >
                  <Activity className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Recent Activity</TooltipContent>
            </Tooltip>
            <ThemeToggle />
            <QuickAdd />
          </div>
        </div>
      </header>

      <ActivitySidebar open={activityOpen} onOpenChange={setActivityOpen} />
    </>
  );
}
