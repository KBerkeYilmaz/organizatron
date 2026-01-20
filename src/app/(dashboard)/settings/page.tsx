"use client";

import { Calendar, CheckCircle, ExternalLink, Loader2, Unlink } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "~/components/page-header";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";

export default function SettingsPage() {
  const utils = api.useUtils();

  const { data: calendarStatus, isLoading: isStatusLoading } =
    api.googleCalendar.getStatus.useQuery();

  const disconnectMutation = api.googleCalendar.disconnect.useMutation({
    onSuccess: () => {
      void utils.googleCalendar.getStatus.invalidate();
      toast.success("Google Calendar disconnected");
    },
    onError: (error) => {
      toast.error("Failed to disconnect", { description: error.message });
    },
  });

  const handleConnect = () => {
    // Redirect to Google OAuth flow
    window.location.href = "/api/auth/google";
  };

  const handleDisconnect = () => {
    if (confirm("Disconnect Google Calendar? Your calendar events will no longer sync.")) {
      disconnectMutation.mutate();
    }
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Manage your integrations and preferences" />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Integrations Section */}
          <div>
            <h2 className="text-lg font-semibold">Integrations</h2>
            <p className="text-sm text-muted-foreground">
              Connect external services to enhance your workflow
            </p>
          </div>

          <Separator />

          {/* Google Calendar Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">Google Calendar</CardTitle>
                  <CardDescription>
                    Sync your tasks with due dates to Google Calendar
                  </CardDescription>
                </div>
                {isStatusLoading ? (
                  <Skeleton className="h-9 w-24" />
                ) : calendarStatus?.connected ? (
                  <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-sm text-emerald-600 dark:text-emerald-400">
                    <CheckCircle className="h-4 w-4" />
                    Connected
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Not connected</div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isStatusLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : calendarStatus?.connected ? (
                <>
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10">
                        <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{calendarStatus.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Tasks with due dates will appear in your calendar
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        window.open("https://calendar.google.com", "_blank")
                      }
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open Google Calendar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDisconnect}
                      disabled={disconnectMutation.isPending}
                    >
                      {disconnectMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Unlink className="mr-2 h-4 w-4" />
                      )}
                      Disconnect
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>
                      Connect your Google account to automatically sync tasks with due
                      dates to your Google Calendar.
                    </p>
                    <ul className="list-inside list-disc space-y-1">
                      <li>Tasks with due dates appear as calendar events</li>
                      <li>Changes sync automatically when you update tasks</li>
                      <li>Events are removed when tasks are deleted</li>
                    </ul>
                  </div>
                  <Button onClick={handleConnect}>
                    <Calendar className="mr-2 h-4 w-4" />
                    Connect Google Calendar
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Future integrations placeholder */}
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-base text-muted-foreground">
                More integrations coming soon
              </CardTitle>
              <CardDescription>
                We&apos;re working on adding more integrations like Slack, Notion, and
                more.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>
    </>
  );
}
