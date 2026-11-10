import { createAdminClient } from "@/lib/supabase/admin";
import { emailReminder } from "@/lib/notify";

/**
 * Sends reminder emails ~24 hours before each session.
 * Called once an hour by netlify/functions/reminders.mts (or any cron service)
 * with the header  Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const db = createAdminClient();
  const now = Date.now();
  const { data: due, error } = await db
    .from("bookings")
    .select("id")
    .eq("status", "booked")
    .is("reminder_sent_at", null)
    .gte("starts_at", new Date(now + 22 * 3_600_000).toISOString())
    .lte("starts_at", new Date(now + 26 * 3_600_000).toISOString());
  if (error) return Response.json({ error: error.message }, { status: 500 });

  let sent = 0;
  for (const b of due ?? []) {
    // Mark first, so a slow email never causes a double reminder.
    const { data: claimed } = await db.from("bookings").update({ reminder_sent_at: new Date().toISOString() }).eq("id", b.id).is("reminder_sent_at", null).select("id");
    if (!claimed?.length) continue;
    await emailReminder(b.id);
    sent++;
  }
  return Response.json({ sent });
}
