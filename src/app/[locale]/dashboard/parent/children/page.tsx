import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/forms/ActionForm";
import { ChoiceGroup, Select, TextField } from "@/components/ui/Field";
import { Card, EmptyState } from "@/components/ui/Layout";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { Alert } from "@/components/ui/Alert";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addChild, createChildLogin, removeChild, removeChildLogin, updateChild } from "@/lib/actions/parent";
import { gradeOptions, subjectOptions } from "@/lib/options";
import { gradeLabel } from "@/lib/labels";
import type { Student } from "@/lib/types";

export default async function ChildrenPage() {
  const user = await requireUser(["parent"]);
  const t = await getTranslations("parent");
  const tc = await getTranslations("common");
  const ts = await getTranslations("subjects");
  const supabase = await createClient();
  const { data } = await supabase.from("students").select("*").eq("parent_id", user.id).order("created_at");
  const children = (data ?? []) as Student[];

  const childFields = (c?: Student) => (
    <>
      <TextField label={t("nickname")} name="nickname" required maxLength={40} hint={t("nicknameHint")} defaultValue={c?.nickname} id={`nick-${c?.id ?? "new"}`} />
      <Select label={tc("grade")} name="grade" required options={gradeOptions(tc)} defaultValue={c?.grade ?? ""} placeholder="—" id={`grade-${c?.id ?? "new"}`} />
      <ChoiceGroup legend={t("needsHelpWith")} name="subjects" options={subjectOptions(ts)} defaultValue={c?.subjects} />
    </>
  );

  return (
    <div>
      <h1 className="text-3xl font-extrabold">{t("childrenTitle")}</h1>
      <p className="mt-2 text-lg">{t("childrenIntro")}</p>
      <Alert tone="info">{t("privacyNote")}</Alert>

      {children.length === 0 ? <EmptyState>{t("noChildren")}</EmptyState> : null}

      <ul className="mt-6 space-y-6">
        {children.map((c) => (
          <Card as="li" key={c.id}>
            <h2 className="text-2xl font-bold">
              {c.nickname} <span className="text-lg font-normal text-muted">· {gradeLabel(tc, c.grade)}</span>
            </h2>

            <details className="mt-3">
              <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand underline">{t("editChild")}</summary>
              <ActionForm action={updateChild} submitLabel={tc("save")} pendingLabel={tc("saving")} resetOnSuccess={false} className="mt-3">
                <input type="hidden" name="id" value={c.id} />
                {childFields(c)}
              </ActionForm>
            </details>

            <section className="mt-4 rounded-xl bg-sun-soft p-4" aria-labelledby={`login-${c.id}`}>
              <h3 id={`login-${c.id}`} className="text-lg font-bold">{t("childLogin")}</h3>
              {c.user_id ? (
                <>
                  <p className="mt-1">
                    {t("loginExists")} <strong className="font-mono">{c.username}</strong>
                  </p>
                  <p className="text-muted">{t("loginHowTo")}</p>
                  <ActionForm action={createChildLogin} submitLabel={t("changePin")} pendingLabel={tc("saving")} className="mt-3">
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="username" value={c.username ?? ""} />
                    <TextField label={t("newPin")} name="pin" type="password" required inputMode="numeric" autoComplete="new-password" hint={t("pinRule")} id={`pin-${c.id}`} />
                  </ActionForm>
                  <form action={removeChildLogin} className="mt-3">
                    <input type="hidden" name="id" value={c.id} />
                    <ConfirmButton variant="ghost" confirm={t("confirmRemoveLogin")}>{t("removeLogin")}</ConfirmButton>
                  </form>
                </>
              ) : (
                <>
                  <p className="mt-1">{t("loginWhy")}</p>
                  <ActionForm action={createChildLogin} submitLabel={t("createLogin")} pendingLabel={tc("saving")} className="mt-3">
                    <input type="hidden" name="id" value={c.id} />
                    <TextField label={t("username")} name="username" required pattern="[a-z0-9_]{3,24}" autoCapitalize="none" spellCheck={false} hint={t("usernameRule")} id={`user-${c.id}`} />
                    <TextField label={t("pin")} name="pin" type="password" required inputMode="numeric" autoComplete="new-password" hint={t("pinRule")} id={`pin-${c.id}`} />
                  </ActionForm>
                </>
              )}
            </section>

            <form action={removeChild} className="mt-4">
              <input type="hidden" name="id" value={c.id} />
              <ConfirmButton variant="danger" confirm={t("confirmRemoveChild", { name: c.nickname })}>{t("removeChild")}</ConfirmButton>
            </form>
          </Card>
        ))}
      </ul>

      <Card className="mt-8">
        <h2 className="mb-3 text-2xl font-bold">{t("addChild")}</h2>
        <ActionForm action={addChild} submitLabel={t("addChild")} pendingLabel={tc("saving")} draftKey="add-child">
          {childFields()}
        </ActionForm>
      </Card>
    </div>
  );
}
