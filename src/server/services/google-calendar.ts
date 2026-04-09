import { env } from "~/env";
import { db } from "~/server/db";

interface CalendarEvent {
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone: string } | { date: string };
  end: { dateTime: string; timeZone: string } | { date: string };
}

interface GoogleCalendarResult {
  success: boolean;
  eventId?: string;
  error?: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
}

export class GoogleCalendarService {
  private static CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

  /**
   * Get valid access token, refreshing if necessary
   */
  static async getValidAccessToken(userId: string): Promise<string | null> {
    const account = await db.googleAccount.findUnique({
      where: { userId },
    });

    if (!account) return null;

    // Check if token is expired (with 5-minute buffer)
    const isExpired =
      new Date(account.expiresAt) <= new Date(Date.now() + 5 * 60 * 1000);

    if (isExpired) {
      if (!account.refreshToken) {
        console.warn("[GoogleCalendar] Access token expired and no refresh token available for user:", userId);
        return null;
      }
      const newToken = await this.refreshAccessToken(account.refreshToken);
      if (!newToken) {
        console.warn("[GoogleCalendar] Failed to refresh access token for user:", userId);
        return null;
      }
      await db.googleAccount.update({
        where: { userId },
        data: {
          accessToken: newToken.access_token,
          expiresAt: new Date(Date.now() + newToken.expires_in * 1000),
        },
      });
      return newToken.access_token;
    }

    return account.accessToken;
  }

  /**
   * Refresh access token using refresh token
   */
  private static async refreshAccessToken(
    refreshToken: string
  ): Promise<TokenResponse | null> {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      console.warn("[GoogleCalendar] Missing OAuth credentials");
      return null;
    }

    try {
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });

      if (!response.ok) return null;
      return (await response.json()) as TokenResponse;
    } catch {
      return null;
    }
  }

  /**
   * Create a Google Calendar event from a task
   * Uses scheduledStart if available, falls back to dueDate
   */
  static async createEvent(
    userId: string,
    task: {
      title: string;
      description?: string | null;
      scheduledStart?: Date | null;
      dueDate?: Date | null;
      estimatedTime?: number | null;
    }
  ): Promise<GoogleCalendarResult> {
    const accessToken = await this.getValidAccessToken(userId);
    if (!accessToken) {
      return { success: false, error: "Not connected to Google Calendar" };
    }

    const event = this.taskToCalendarEvent(task);
    if (!event) {
      return { success: false, error: "Task has no scheduledStart or dueDate" };
    }

    try {
      const response = await fetch(
        `${this.CALENDAR_API_BASE}/calendars/primary/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error("[GoogleCalendar] Create event failed:", error);
        return { success: false, error: `Failed to create event: ${error}` };
      }

      const data = (await response.json()) as { id: string };
      return { success: true, eventId: data.id };
    } catch (error) {
      console.error("[GoogleCalendar] Create event error:", error);
      return { success: false, error: `API error: ${error}` };
    }
  }

  /**
   * Update an existing Google Calendar event
   * Uses scheduledStart if available, falls back to dueDate
   */
  static async updateEvent(
    userId: string,
    eventId: string,
    task: {
      title: string;
      description?: string | null;
      scheduledStart?: Date | null;
      dueDate?: Date | null;
      estimatedTime?: number | null;
    }
  ): Promise<GoogleCalendarResult> {
    const accessToken = await this.getValidAccessToken(userId);
    if (!accessToken) {
      return { success: false, error: "Not connected to Google Calendar" };
    }

    const event = this.taskToCalendarEvent(task);
    if (!event) {
      return { success: false, error: "Task has no scheduledStart or dueDate" };
    }

    try {
      const response = await fetch(
        `${this.CALENDAR_API_BASE}/calendars/primary/events/${eventId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        }
      );

      if (!response.ok) {
        // Event may have been deleted from Google Calendar
        if (response.status === 404) {
          // Create a new event instead
          return this.createEvent(userId, task);
        }
        const error = await response.text();
        console.error("[GoogleCalendar] Update event failed:", error);
        return { success: false, error: `Failed to update event: ${error}` };
      }

      return { success: true, eventId };
    } catch (error) {
      console.error("[GoogleCalendar] Update event error:", error);
      return { success: false, error: `API error: ${error}` };
    }
  }

  /**
   * Delete a Google Calendar event
   */
  static async deleteEvent(
    userId: string,
    eventId: string
  ): Promise<GoogleCalendarResult> {
    const accessToken = await this.getValidAccessToken(userId);
    if (!accessToken) {
      return { success: false, error: "Not connected to Google Calendar" };
    }

    try {
      const response = await fetch(
        `${this.CALENDAR_API_BASE}/calendars/primary/events/${eventId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      // 204 No Content or 404 Not Found are both considered success for delete
      if (response.ok || response.status === 404) {
        return { success: true };
      }

      const error = await response.text();
      console.error("[GoogleCalendar] Delete event failed:", error);
      return { success: false, error: `Failed to delete event: ${error}` };
    } catch (error) {
      console.error("[GoogleCalendar] Delete event error:", error);
      return { success: false, error: `API error: ${error}` };
    }
  }

  /**
   * Convert task to Google Calendar event format
   * Priority: scheduledStart > dueDate
   * - If scheduledStart exists: use it as start time (timed event)
   * - Else if dueDate exists: use it (all-day if no estimatedTime)
   */
  private static taskToCalendarEvent(task: {
    title: string;
    description?: string | null;
    scheduledStart?: Date | null;
    dueDate?: Date | null;
    estimatedTime?: number | null;
  }): CalendarEvent | null {
    // Use scheduledStart if available, otherwise fall back to dueDate
    const eventTime = task.scheduledStart ?? task.dueDate;
    if (!eventTime) return null;

    const startDate = new Date(eventTime);

    // If we have scheduledStart OR estimatedTime, create a timed event
    // scheduledStart implies a specific time slot
    if (task.scheduledStart || task.estimatedTime) {
      const duration = task.estimatedTime ?? 3600; // Default 1 hour if no estimate
      const endDate = new Date(startDate.getTime() + duration * 1000);
      return {
        summary: task.title,
        description: task.description ?? undefined,
        start: { dateTime: startDate.toISOString(), timeZone: "UTC" },
        end: { dateTime: endDate.toISOString(), timeZone: "UTC" },
      };
    } else {
      // All-day event (only dueDate, no scheduledStart or estimatedTime)
      const dateStr = startDate.toISOString().split("T")[0]!;
      return {
        summary: task.title,
        description: task.description ?? undefined,
        start: { date: dateStr },
        end: { date: dateStr },
      };
    }
  }

  /**
   * Check if user has Google Calendar connected
   */
  static async isConnected(userId: string): Promise<boolean> {
    const account = await db.googleAccount.findUnique({
      where: { userId },
    });
    return !!account;
  }
}
