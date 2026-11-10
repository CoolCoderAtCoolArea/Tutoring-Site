import "server-only";
import { createPublicClient } from "@/lib/supabase/public";

/** One open time a family can book. Comes from the database function get_open_slots. */
export type OpenSlot = {
  tutor_id: string;
  tutor_name: string;
  starts_at: string;
  ends_at: string;
  subjects: string[];
  modes: string[];
};

export type SlotFilters = { subject?: string; grade?: string; mode?: string; tutor?: string };

/** Open slots for the next `days` days. Returns null if the database isn't set up yet. */
export async function getOpenSlots(filters: SlotFilters, days = 14): Promise<OpenSlot[] | null> {
  const db = createPublicClient();
  if (!db) return null;
  const from = new Date();
  const to = new Date(from.getTime() + days * 86_400_000);
  const { data, error } = await db.rpc("get_open_slots", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
    p_subject: filters.subject || null,
    p_mode: filters.mode || null,
    p_grade: filters.grade || null,
    p_tutor: filters.tutor || null,
  });
  if (error) {
    console.error("get_open_slots failed", error.message);
    return [];
  }
  return (data ?? []) as OpenSlot[];
}
