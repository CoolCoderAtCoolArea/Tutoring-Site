import { createClient } from "@/lib/supabase/server";
import { buildIcs } from "@/lib/ics";
import { site, siteUrl } from "@/config/site";

/** "Add to calendar" download. Only works for people allowed to see the booking (RLS). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: b } = await supabase.from("bookings").select("id, starts_at, ends_at, subject, mode, status, meeting_link").eq("id", id).maybeSingle();
  if (!b) return new Response("Not found. Please log in first.", { status: 404 });
  const ics = buildIcs({
    uid: `${b.id}@${new URL(siteUrl()).hostname}`,
    start: new Date(b.starts_at),
    end: new Date(b.ends_at),
    title: `Tutoring: ${b.subject} (${site.name})`,
    location: b.mode === "online" ? b.meeting_link ?? "Online" : site.inPersonLocation,
    url: siteUrl("/dashboard"),
    cancelled: b.status === "cancelled",
  });
  return new Response(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="tutoring-session.ics"', "Cache-Control": "private, no-store" },
  });
}
