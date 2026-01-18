"use client";

import { ActiveTimer } from "~/components/active-timer";
import { ClientTimeSummary } from "~/components/client-time-summary";
import { PageHeader } from "~/components/page-header";
import { ProjectsOverview } from "~/components/projects-overview";
import { TaskTimeEntries } from "~/components/task-time-entries";
import { TodayTasks } from "~/components/today-tasks";

export default function DashboardPage() {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <PageHeader title="Good morning, Berke" subtitle={today} />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Sticky Active Timer */}
        <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm">
          <div className="px-6 py-4">
            <ActiveTimer />
          </div>
        </div>

        <div className="space-y-8 px-6 py-6">
          {/* Today's Tasks - Hero Section */}
          <section>
            <TodayTasks />
          </section>

          {/* Insights Strip */}
          <section>
            <h2 className="mb-4 text-lg font-medium text-muted-foreground">
              Insights
            </h2>
            <div className="scrollbar-hide flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 lg:grid lg:grid-cols-3 lg:overflow-visible">
              <div className="min-w-[300px] snap-start lg:min-w-0">
                <ClientTimeSummary />
              </div>
              <div className="min-w-[300px] snap-start lg:min-w-0">
                <TaskTimeEntries />
              </div>
              <div className="min-w-[300px] snap-start lg:min-w-0">
                <ProjectsOverview />
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
