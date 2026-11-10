import { getTranslations } from "next-intl/server";
import type { PlayerLabels } from "@/components/quiz/QuizPlayer";

export async function playerLabels(): Promise<PlayerLabels> {
  const t = await getTranslations("quiz.player");
  const keys = ["questionOf", "readAloud", "stopReading", "hint", "check", "next", "back", "finish", "finishing", "saved", "saving", "true", "false",
    "yourAnswer", "blank", "chooseMatch", "tryAgain", "notQuite", "explanation", "timeLeft", "oneMinute", "unanswered", "offlineSaved", "pickAll", "typeNumber"] as const;
  // Raw strings: the player fills in {n}, {total}, {count} itself.
  const out = Object.fromEntries(keys.map((k) => [k, t.raw(k) as string])) as Omit<PlayerLabels, "cheers">;
  return { ...out, cheers: t.raw("cheers") as string[] };
}
