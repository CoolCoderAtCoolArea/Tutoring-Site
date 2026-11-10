import katex from "katex";

/**
 * Shows text with math. Write math between dollar signs:  "Solve $x + 7 = 15$".
 * Use \$ for a real dollar sign. Works on the server and in the browser.
 */
export function renderMath(text: string): string {
  const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  const parts = text.split(/(?<!\\)\$(.+?)(?<!\\)\$/gs);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) {
        try {
          return katex.renderToString(part, { throwOnError: false, output: "htmlAndMathml" });
        } catch {
          return escape(part);
        }
      }
      return escape(part.replace(/\\\$/g, "$")).replace(/\n/g, "<br>");
    })
    .join("");
}

export function MathText({ text, as: As = "span", className }: { text: string; as?: "span" | "p" | "div"; className?: string }) {
  return <As className={className} dangerouslySetInnerHTML={{ __html: renderMath(text) }} />;
}

/** Text for read-aloud: turns simple math into words a speech engine can say. */
export function speakable(text: string) {
  return text
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "$1 over $2")
    .replace(/\\times|\\cdot/g, " times ")
    .replace(/\\div/g, " divided by ")
    .replace(/\^\{?(\w+)\}?/g, " to the power of $1")
    .replace(/\\approx/g, " about ")
    .replace(/\\%/g, " percent")
    .replace(/_{3,}/g, " blank ")
    .replace(/[$\\{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
