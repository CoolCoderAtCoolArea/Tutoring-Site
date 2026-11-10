import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { importQuestionsCsv, parseCsv } from "@/lib/quiz/csv";
import { isCorrect } from "@/lib/quiz/grade";

describe("CSV quiz import", () => {
  it("reads quoted cells with commas and new lines", () => {
    expect(parseCsv('a,"b, c","d\n""e"""\n1,2,3')).toEqual([["a", "b, c", 'd\n"e"'], ["1", "2", "3"]]);
  });

  it("imports the included template with no errors, one question per type", () => {
    const { questions, errors } = importQuestionsCsv(fs.readFileSync("public/quiz-template.csv", "utf8"));
    expect(errors).toEqual([]);
    expect(questions.map((q) => q.type)).toEqual([
      "multiple_choice", "multiple_select", "true_false", "short_answer", "numeric", "fill_blank", "matching",
    ]);
    // Imported answer keys actually grade correctly.
    const [mc, ms, tf, sa, num, fill, match] = questions;
    expect(isCorrect(mc.type, mc.answer, "b")).toBe(true);
    expect(isCorrect(ms.type, ms.answer, ["b", "d"])).toBe(true);
    expect(isCorrect(tf.type, tf.answer, true)).toBe(true);
    expect(isCorrect(sa.type, sa.answer, "lansing")).toBe(true);
    expect(isCorrect(num.type, num.answer, "3/4")).toBe(true);
    expect(isCorrect(fill.type, fill.answer, ["four"])).toBe(true);
    expect(isCorrect(match.type, match.answer, { l1: "r1", l2: "r2", l3: "r3" })).toBe(true);
  });

  it("explains mistakes by row number", () => {
    const { errors } = importQuestionsCsv("type,prompt,choices,correct\nmultiple_choice,Q?,a|b,c\nbogus,Q,,\nfill_blank,no blanks,,x");
    expect(errors).toHaveLength(3);
    expect(errors[0]).toMatch(/Row 2/);
    expect(errors[1]).toMatch(/unknown type/);
    expect(errors[2]).toMatch(/blanks/);
  });
});
