import { describe, expect, it } from "vitest";
import { renderMath, speakable } from "@/components/quiz/MathText";

describe("math text", () => {
  it("renders $...$ with KaTeX and escapes the rest", () => {
    const html = renderMath("Solve <b>$x + 7 = 15$</b>");
    expect(html).toContain("katex");
    expect(html).toContain("&lt;b&gt;");
    expect(html).not.toContain("<b>");
  });
  it("makes math readable out loud", () => {
    expect(speakable("Write $\\frac{3}{4}$ as a decimal")).toBe("Write 3 over 4 as a decimal");
    expect(speakable("5 + ___ = 9")).toBe("5 + blank = 9");
  });
});
