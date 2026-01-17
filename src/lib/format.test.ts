import { describe, expect, it } from "vitest";
import { formatDuration, formatTimer } from "./format";

describe("formatDuration", () => {
  it("formats seconds only", () => {
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(45, "long")).toBe("45 seconds");
  });

  it("formats minutes only", () => {
    expect(formatDuration(300)).toBe("5m");
    expect(formatDuration(60, "long")).toBe("1 minute");
    expect(formatDuration(120, "long")).toBe("2 minutes");
  });

  it("formats hours only", () => {
    expect(formatDuration(3600)).toBe("1h");
    expect(formatDuration(7200, "long")).toBe("2 hours");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(5400)).toBe("1h 30m");
    expect(formatDuration(5400, "long")).toBe("1 hour 30 minutes");
    expect(formatDuration(9000, "long")).toBe("2 hours 30 minutes");
  });
});

describe("formatTimer", () => {
  it("formats under a minute", () => {
    expect(formatTimer(0)).toBe("00:00");
    expect(formatTimer(5)).toBe("00:05");
    expect(formatTimer(59)).toBe("00:59");
  });

  it("formats minutes and seconds", () => {
    expect(formatTimer(60)).toBe("01:00");
    expect(formatTimer(90)).toBe("01:30");
    expect(formatTimer(3599)).toBe("59:59");
  });

  it("formats hours, minutes and seconds", () => {
    expect(formatTimer(3600)).toBe("01:00:00");
    expect(formatTimer(3661)).toBe("01:01:01");
    expect(formatTimer(36000)).toBe("10:00:00");
  });
});
