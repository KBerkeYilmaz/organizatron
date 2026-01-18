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

            {/* Right Column - Time Summary & Projects */}
            <div className="space-y-8 lg:col-span-2">
              <ClientTimeSummary />
              <TaskTimeEntries />
              <ProjectsOverview />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
