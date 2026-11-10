/** Join class names, skipping empty ones: cn("a", false && "b", "c") -> "a c" */
export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
