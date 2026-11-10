import "server-only";
import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { buildIcs } from "@/lib/ics";
import { formatDateTime } from "@/lib/time";
import { site, siteUrl } from "@/config/site";
import { routing } from "@/i18n/routing";

/**
 * Booking emails: confirmation, cancellation, reminder.
 * Emails go to the PARENT (never to the child) in the parent's language,
 * and to the tutor in theirs. Only the child's nickname is included.
 */
type BookingInfo = {
  id: string;
  starts_at: string;
  ends_at: string;
  subject: string;
  mode: string;
  meeting_link: string | null;
  cancel_reason: string | null;
  parent: { email: string | null; display_name: string; preferred_locale: string };
  tutor: { email: string | null; display_name: string; preferred_locale: string };
  tutorName: string;
  studentName: string;
};

export async function loadBooking(id: string): Promise<BookingInfo | null> {
  const db = createAdminClient();
  const { data: b } = await db
    .from("bookings")
    .select("id, starts_at, ends_at, subject, mode, meeting_link, cancel_reason, parent_id, tutor_id, students(nickname)")
    .eq("id", id)
    .maybeSingle();
  if (!b) return null;
  const { data: people } = await db.from("profiles").select("id, email, display_name, preferred_locale").in("id", [b.parent_id, b.tutor_id]);
  const { data: tp } = await db.from("tutor_profiles").select("public_name").eq("tutor_id", b.tutor_id).maybeSingle();
  const find = (pid: string) => people?.find((p) => p.id === pid) ?? { email: null, display_name: "", preferred_locale: "en" };
  const tutor = find(b.tutor_id);
  return {
    ...b,
    parent: find(b.parent_id),
    tutor,
    tutorName: tp?.public_name || tutor.display_name,
    studentName: (b.students as unknown as { nickname: string } | null)?.nickname ?? "",
  };
}

function lang(l: string) {
  return (routing.locales as readonly string[]).includes(l) ? l : "en";
}

function where(b: BookingInfo, t: (k: string) => string) {
  return b.mode === "online" ? t("whereOnline") : `${t("whereInPerson")} ${site.inPersonLocation}`;
}

export async function emailBookingConfirmed(bookingId: string) {
  const b = await loadBooking(bookingId);
  if (!b) return;
  const locale = lang(b.parent.preferred_locale);
  const t = await getTranslations({ locale, namespace: "email" });
  const ts = await getTranslations({ locale, namespace: "subjects" });
  const subject = ts.has(`names.${b.subject}`) ? ts(`names.${b.subject}`) : b.subject;
  const when = formatDateTime(b.starts_at, locale);
  const link = siteUrl(`${locale === "en" ? "" : `/${locale}`}/dashboard/parent/sessions/${b.id}`);
  const ics = buildIcs({
    uid: `${b.id}@${new URL(siteUrl()).hostname}`,
    start: new Date(b.starts_at),
    end: new Date(b.ends_at),
    title: `${subject} — ${b.studentName} (${site.name})`,
    location: b.mode === "online" ? "Online" : site.inPersonLocation,
    url: link,
  });
  if (b.parent.email) {
    await sendEmail({
      to: b.parent.email,
      subject: t("confirmedSubject", { when }),
      text: t("confirmedBody", { name: b.parent.display_name, student: b.studentName, subject, when, tutor: b.tutorName, where: where(b, t), link, calendar: siteUrl(`/api/ics/${b.id}`) }),
      attachments: [{ filename: "session.ics", content: ics, contentType: "text/calendar" }],
    });
  }
  if (b.tutor.email) {
    const tl = lang(b.tutor.preferred_locale);
    const tt = await getTranslations({ locale: tl, namespace: "email" });
    await sendEmail({
      to: b.tutor.email,
      subject: tt("tutorNewSubject", { when: formatDateTime(b.starts_at, tl) }),
      text: tt("tutorNewBody", { student: b.studentName, subject, when: formatDateTime(b.starts_at, tl), link: siteUrl(`/dashboard/tutor/sessions/${b.id}`) }),
      attachments: [{ filename: "session.ics", content: ics, contentType: "text/calendar" }],
    });
  }
}

export async function emailBookingCancelled(bookingId: string, cancelledBy: string) {
  const b = await loadBooking(bookingId);
  if (!b) return;
  // Tell the OTHER side. Tutor cancellations always tell the parent (with the reason).
  const toParent = cancelledBy !== "parent";
  const person = toParent ? b.parent : b.tutor;
  if (!person.email) return;
  const locale = lang(person.preferred_locale);
  const t = await getTranslations({ locale, namespace: "email" });
  const ts = await getTranslations({ locale, namespace: "subjects" });
  const when = formatDateTime(b.starts_at, locale);
  await sendEmail({
    to: person.email,
    subject: t("cancelledSubject", { when }),
    text: t(toParent ? "cancelledByTutorBody" : "cancelledByFamilyBody", {
      name: person.display_name,
      student: b.studentName,
      subject: ts.has(`names.${b.subject}`) ? ts(`names.${b.subject}`) : b.subject,
      when,
      reason: b.cancel_reason ?? "—",
      link: siteUrl(locale === "en" ? "/book" : `/${locale}/book`),
    }),
  });
}

export async function emailReminder(bookingId: string) {
  const b = await loadBooking(bookingId);
  if (!b) return;
  for (const [person, role] of [[b.parent, "parent"], [b.tutor, "tutor"]] as const) {
    if (!person.email) continue;
    const locale = lang(person.preferred_locale);
    const t = await getTranslations({ locale, namespace: "email" });
    const ts = await getTranslations({ locale, namespace: "subjects" });
    const when = formatDateTime(b.starts_at, locale);
    const path = role === "parent" ? `/dashboard/parent/sessions/${b.id}` : `/dashboard/tutor/sessions/${b.id}`;
    await sendEmail({
      to: person.email,
      subject: t("reminderSubject", { when }),
      text: t("reminderBody", {
        name: person.display_name,
        student: b.studentName,
        subject: ts.has(`names.${b.subject}`) ? ts(`names.${b.subject}`) : b.subject,
        when,
        where: where(b, t),
        link: siteUrl((locale === "en" ? "" : `/${locale}`) + path),
      }),
    });
  }
}
