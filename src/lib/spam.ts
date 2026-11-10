import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Spam protection for public forms:
 *  1. Honeypot — a hidden "website" field. People can't see it; bots fill it in.
 *  2. Rate limit — at most `limit` submissions per `windowSeconds` per visitor.
 *     We store a one-way hash of the visitor's IP address, never the raw IP.
 *  3. Optional Cloudflare Turnstile check, if TURNSTILE_SECRET_KEY is set.
 */
const memory = new Map<string, { count: number; reset: number }>();

async function visitorKey(form: string) {
  const h = await headers();
  const ip =
    h.get("x-nf-client-connection-ip") ||
    h.get("cf-connecting-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const salt = process.env.CRON_SECRET || "salt";
  return `${form}:${createHash("sha256").update(ip + salt).digest("hex").slice(0, 32)}`;
}

export async function checkSpam(form: string, data: FormData, limit = 5, windowSeconds = 600): Promise<boolean> {
  // 1. Honeypot
  if (String(data.get("website") || "").trim() !== "") return false;

  // 2. Rate limit (database if available, otherwise memory)
  const key = await visitorKey(form);
  let allowed = true;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { data: ok, error } = await createAdminClient().rpc("check_rate_limit", {
        p_key: key,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      });
      if (!error) allowed = ok === true;
    } catch {
      allowed = memoryLimit(key, limit, windowSeconds);
    }
  } else {
    allowed = memoryLimit(key, limit, windowSeconds);
  }
  if (!allowed) return false;

  // 3. Turnstile (optional)
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (secret) {
    const token = String(data.get("cf-turnstile-response") || "");
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token }),
    }).catch(() => null);
    const json = res ? ((await res.json()) as { success?: boolean }) : null;
    if (!json?.success) return false;
  }
  return true;
}

function memoryLimit(key: string, limit: number, windowSeconds: number) {
  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || entry.reset < now) {
    memory.set(key, { count: 1, reset: now + windowSeconds * 1000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}
