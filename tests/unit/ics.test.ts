import { describe, expect, it } from "vitest";
import { buildIcs } from "@/lib/ics";

describe("calendar file", () => {
  it("has the right times (UTC) and escapes text", () => {
    const ics = buildIcs({ uid: "abc@site", start: new Date("2026-12-15T21:30:00Z"), end: new Date("2026-12-15T22:30:00Z"), title: "Math, with Sam" });
    expect(ics).toContain("DTSTART:20261215T213000Z");
    expect(ics).toContain("DTEND:20261215T223000Z");
    expect(ics).toContain("SUMMARY:Math\\, with Sam");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
  });
});
