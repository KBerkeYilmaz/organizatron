"use client";

import { useState } from "react";

import { ActiveTimer } from "~/components/active-timer";
import { PeriodFilter, type Period } from "~/components/period-filter";
import { TimeEntriesList } from "~/components/time-entries-list";
import {
  TimeEntryFilters,
  type TimeEntryFiltersState,
} from "~/components/time-entry-filters";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { api } from "~/trpc/react";

export default function TimeEntriesPage() {
  const [period, setPeriod] = useState<Period>("week");
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | null>(
    null
  );
  const [filters, setFilters] = useState<TimeEntryFiltersState>({
    clientId: null,
    projectId: null,
    taskId: null,
  });

  // Build query params
  const queryParams = {
    period,
    ...(period === "custom" && dateRange
      ? { startDate: dateRange.start, endDate: dateRange.end }
      : {}),
    ...(filters.clientId && { clientId: filters.clientId }),
    ...(filters.projectId && { projectId: filters.projectId }),
    ...(filters.taskId && { taskId: filters.taskId }),
  };

  const { data, isLoading } = api.timeEntry.getFiltered.useQuery(queryParams, {
    enabled: period !== "custom" || dateRange !== null,
  });

  // Get period display text
  const getPeriodText = () => {
    if (period === "custom" && dateRange) {
      return `${dateRange.start.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })} - ${dateRange.end.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`;
    }
    if (period === "today") return "Today";
    if (period === "week") return "This Week";
    if (period === "month") return "This Month";
    return "";
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <header className="flex h-[65px] shrink-0 items-center border-b bg-background px-6">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-4">
            <SidebarTrigger className="-ml-2" />
            <div>
              <h1 className="text-xl font-semibold">Time Entries</h1>
              <p className="text-sm text-muted-foreground">{getPeriodText()}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Active Timer */}
      <div className="border-b px-6 py-4">
        <ActiveTimer />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 border-b px-6 py-4">
        {/* Period filter */}
        <PeriodFilter
          period={period}
          onPeriodChange={setPeriod}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />

        {/* Entity filters */}
        <TimeEntryFilters filters={filters} onFiltersChange={setFilters} />
      </div>

      {/* Time Entries List */}
      <main className="flex-1 overflow-y-auto p-6">
        <TimeEntriesList data={data} isLoading={isLoading} />
      </main>
    </div>
  );
}
