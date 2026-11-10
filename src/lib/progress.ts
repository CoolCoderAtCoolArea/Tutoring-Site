import { detroitDateKey } from "@/lib/time";

/**
 * Light, kind gamification: badges for effort and a weekly streak.
 * Badges are worked out from what a student has done — nothing extra is stored,
 * and students are NEVER compared with each other (no leaderboards).
 */
export type Activity = {
  quizzesDone: number;
  perfectQuizzes: number;
  assignmentsDone: number;
  sessionsDone: number;
  activeDates: (string | Date)[]; // when they finished a quiz, turned in work, or had a session
};

export type Badge = { key: string; icon: string };

export function earnedBadges(a: Activity): Badge[] {
  const all: [boolean, Badge][] = [
    [a.sessionsDone >= 1, { key: "firstSession", icon: "🌱" }],
    [a.quizzesDone >= 1, { key: "firstQuiz", icon: "🧩" }],
    [a.quizzesDone >= 5, { key: "fiveQuizzes", icon: "🏅" }],
    [a.perfectQuizzes >= 1, { key: "perfectScore", icon: "🌟" }],
    [a.assignmentsDone >= 1, { key: "firstAssignment", icon: "📝" }],
    [a.assignmentsDone >= 10, { key: "tenAssignments", icon: "🏆" }],
    [weekStreak(a.activeDates) >= 3, { key: "threeWeekStreak", icon: "🔥" }],
  ];
  return all.filter(([ok]) => ok).map(([, b]) => b);
}

/** Monday (in Detroit) of the week containing this date, as "YYYY-MM-DD". */
export function weekKey(date: string | Date) {
  const [y, m, d] = detroitDateKey(date).split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));
  const dow = (day.getUTCDay() + 6) % 7; // Monday = 0
  day.setUTCDate(day.getUTCDate() - dow);
  return day.toISOString().slice(0, 10);
}

/**
 * How many weeks in a row (ending this week or last week) had at least one
 * learning activity. Missing THIS week doesn't break the streak yet.
 */
export function weekStreak(dates: (string | Date)[], now: Date = new Date()) {
  const weeks = new Set(dates.map(weekKey));
  const cursor = new Date(weekKey(now) + "T12:00:00Z");
  if (!weeks.has(cursor.toISOString().slice(0, 10))) cursor.setUTCDate(cursor.getUTCDate() - 7);
  let streak = 0;
  while (weeks.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 7);
  }
  return streak;
}
