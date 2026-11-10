import { describe, expect, it } from "vitest";
import { detroitDateKey, detroitTimeValue, detroitToDate, formatTime } from "@/lib/time";

describe("Detroit time", () => {
  it("converts Detroit wall-clock time in winter (EST, UTC-5)", () => {
    expect(detroitToDate("2026-12-15", "16:30").toISOString()).toBe("2026-12-15T21:30:00.000Z");
  });
  it("converts Detroit wall-clock time in summer (EDT, UTC-4)", () => {
    expect(detroitToDate("2026-07-01", "09:00").toISOString()).toBe("2026-07-01T13:00:00.000Z");
  });
  it("groups by the Detroit day, not the UTC day", () => {
    // 11pm Detroit on Nov 12 is already Nov 13 in UTC.
    expect(detroitDateKey("2026-11-13T04:00:00Z")).toBe("2026-11-12");
  });
  it("formats times for families", () => {
    expect(formatTime("2026-12-15T21:30:00Z", "en")).toMatch(/4:30\sPM/);
    expect(detroitTimeValue("2026-12-15T21:30:00Z")).toBe("16:30");
  });
});
