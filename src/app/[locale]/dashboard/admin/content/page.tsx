import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/forms/ActionForm";
import { Checkbox, Select, TextArea, TextField } from "@/components/ui/Field";
import { Card } from "@/components/ui/Layout";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { clearAnnouncement, deleteContent, saveAnnouncement, saveContent } from "@/lib/actions/admin";
import { locales, localeNames } from "@/i18n/config";
import { subjectOptions } from "@/lib/options";
import { loc, type LocalizedText } from "@/lib/localized";

/** One input per language (English, Español, …). Adding a language adds a box automatically. */
function LocalizedFields({ field, label, values, long, id }: { field: string; label: string; values?: LocalizedText; long?: boolean; id: string }) {
  return (
    <fieldset className="mb-2 rounded-lg border border-line p-3">
      <legend className="px-1 font-semibold">{label}</legend>
      {locales.map((l) =>
        long ? (
          <TextArea key={l} label={localeNames[l]} name={`${field}_${l}`} id={`${id}-${field}-${l}`} rows={3} defaultValue={values?.[l] ?? ""} lang={l} required={l === "en"} />
        ) : (
          <TextField key={l} label={localeNames[l]} name={`${field}_${l}`} id={`${id}-${field}-${l}`} defaultValue={values?.[l] ?? ""} lang={l} required={l === "en"} />
        ),
      )}
    </fieldset>
  );
}

type Row = Record<string, unknown> & { id: string; sort_order: number; published: boolean };

