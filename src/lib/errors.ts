/**
 * Turns database error codes (raised in supabase/migrations/*_functions.sql)
 * into keys in messages/*.json -> "errors".
 */
const KNOWN = [
  "slot_taken", "not_your_child", "too_late", "reason_required", "not_found", "not_allowed",
  "not_assigned", "empty", "bad_file", "already_complete", "no_retries", "cannot_demote_self", "bad_mode",
];

export function errorKey(message: string | undefined | null): string {
  if (!message) return "generic";
  return KNOWN.find((k) => message.includes(k)) ?? "generic";
}
