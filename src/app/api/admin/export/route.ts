import { createClient } from "@/lib/supabase/server";

/** Admin-only CSV downloads (open in Excel or Google Sheets). RLS makes sure only admins get rows. */
const exports: Record<string, { table: string; columns: string; order: string }> = {
  bookings: { table: "bookings", columns: "id, starts_at, ends_at, subject, mode, status, is_intro, tutor_id, student_id, parent_id, cancel_reason, created_at", order: "starts_at" },
  users: { table: "profiles", columns: "id, role, approved, display_name, email, preferred_locale, created_at", order: "created_at" },
  students: { table: "students", columns: "id, nickname, grade, subjects, parent_id, created_at", order: "created_at" },
  applications: { table: "tutor_applications", columns: "created_at, name, email, subjects, grades, availability, why, status", order: "created_at" },
  quiz_attempts: { table: "quiz_attempts", columns: "id, quiz_id, student_id, status, score, max_score, started_at, submitted_at", order: "started_at" },
};

function cell(v: unknown) {
  const s = v === null || v === undefined ? "" : Array.isArray(v) ? v.join("; ") : String(v);
  // Quote everything; also stop spreadsheet formula injection (=, +, -, @ at the start).
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const type = new URL(request.url).searchParams.get("type") ?? "";
  const cfg = exports[type];
  if (!cfg) return new Response("Unknown export", { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Please log in.", { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return new Response("Admins only.", { status: 403 });
  const { data, error } = await supabase.from(cfg.table).select(cfg.columns).order(cfg.order).limit(10000);
  if (error) return new Response(error.message, { status: 500 });
  const cols = cfg.columns.split(",").map((c) => c.trim());
  const rows = (data as unknown as Record<string, unknown>[]) ?? [];
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n");
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
