import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ActionForm } from "@/components/forms/ActionForm";
import { Checkbox, Select } from "@/components/ui/Field";
import { Card, EmptyState, Tag } from "@/components/ui/Layout";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteUser, linkTutorStudent, setUserRole } from "@/lib/actions/admin";
import { formatShortDate } from "@/lib/time";

type P = { id: string; role: string; approved: boolean; display_name: string; email: string | null; created_at: string };

export default async function AdminUsers({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ role?: string }> }) {
  const { locale } = await params;
  const { role } = await searchParams;
  const me = await requireUser(["admin"]);
  const t = await getTranslations("admin");
  const tc = await getTranslations("common");
  const supabase = await createClient();
  let query = supabase.from("profiles").select("id, role, approved, display_name, email, created_at").order("created_at", { ascending: false }).limit(300);
  if (role) query = query.eq("role", role);
  const [{ data }, { data: tutors }, { data: students }] = await Promise.all([
    query,
    supabase.from("profiles").select("id, display_name").eq("role", "tutor").eq("approved", true),
    supabase.from("students").select("id, nickname, grade").order("nickname").limit(500),
  ]);
  const users = (data ?? []) as P[];
  const pending = users.filter((u) => u.role === "tutor" && !u.approved);
  const roles = ["admin", "tutor", "parent", "student"];

  const row = (u: P) => (
    <Card as="li" key={u.id}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-lg font-bold">{u.display_name || "—"} <Tag>{t(`roles.${u.role}`)}</Tag> {u.role === "tutor" && !u.approved ? <Tag className="bg-sun-soft">{t("notApproved")}</Tag> : null}</p>
          <p className="text-sm text-muted">{u.email ?? t("studentLogin")} · {t("joined", { date: formatShortDate(u.created_at, locale) })}</p>
        </div>
      </div>
      {u.id !== me.id ? (
        <details className="mt-2" open={u.role === "tutor" && !u.approved}>
          <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand underline">{t("manage")}</summary>
          <ActionForm action={setUserRole} submitLabel={tc("save")} pendingLabel={tc("saving")} resetOnSuccess={false} className="mt-2">
            <input type="hidden" name="id" value={u.id} />
            <Select label={t("role")} name="role" id={`role-${u.id}`} defaultValue={u.role} options={roles.map((r) => ({ value: r, label: t(`roles.${r}`) }))} className="max-w-60" />
            <Checkbox name="approved" value="yes" defaultChecked={u.approved} label={t("approvedLabel")} id={`ap-${u.id}`} />
          </ActionForm>
          <form action={deleteUser} className="mt-3">
            <input type="hidden" name="id" value={u.id} />
            <ConfirmButton variant="danger" confirm={t("confirmDeleteUser", { name: u.display_name || u.email || "" })}>{t("deleteUser")}</ConfirmButton>
          </form>
        </details>
      ) : null}
    </Card>
  );

  return (
    <div>
      <h1 className="text-3xl font-extrabold">{t("usersTitle")}</h1>
      <nav aria-label={t("filter")} className="mt-3 flex flex-wrap gap-2">
        {["", ...roles].map((r) => (
          <Link key={r || "all"} href={r ? `/dashboard/admin/users?role=${r}` : "/dashboard/admin/users"} aria-current={(role ?? "") === r ? "page" : undefined}
            className="inline-flex min-h-11 items-center rounded-lg border-2 border-brand px-3 font-semibold no-underline aria-[current=page]:bg-brand aria-[current=page]:text-white">
            {r ? t(`roles.${r}`) : t("all")}
          </Link>
        ))}
      </nav>
      {pending.length ? (
        <section className="mt-6" aria-labelledby="pending">
          <h2 id="pending" className="mb-2 text-2xl font-bold">⏳ {t("approveTutors")}</h2>
          <p className="mb-3 text-muted">{t("approveIntro")}</p>
          <ul className="space-y-3">{pending.map(row)}</ul>
        </section>
      ) : null}
      <section className="mt-8" aria-labelledby="everyone">
        <h2 id="everyone" className="mb-3 text-2xl font-bold">{t("everyone")} ({users.length})</h2>
        {users.length ? <ul className="space-y-3">{users.filter((u) => !pending.includes(u)).map(row)}</ul> : <EmptyState>{t("noData")}</EmptyState>}
      </section>
      {tutors?.length && students?.length ? (
        <Card className="mt-8">
          <h2 className="text-xl font-bold">{t("linkTitle")}</h2>
          <p className="mb-3 text-muted">{t("linkIntro")}</p>
          <ActionForm action={linkTutorStudent} submitLabel={t("link")} pendingLabel={tc("saving")}>
            <div className="grid gap-x-4 sm:grid-cols-2">
              <Select label={t("tutor")} name="tutor_id" required options={tutors.map((x) => ({ value: x.id, label: x.display_name }))} placeholder="—" />
              <Select label={t("student")} name="student_id" required options={students.map((s) => ({ value: s.id, label: `${s.nickname} (${tc("gradeN", { grade: s.grade })})` }))} placeholder="—" />
            </div>
          </ActionForm>
        </Card>
      ) : null}
    </div>
  );
}
