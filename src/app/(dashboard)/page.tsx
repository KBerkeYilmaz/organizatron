"use client";

import { ActiveTimer } from "~/components/active-timer";
import { ClientTimeSummary } from "~/components/client-time-summary";
import { ProjectsOverview } from "~/components/projects-overview";
import { QuickAdd } from "~/components/quick-add";
import { RecentActivity } from "~/components/recent-activity";
import { TaskTimeEntries } from "~/components/task-time-entries";
import { ThemeToggle } from "~/components/theme-toggle";
import { TodayTasks } from "~/components/today-tasks";
import { SidebarTrigger } from "~/components/ui/sidebar";

export default function DashboardPage() {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      {/* Header */}
      <header className="flex h-[65px] shrink-0 items-center border-b bg-background px-6">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-4">
            <SidebarTrigger className="-ml-2" />
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                Good morning, Berke
              </h1>
              <p className="text-sm text-muted-foreground">{today}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <QuickAdd />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="space-y-8">
          {/* Active Timer - Full Width */}
          <section>
            <ActiveTimer />
          </section>

          {/* Two Column Layout */}
          <div className="grid gap-8 lg:grid-cols-5">
            {/* Left Column - Tasks */}
            <div className="lg:col-span-3">
              <TodayTasks />
            </div>

            {/* Right Column - Time Summary, Projects & Activity */}
            <div className="space-y-8 lg:col-span-2">
              <ClientTimeSummary />
              <TaskTimeEntries />
              <ProjectsOverview />
              <RecentActivity />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
