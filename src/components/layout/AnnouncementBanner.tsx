import { getTranslations } from "next-intl/server";
import { getAnnouncement } from "@/lib/content";

/** Site-wide banner (e.g. "No sessions over winter break"). Edited by admins. */
export async function AnnouncementBanner({ locale }: { locale: string }) {
  const message = await getAnnouncement(locale);
  if (!message) return null;
  const t = await getTranslations("announcement");
  return (
    <div className="bg-coral text-white" role="region" aria-label={t("label")}>
      <p className="mx-auto max-w-5xl px-4 py-2 font-semibold sm:px-6">
        <span aria-hidden="true">📣 </span>
        {message}
      </p>
    </div>
  );
}
