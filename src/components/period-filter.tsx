"use client";

import { Calendar as CalendarIcon } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";

export type Period = "today" | "week" | "month" | "custom";

interface PeriodFilterProps {
  period: Period;
  onPeriodChange: (period: Period) => void;
  dateRange: { start: Date; end: Date } | null;
  onDateRangeChange: (range: { start: Date; end: Date } | null) => void;
}

const periods: { id: Period; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "custom", label: "Custom" },
];

export function PeriodFilter({
  period,
  onPeriodChange,
  dateRange,
  onDateRangeChange,
}: PeriodFilterProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectingStart, setSelectingStart] = useState(true);
  const [tempRange, setTempRange] = useState<{ start?: Date; end?: Date }>({});

  const handlePeriodClick = (p: Period) => {
    if (p === "custom") {
      setCalendarOpen(true);
      setSelectingStart(true);
      setTempRange({});
    } else {
      onPeriodChange(p);
      onDateRangeChange(null);
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;

    if (selectingStart) {
      setTempRange({ start: date, end: undefined });
      setSelectingStart(false);
    } else {
      const start = tempRange.start!;
      // Ensure start is before end
      if (date < start) {
        setTempRange({ start: date, end: start });
      } else {
        setTempRange({ start, end: date });
      }

      // Finalize selection
      const finalStart = date < start ? date : start;
      const finalEnd = date < start ? start : date;
      onDateRangeChange({ start: finalStart, end: finalEnd });
      onPeriodChange("custom");
      setCalendarOpen(false);
      setTempRange({});
      setSelectingStart(true);
    }
  };

  const getDateRangeDisplay = () => {
    if (!dateRange) return "Select dates";
    return `${format(dateRange.start, "MMM d")} - ${format(dateRange.end, "MMM d, yyyy")}`;
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex rounded-lg border bg-muted/30 p-1">
        {periods.map((p) => (
          <Button
            key={p.id}
            variant="ghost"
            size="sm"
            onClick={() => handlePeriodClick(p.id)}
            className={cn(
              "h-8 px-3 text-sm font-medium transition-colors",
              period === p.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* Custom date range display/picker */}
      {period === "custom" && (
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 gap-2 text-sm font-normal",
                !dateRange && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="h-4 w-4" />
              {getDateRangeDisplay()}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-3 border-b">
              <p className="text-sm font-medium">
                {selectingStart ? "Select start date" : "Select end date"}
              </p>
              {tempRange.start && (
                <p className="text-xs text-muted-foreground mt-1">
                  Start: {format(tempRange.start, "MMM d, yyyy")}
                </p>
              )}
            </div>
            <Calendar
              mode="single"
              selected={selectingStart ? tempRange.start : tempRange.end}
              onSelect={handleDateSelect}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
