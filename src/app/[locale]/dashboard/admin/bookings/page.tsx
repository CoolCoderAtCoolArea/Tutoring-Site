import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ActionForm } from "@/components/forms/ActionForm";
import { TextField } from "@/components/ui/Field";
import { Card, EmptyState, Tag } from "@/components/ui/Layout";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cancelSession } from "@/lib/actions/booking";
import { formatDateTime } from "@/lib/time";
import { formatLabel } from "@/lib/labels";

export default async function AdminBookings({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ show?: string }> }) {
  const { locale } = await params;
  const { show } = await searchParams;
  await requireUser(["admin"]);
  const t = await getTranslations("admin");
  const tb = await getTranslations("booking");
  const tc = await getTranslations("common");
  const ts = await getTranslations("subjects");
  const past = show === "past";
  const supabase = await createClient();
  let q = supabase.from("bookings").select("*, students(nickname)").order("starts_at", { ascending: !past }).limit(200);
  q = past ? q.lt("starts_at", new Date().toISOString()) : q.gte("ends_at", new Date().toISOString());
  const [{ data }, { data: tutors }] = await Promise.all([q, supabase.from("tutor_profiles").select("tutor_id, public_name")]);
  const name = (id: string) => tutors?.find((x) => x.tutor_id === id)?.public_name ?? "—";
  return (
    <div>
      <h1 className="text-3xl font-extrabold">{t("bookingsTitle")}</h1>
      <p className="mt-2 flex gap-2">
        <Link href="/dashboard/admin/bookings" aria-current={!past ? "page" : undefined} className="inline-flex min-h-11 items-center rounded-lg border-2 border-brand px-3 font-semibold no-underline aria-[current=page]:bg-brand aria-[current=page]:text-white">{t("upcoming")}</Link>
        <Link href="/dashboard/admin/bookings?show=past" aria-current={past ? "page" : undefined} className="inline-flex min-h-11 items-center rounded-lg border-2 border-brand px-3 font-semibold no-underline aria-[current=page]:bg-brand aria-[current=page]:text-white">{t("past")}</Link>
        <a href="/api/admin/export?type=bookings" className="inline-flex min-h-11 items-center px-3 font-semibold">⬇️ CSV</a>
      </p>
      {!data?.length ? <div className="mt-6"><EmptyState>{t("noData")}</EmptyState></div> : (
        <ul className="mt-6 space-y-3">
          {data.map((b) => (
            <Card as="li" key={b.id}>
              <p className="font-bold">{formatDateTime(b.starts_at, locale)} <Tag>{tb(`statuses.${b.status}`)}</Tag></p>
              <p>{(b.students as { nickname: string } | null)?.nickname} · {ts.has(`names.${b.subject}`) ? ts(`names.${b.subject}`) : b.subject} · {tb("withTutor", { tutor: name(b.tutor_id) })} · {formatLabel(tc, b.mode)}</p>
              {b.cancel_reason ? <p className="text-sm text-muted">{tb("reason")}: {b.cancel_reason}</p> : null}
              {b.status === "booked" ? (
                <details className="mt-2">
                  <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand underline">{tb("cancel")}</summary>
                  <ActionForm action={cancelSession} submitLabel={tb("cancelIt")} pendingLabel={tc("saving")} submitVariant="danger" className="mt-2">
                    <input type="hidden" name="id" value={b.id} />
                    <TextField label={tb("reason")} name="reason" required id={`r-${b.id}`} />
                  </ActionForm>
                </details>
              ) : null}
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
