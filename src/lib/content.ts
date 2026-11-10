import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
import { defaultResources } from "@/config/resources";
import { loc, type LocalizedText } from "@/lib/localized";

/**
 * Read public site content (FAQ, resources, testimonials, tutors, banner).
 * Every function falls back to built-in sample content if the database is
 * not set up yet or can't be reached, so the public site never breaks.
 */

export type PublicTutor = {
  tutor_id: string;
  public_name: string;
  bio: string;
  subjects: string[];
  grades: string;
  fun_fact: string;
  photo_url: string | null;
  formats: string[];
  languages: string;
};

export const placeholderTutors: PublicTutor[] = [
  { tutor_id: "placeholder-1", public_name: "[Tutor 1 Name]", bio: "[PLACEHOLDER] Short bio: school, grade, and why you love tutoring.", subjects: ["math", "science"], grades: "K–8", fun_fact: "[PLACEHOLDER] A fun fact about you.", photo_url: null, formats: ["in_person", "online"], languages: "English" },
  { tutor_id: "placeholder-2", public_name: "[Tutor 2 Name]", bio: "[PLACEHOLDER] Short bio: school, grade, and why you love tutoring.", subjects: ["reading", "writing"], grades: "K–12", fun_fact: "[PLACEHOLDER] A fun fact about you.", photo_url: null, formats: ["in_person", "online"], languages: "English" },
];

export async function getAnnouncement(locale: string): Promise<string | null> {
  const db = createPublicClient();
  if (!db) return null;
  try {
    const { data } = await db
      .from("announcements")
      .select("message")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ? loc(data.message as LocalizedText, locale) || null : null;
  } catch {
    return null;
  }
}

export async function getFaqs(locale: string, fallback: { q: string; a: string }[], homeOnly = false) {
  const db = createPublicClient();
  if (!db) return homeOnly ? fallback.slice(0, 4) : fallback;
  try {
    let query = db.from("faqs").select("question, answer, show_on_home").eq("published", true).order("sort_order");
    if (homeOnly) query = query.eq("show_on_home", true);
    const { data, error } = await query;
    if (error || !data?.length) return homeOnly ? fallback.slice(0, 4) : fallback;
    return data.map((f) => ({ q: loc(f.question as LocalizedText, locale), a: loc(f.answer as LocalizedText, locale) }));
  } catch {
    return homeOnly ? fallback.slice(0, 4) : fallback;
  }
}

export type PublicResource = { title: string; description: string; url: string; subject: string; grade_band: string };

export async function getResources(locale: string): Promise<PublicResource[]> {
  const fallback = defaultResources.map((r) => ({ ...r, title: loc(r.title, locale), description: loc(r.description, locale) }));
  const db = createPublicClient();
  if (!db) return fallback;
  try {
    const { data, error } = await db
      .from("resources")
      .select("title, description, url, subject, grade_band")
      .eq("published", true)
      .order("sort_order");
    if (error || !data?.length) return fallback;
    return data.map((r) => ({
      ...r,
      title: loc(r.title as LocalizedText, locale),
      description: loc(r.description as LocalizedText, locale),
    }));
  } catch {
    return fallback;
  }
}

export type PublicTestimonial = { quote: string; attribution: string; is_placeholder: boolean };

export async function getTestimonials(locale: string): Promise<PublicTestimonial[]> {
  const fallback: PublicTestimonial[] = [
    { quote: "[PLACEHOLDER] A short quote from a real parent, used with their permission.", attribution: "[PLACEHOLDER] Parent of a 3rd grader", is_placeholder: true },
    { quote: "[PLACEHOLDER] A short quote from a real student, used with a parent's permission.", attribution: "[PLACEHOLDER] 7th grade student", is_placeholder: true },
  ];
  const db = createPublicClient();
  if (!db) return fallback;
  try {
    const { data, error } = await db
      .from("testimonials")
      .select("quote, attribution, is_placeholder")
      .eq("published", true)
      .order("sort_order");
    if (error || !data?.length) return fallback;
    return data.map((t) => ({ ...t, quote: loc(t.quote as LocalizedText, locale) }));
  } catch {
    return fallback;
  }
}

export async function getPublicTutors(): Promise<PublicTutor[]> {
  const db = createPublicClient();
  if (!db) return placeholderTutors;
  try {
    const { data, error } = await db
      .from("tutor_profiles")
      .select("tutor_id, public_name, bio, subjects, grades, fun_fact, photo_url, formats, languages")
      .eq("published", true)
      .order("public_name");
    if (error || !data?.length) return placeholderTutors;
    return data as PublicTutor[];
  } catch {
    return placeholderTutors;
  }
}
