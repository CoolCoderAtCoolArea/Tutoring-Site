/** Small helpers to turn ids like "math" or "5" into words in the current language. */
type T = (key: string, values?: Record<string, string | number>) => string;

export function gradeLabel(tc: T, grade: string) {
  return grade === "K" ? tc("gradeK") : tc("gradeN", { grade });
}

export function formatLabel(tc: T, mode: string) {
  return mode === "online" ? tc("online") : mode === "in_person" ? tc("inPerson") : tc("both");
}
