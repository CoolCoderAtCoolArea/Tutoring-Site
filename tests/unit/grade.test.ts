import { describe, expect, it } from "vitest";
import { gradeAttempt, isCorrect, parseNumber } from "@/lib/quiz/grade";

describe("quiz grading", () => {
  it("multiple choice and multiple select", () => {
    expect(isCorrect("multiple_choice", { correct: "b" }, "b")).toBe(true);
    expect(isCorrect("multiple_choice", { correct: "b" }, "a")).toBe(false);
    expect(isCorrect("multiple_select", { correct: ["b", "d"] }, ["d", "b"])).toBe(true);
    expect(isCorrect("multiple_select", { correct: ["b", "d"] }, ["b"])).toBe(false);
    expect(isCorrect("multiple_select", { correct: ["b", "d"] }, ["b", "d", "a"])).toBe(false);
  });

  it("true/false accepts booleans or strings", () => {
    expect(isCorrect("true_false", { correct: false }, false)).toBe(true);
    expect(isCorrect("true_false", { correct: false }, "false")).toBe(true);
    expect(isCorrect("true_false", { correct: true }, "false")).toBe(false);
  });

  it("short answer ignores case, extra spaces, and a final period", () => {
    const key = { accepted: ["Lansing"] };
    expect(isCorrect("short_answer", key, "  lansing. ")).toBe(true);
    expect(isCorrect("short_answer", key, "Detroit")).toBe(false);
    expect(isCorrect("short_answer", { accepted: ["Lansing"], caseSensitive: true }, "lansing")).toBe(false);
  });

  it("numeric answers with tolerance, fractions, commas, percents", () => {
    expect(parseNumber("3/4")).toBe(0.75);
    expect(parseNumber("1,000")).toBe(1000);
    expect(parseNumber("-2 1/2")).toBe(-2.5);
    expect(parseNumber("50%")).toBe(0.5);
    expect(parseNumber("abc")).toBeNaN();
    expect(isCorrect("numeric", { value: 0.75, tolerance: 0.001 }, "3/4")).toBe(true);
    expect(isCorrect("numeric", { value: 0.75, tolerance: 0.001 }, ".75")).toBe(true);
    expect(isCorrect("numeric", { value: 0.75, tolerance: 0.001 }, "0.8")).toBe(false);
    expect(isCorrect("numeric", { value: 12 }, "12")).toBe(true);
  });

  it("fill in the blank checks every blank", () => {
    const key = { blanks: [["4", "four"], ["river"]] };
    expect(isCorrect("fill_blank", key, ["Four", "River"])).toBe(true);
    expect(isCorrect("fill_blank", key, ["4", ""])).toBe(false);
  });

  it("matching needs every pair right", () => {
    const key = { pairs: { l1: "r1", l2: "r2" } };
    expect(isCorrect("matching", key, { l1: "r1", l2: "r2" })).toBe(true);
    expect(isCorrect("matching", key, { l1: "r2", l2: "r1" })).toBe(false);
  });

  it("empty answers are wrong, never errors", () => {
    expect(isCorrect("numeric", { value: 1 }, undefined)).toBe(false);
    expect(isCorrect("matching", { pairs: { l1: "r1" } }, null)).toBe(false);
  });

  it("scores a whole attempt", () => {
    const r = gradeAttempt(
      [
        { id: "q1", type: "multiple_choice", points: 1, answer: { correct: "a" } },
        { id: "q2", type: "numeric", points: 2, answer: { value: 5 } },
      ],
      { q1: "a", q2: "4" },
    );
    expect(r).toMatchObject({ score: 1, max: 3, percent: 33 });
    expect(r.results.q2.correct).toBe(false);
  });
});
