import { site } from "@/config/site";
import { gradeLabel } from "@/lib/labels";

type T = (key: string, values?: Record<string, string | number>) => string;

/** Dropdown options for subjects and grades in the current language. */
export function subjectOptions(ts: T) {
  return site.subjects.map((s) => ({ value: s, label: ts(`names.${s}`) }));
}

export function gradeOptions(tc: T) {
  return site.grades.map((g) => ({ value: g, label: gradeLabel(tc, g) }));
}