export default async function AdminContent({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireUser(["admin"]);
  const t = await getTranslations("admin");
  const tc = await getTranslations("common");
  const ts = await getTranslations("subjects");
  const supabase = await createClient();
  const [{ data: banner }, { data: faqs }, { data: resources }, { data: testimonials }] = await Promise.all([
    supabase.from("announcements").select("*").eq("active", true).maybeSingle(),
    supabase.from("faqs").select("*").order("sort_order"),
    supabase.from("resources").select("*").order("sort_order"),
    supabase.from("testimonials").select("*").order("sort_order"),
  ]);

  const common = (r?: Row) => (
    <div className="grid gap-x-4 sm:grid-cols-2">
      <TextField label={t("order")} name="sort_order" type="number" defaultValue={String(r?.sort_order ?? 0)} id={`so-${r?.id ?? "new"}`} />
      <Select label={t("visible")} name="published" defaultValue={r?.published === false ? "no" : "yes"} id={`pub-${r?.id ?? "new"}`} options={[{ value: "yes", label: tc("yes") }, { value: "no", label: tc("no") }]} />
    </div>
  );

  const editor = (table: string, rows: Row[], title: (r: Row) => string, fields: (r?: Row) => ReactNode) => (
    <>
      <ul className="space-y-2">
        {rows.map((r) => (
          <Card as="li" key={r.id}>
            <details>
              <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold">{title(r)}{r.published === false ? ` (${t("hidden")})` : ""}</summary>
              <ActionForm action={saveContent} submitLabel={tc("save")} pendingLabel={tc("saving")} resetOnSuccess={false} className="mt-2">
                <input type="hidden" name="table" value={table} />
                <input type="hidden" name="id" value={r.id} />
                {fields(r)}
                {common(r)}
              </ActionForm>
              <form action={deleteContent} className="mt-2">
                <input type="hidden" name="table" value={table} /><input type="hidden" name="id" value={r.id} />
                <ConfirmButton variant="ghost" confirm={t("confirmDelete")}>{tc("delete")}</ConfirmButton>
              </form>
            </details>
          </Card>
        ))}
      </ul>
      <Card className="mt-3 bg-brand-soft">
        <details>
          <summary className="inline-flex min-h-11 cursor-pointer items-center font-bold">+ {t("addNew")}</summary>
          <ActionForm action={saveContent} submitLabel={t("add")} pendingLabel={tc("saving")} className="mt-2">
            <input type="hidden" name="table" value={table} />
            {fields()}
            {common()}
          </ActionForm>
        </details>
      </Card>
    </>
  );

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-extrabold">{t("contentTitle")}</h1>
      <p className="mt-2 text-lg">{t("contentIntro")}</p>

      <section className="mt-8" aria-labelledby="banner">
        <h2 id="banner" className="mb-2 text-2xl font-bold">📣 {t("banner")}</h2>
        {banner ? (
          <Alert tone="info" title={t("bannerNow")}>
            {loc(banner.message, locale)}
            <form action={clearAnnouncement} className="mt-2"><Button type="submit" variant="secondary">{t("bannerOff")}</Button></form>
          </Alert>
        ) : <p className="mb-2 text-muted">{t("noBanner")}</p>}
        <Card>
          <ActionForm action={saveAnnouncement} submitLabel={t("bannerSet")} pendingLabel={tc("saving")}>
            <LocalizedFields field="message" label={t("bannerMessage")} id="banner" />
          </ActionForm>
        </Card>
      </section>

      <section className="mt-10" aria-labelledby="faq">
        <h2 id="faq" className="mb-2 text-2xl font-bold">❓ {t("faqs")}</h2>
        {editor("faqs", (faqs ?? []) as Row[], (r) => loc(r.question as LocalizedText, locale), (r) => (
          <>
            <LocalizedFields field="question" label={t("question")} values={r?.question as LocalizedText} id={`faq-${r?.id ?? "new"}`} />
            <LocalizedFields field="answer" label={t("answer")} values={r?.answer as LocalizedText} long id={`faq-${r?.id ?? "new"}`} />
            <Checkbox name="show_on_home" value="yes" defaultChecked={Boolean(r?.show_on_home)} label={t("showOnHome")} id={`home-${r?.id ?? "new"}`} />
          </>
        ))}
      </section>

      <section className="mt-10" aria-labelledby="res">
        <h2 id="res" className="mb-2 text-2xl font-bold">🔗 {t("resources")}</h2>
        {editor("resources", (resources ?? []) as Row[], (r) => loc(r.title as LocalizedText, locale), (r) => (
          <>
            <LocalizedFields field="title" label={t("resTitle")} values={r?.title as LocalizedText} id={`res-${r?.id ?? "new"}`} />
            <LocalizedFields field="description" label={t("resDescription")} values={r?.description as LocalizedText} long id={`res-${r?.id ?? "new"}`} />
            <TextField label="URL" name="url" type="url" required defaultValue={String(r?.url ?? "https://")} id={`url-${r?.id ?? "new"}`} />
            <div className="grid gap-x-4 sm:grid-cols-2">
              <Select label={tc("subject")} name="subject" options={subjectOptions(ts)} defaultValue={String(r?.subject ?? "homework")} id={`sub-${r?.id ?? "new"}`} />
              <TextField label={t("gradeBand")} name="grade_band" defaultValue={String(r?.grade_band ?? "K–12")} id={`gb-${r?.id ?? "new"}`} />
            </div>
          </>
        ))}
      </section>

      <section className="mt-10" aria-labelledby="test">
        <h2 id="test" className="mb-2 text-2xl font-bold">💬 {t("testimonials")}</h2>
        <Alert tone="warning">{t("testimonialRule")}</Alert>
        {editor("testimonials", (testimonials ?? []) as Row[], (r) => loc(r.quote as LocalizedText, locale).slice(0, 80), (r) => (
          <>
            <LocalizedFields field="quote" label={t("quote")} values={r?.quote as LocalizedText} long id={`t-${r?.id ?? "new"}`} />
            <TextField label={t("attribution")} name="attribution" required defaultValue={String(r?.attribution ?? "")} hint={t("attributionHint")} id={`att-${r?.id ?? "new"}`} />
            <Checkbox name="is_placeholder" value="yes" defaultChecked={Boolean(r?.is_placeholder)} label={t("isPlaceholder")} id={`ph-${r?.id ?? "new"}`} />
          </>
        ))}
      </section>
    </div>
  );
}
