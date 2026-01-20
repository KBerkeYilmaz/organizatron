import { describe, it, expect, vi, beforeEach } from "vitest";

// Test the getGreeting logic (extracted for testability)
function getGreeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

describe("getGreeting", () => {
  it("returns 'Good morning' for hours before noon", () => {
    expect(getGreeting(0)).toBe("Good morning");
    expect(getGreeting(6)).toBe("Good morning");
    expect(getGreeting(11)).toBe("Good morning");
  });

  it("returns 'Good afternoon' for hours between noon and 6pm", () => {
    expect(getGreeting(12)).toBe("Good afternoon");
    expect(getGreeting(15)).toBe("Good afternoon");
    expect(getGreeting(17)).toBe("Good afternoon");
  });

  it("returns 'Good evening' for hours after 6pm", () => {
    expect(getGreeting(18)).toBe("Good evening");
    expect(getGreeting(21)).toBe("Good evening");
    expect(getGreeting(23)).toBe("Good evening");
  });
});

describe("User display name extraction", () => {
  function getUserDisplayName(user: {
    user_metadata?: { full_name?: string };
    email?: string;
  } | null): string {
    return user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "there";
  }

  it("returns full_name from user_metadata when available", () => {
    const user = {
      user_metadata: { full_name: "John Doe" },
      email: "john@example.com",
    };
    expect(getUserDisplayName(user)).toBe("John Doe");
  });

  it("returns email username when full_name is not available", () => {
    const user = {
      user_metadata: {},
      email: "john@example.com",
    };
    expect(getUserDisplayName(user)).toBe("john");
  });

  it("returns 'there' when user is null", () => {
    expect(getUserDisplayName(null)).toBe("there");
  });

  it("returns 'there' when both full_name and email are missing", () => {
    const user = { user_metadata: {} };
    expect(getUserDisplayName(user)).toBe("there");
  });
});

describe("User initials extraction", () => {
  function getUserInitials(name: string): string {
    return name
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  it("returns two initials for full names", () => {
    expect(getUserInitials("John Doe")).toBe("JD");
    expect(getUserInitials("Jane Smith")).toBe("JS");
  });

  it("returns single initial for single names", () => {
    expect(getUserInitials("John")).toBe("J");
  });

  it("returns first two initials for names with more than two parts", () => {
    expect(getUserInitials("John Michael Doe")).toBe("JM");
  });

  it("handles empty strings", () => {
    expect(getUserInitials("")).toBe("");
  });
});
