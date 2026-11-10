import { describe, expect, it } from "vitest";
import { earnedBadges, weekKey, weekStreak } from "@/lib/progress";

describe("weekly streak", () => {
  const now = new Date("2026-11-11T17:00:00Z"); // Wednesday
  it("counts consecutive weeks", () => {
    expect(weekStreak(["2026-11-10T20:00:00Z", "2026-11-03T20:00:00Z", "2026-10-27T20:00:00Z"], now)).toBe(3);
  });
  it("doesn't break just because this week hasn't had activity yet", () => {
    expect(weekStreak(["2026-11-04T20:00:00Z", "2026-10-28T20:00:00Z"], now)).toBe(2);
  });
  it("a gap ends the streak", () => {
    expect(weekStreak(["2026-11-10T20:00:00Z", "2026-10-20T20:00:00Z"], now)).toBe(1);
    expect(weekStreak([], now)).toBe(0);
  });
  it("weeks start on Monday in Detroit", () => {
    expect(weekKey("2026-11-16T03:00:00Z")).toBe("2026-11-09"); // Sunday 10pm Detroit
  });
});

describe("badges", () => {
  it("gives badges for effort", () => {
    const keys = earnedBadges({ quizzesDone: 5, perfectQuizzes: 1, assignmentsDone: 1, sessionsDone: 0, activeDates: [] }).map((b) => b.key);
    expect(keys).toEqual(["firstQuiz", "fiveQuizzes", "perfectScore", "firstAssignment"]);
  });
});
