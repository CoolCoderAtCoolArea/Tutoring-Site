import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

/**
 * ⚠️ ADMIN client — uses the SERVICE ROLE key and IGNORES Row Level Security.
 * Only use it on the server, only after you have checked who the user is,
 * and only for jobs that truly need it (creating student logins, grading
 * quizzes with the answer key, sending reminder emails, deleting family data).
 * The "server-only" import above makes the build fail if a browser file imports this.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set (see .env.example)");
  return createClient(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
