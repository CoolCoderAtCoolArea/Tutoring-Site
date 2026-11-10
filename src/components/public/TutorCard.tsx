import { getTranslations } from "next-intl/server";
import Image from "next/image";
import type { PublicTutor } from "@/lib/content";
import { Card, Tag } from "@/components/ui/Layout";
import { formatLabel } from "@/lib/labels";

export async function TutorCard({ tutor, compact = false }: { tutor: PublicTutor; compact?: boolean }) {
  const t = await getTranslations("about");
  const ts = await getTranslations("subjects");
  const tc = await getTranslations("common");
  const initials = tutor.public_name.replace(/[^A-Za-z\s]/g, "").split(/\s+/).map((w) => w[0]).join("").slice(0, 2) || "?";
  return (
    <Card as="li" className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        {tutor.photo_url ? (
          <Image
            src={tutor.photo_url}
            alt={t("photoAlt", { name: tutor.public_name })}
            width={96}
            height={96}
            loading="lazy"
            sizes="96px"
            className="size-24 rounded-full object-cover"
          />
        ) : (
          <div aria-hidden="true" className="flex size-24 items-center justify-center rounded-full bg-sun text-3xl font-extrabold">
            {initials}
          </div>
        )}
        <div>
          <h3 className="text-xl font-bold">{tutor.public_name}</h3>
          <p className="text-muted">
            {t("gradesLabel")}: {tutor.grades}
          </p>
          <p className="text-muted">{tutor.formats.map((f) => formatLabel(tc, f)).join(" · ")}</p>
        </div>
      </div>
      <div>
        <span className="sr-only">{t("subjectsLabel")}: </span>
        <ul className="flex flex-wrap gap-2">
          {tutor.subjects.map((s) => (
            <li key={s}>
              <Tag>{ts.has(`names.${s}`) ? ts(`names.${s}`) : s}</Tag>
            </li>
          ))}
        </ul>
      </div>
      {!compact ? (
        <>
          <p>{tutor.bio}</p>
          {tutor.fun_fact ? (
            <p>
              <strong>{t("funFact")}:</strong> {tutor.fun_fact}
            </p>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}
