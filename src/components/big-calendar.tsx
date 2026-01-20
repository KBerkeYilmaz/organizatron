"use client";

import {
  Calendar as BigCalendar,
  dateFnsLocalizer,
  type View,
  type SlotInfo,
} from "react-big-calendar";
import {
  format,
  parse,
  startOfWeek,
  getDay,
  addHours,
  isSameDay,
} from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  LayoutGrid,
  List,
  Clock,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

// Setup date-fns localizer
const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales,
});

// Event type matching your task structure
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  resource?: {
    taskId: string;
    projectName: string;
    clientName: string;
    clientColor: string;
    status: string;
    priority: string;
    isBillable: boolean;
  };
}

interface BigCalendarProps {
  events: CalendarEvent[];
  onSelectEvent?: (event: CalendarEvent) => void;
  onSelectSlot?: (slotInfo: SlotInfo) => void;
  onNavigate?: (date: Date) => void;
  onView?: (view: View) => void;
  defaultView?: View;
  defaultDate?: Date;
  className?: string;
}

// Custom toolbar component
function CustomToolbar({
  date,
  view,
  onNavigate,
  onView,
}: {
  date: Date;
  view: View;
  onNavigate: (action: "PREV" | "NEXT" | "TODAY") => void;
  onView: (view: View) => void;
}) {
  const viewOptions: { value: View; label: string; icon: React.ReactNode }[] = [
    { value: "month", label: "Month", icon: <LayoutGrid className="h-4 w-4" /> },
    { value: "week", label: "Week", icon: <CalendarIcon className="h-4 w-4" /> },
    { value: "day", label: "Day", icon: <Clock className="h-4 w-4" /> },
    { value: "agenda", label: "Agenda", icon: <List className="h-4 w-4" /> },
  ];

  const formattedDate = useMemo(() => {
    if (view === "day") {
      return format(date, "EEEE, MMMM d, yyyy");
    }
    if (view === "week") {
      return format(date, "MMMM yyyy");
    }
    return format(date, "MMMM yyyy");
  }, [date, view]);

  return (
    <div className="flex items-center justify-between border-b bg-background px-4 py-3">
      {/* Left: Navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate("TODAY")}
        >
          Today
        </Button>
        <div className="flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onNavigate("PREV")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Previous</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onNavigate("NEXT")}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Next</TooltipContent>
          </Tooltip>
        </div>
        <h2 className="ml-2 text-lg font-semibold">{formattedDate}</h2>
      </div>

      {/* Right: View switcher */}
      <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-1">
        {viewOptions.map((option) => (
          <Tooltip key={option.value}>
            <TooltipTrigger asChild>
              <Button
                variant={view === option.value ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "h-8 gap-2 px-3",
                  view === option.value && "bg-background shadow-sm"
                )}
                onClick={() => onView(option.value)}
              >
                {option.icon}
                <span className="hidden sm:inline">{option.label}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent className="sm:hidden">{option.label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}

// Custom event component
function EventComponent({
  event,
  title,
}: {
  event: CalendarEvent;
  title: string;
}) {
  const clientColor = event.resource?.clientColor ?? "var(--primary)";
  const isBillable = event.resource?.isBillable;

  return (
    <div
      className="flex h-full items-center gap-1.5 overflow-hidden rounded px-1.5 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: `color-mix(in oklch, ${clientColor} 20%, transparent)`,
        borderLeft: `3px solid ${clientColor}`,
        color: "var(--foreground)",
      }}
    >
      <span className="truncate">{title}</span>
      {isBillable && (
        <span className="flex-shrink-0 text-[10px] text-emerald-600 dark:text-emerald-400">
          $
        </span>
      )}
    </div>
  );
}

// Custom month event component (for the small cells)
function MonthEventComponent({
  event,
  title,
}: {
  event: CalendarEvent;
  title: string;
}) {
  const clientColor = event.resource?.clientColor ?? "var(--primary)";

  return (
    <div
      className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[11px] font-medium leading-tight"
      style={{
        backgroundColor: `color-mix(in oklch, ${clientColor} 25%, transparent)`,
        color: "var(--foreground)",
      }}
    >
      <span
        className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
        style={{ backgroundColor: clientColor }}
      />
      <span className="truncate">{title}</span>
    </div>
  );
}

export function OrganizatronCalendar({
  events,
  onSelectEvent,
  onSelectSlot,
  onNavigate,
  onView,
  defaultView = "week",
  defaultDate = new Date(),
  className,
}: BigCalendarProps) {
  const [currentDate, setCurrentDate] = useState(defaultDate);
  const [currentView, setCurrentView] = useState<View>(defaultView);

  const handleNavigate = useCallback(
    (date: Date) => {
      setCurrentDate(date);
      onNavigate?.(date);
    },
    [onNavigate]
  );

  const handleViewChange = useCallback(
    (view: View) => {
      setCurrentView(view);
      onView?.(view);
    },
    [onView]
  );

  const handleSelectSlot = useCallback(
    (slotInfo: SlotInfo) => {
      onSelectSlot?.(slotInfo);
    },
    [onSelectSlot]
  );

  const handleSelectEvent = useCallback(
    (event: CalendarEvent) => {
      onSelectEvent?.(event);
    },
    [onSelectEvent]
  );

  // Custom components
  const components = useMemo(
    () => ({
      toolbar: (props: { date: Date; view: View; onNavigate: (action: "PREV" | "NEXT" | "TODAY") => void; onView: (view: View) => void }) => (
        <CustomToolbar
          date={props.date}
          view={props.view}
          onNavigate={props.onNavigate}
          onView={props.onView}
        />
      ),
      event: EventComponent,
      month: {
        event: MonthEventComponent,
      },
    }),
    []
  );

  // Event style getter
  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    const clientColor = event.resource?.clientColor ?? "var(--primary)";
    return {
      style: {
        backgroundColor: `color-mix(in oklch, ${clientColor} 15%, transparent)`,
        borderLeft: `3px solid ${clientColor}`,
        borderRadius: "var(--radius-sm)",
        color: "var(--foreground)",
        border: "none",
        padding: "2px 4px",
      },
    };
  }, []);

  // Day style getter
  const dayStyleGetter = useCallback((date: Date) => {
    const isToday = isSameDay(date, new Date());
    return {
      style: {
        backgroundColor: isToday ? "var(--accent)" : undefined,
      },
    };
  }, []);

  return (
    <div className={cn("flex h-full flex-col overflow-hidden rounded-lg border bg-card", className)}>
      <BigCalendar
        localizer={localizer}
        events={events}
        date={currentDate}
        view={currentView}
        onNavigate={handleNavigate}
        onView={handleViewChange}
        onSelectEvent={handleSelectEvent}
        onSelectSlot={handleSelectSlot}
        selectable
        popup
        components={components}
        eventPropGetter={eventStyleGetter}
        dayPropGetter={dayStyleGetter}
        views={["month", "week", "day", "agenda"]}
        step={30}
        timeslots={2}
        defaultView={defaultView}
        min={new Date(1970, 1, 1, 6, 0, 0)} // Start at 6 AM
        max={new Date(1970, 1, 1, 22, 0, 0)} // End at 10 PM
        formats={{
          timeGutterFormat: (date: Date) => format(date, "h a"),
          eventTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
            `${format(start, "h:mm a")} - ${format(end, "h:mm a")}`,
          dayHeaderFormat: (date: Date) => format(date, "EEE d"),
          dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
            `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`,
          agendaDateFormat: (date: Date) => format(date, "EEE MMM d"),
          agendaTimeFormat: (date: Date) => format(date, "h:mm a"),
          agendaTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
            `${format(start, "h:mm a")} - ${format(end, "h:mm a")}`,
        }}
        messages={{
          today: "Today",
          previous: "Back",
          next: "Next",
          month: "Month",
          week: "Week",
          day: "Day",
          agenda: "Agenda",
          noEventsInRange: "No tasks scheduled in this range.",
          showMore: (total: number) => `+${total} more`,
        }}
      />
    </div>
  );
}

// Helper function to convert tasks to calendar events
export function tasksToCalendarEvents(
  tasks: Array<{
    id: string;
    title: string;
    dueDate: Date | null;
    estimatedTime: number | null;
    status: string;
    priority: string;
    isBillable: boolean;
    project: {
      name: string;
      client: {
        name: string;
        color: string;
      };
    };
  }>
): CalendarEvent[] {
  return tasks
    .filter((task) => task.dueDate !== null)
    .map((task) => {
      const start = new Date(task.dueDate!);
      // Default duration: estimated time or 1 hour
      const durationHours = task.estimatedTime
        ? task.estimatedTime / 3600
        : 1;
      const end = addHours(start, durationHours);

      return {
        id: task.id,
        title: task.title,
        start,
        end,
        resource: {
          taskId: task.id,
          projectName: task.project.name,
          clientName: task.project.client.name,
          clientColor: task.project.client.color,
          status: task.status,
          priority: task.priority,
          isBillable: task.isBillable,
        },
      };
    });
}
