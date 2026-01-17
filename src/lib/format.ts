/**
 * Format seconds into human-readable duration
 * @param seconds - Duration in seconds
 * @param style - "short" for "2h 30m" or "long" for "2 hours 30 minutes"
 */
export function formatDuration(
  seconds: number,
  style: "short" | "long" = "short"
): string {
  if (seconds < 60) {
    return style === "short" ? `${seconds}s` : `${seconds} seconds`;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (style === "short") {
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  }

  const hourLabel = hours === 1 ? "hour" : "hours";
  const minLabel = minutes === 1 ? "minute" : "minutes";

  if (hours === 0) return `${minutes} ${minLabel}`;
  if (minutes === 0) return `${hours} ${hourLabel}`;
  return `${hours} ${hourLabel} ${minutes} ${minLabel}`;
}

/**
 * Format seconds into timer display (HH:MM:SS or MM:SS)
 */
export function formatTimer(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
  }
  return `${pad(minutes)}:${pad(secs)}`;
}

/**
 * Format a date relative to now
 */
export function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Format time of day
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
