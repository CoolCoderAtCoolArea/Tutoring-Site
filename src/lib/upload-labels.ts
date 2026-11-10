import { getTranslations } from "next-intl/server";

/** Translated words for the <FileUpload> component. */
export async function uploadLabels() {
  const t = await getTranslations("upload");
  return { uploading: t("uploading"), remove: t("remove"), tooBig: t("tooBig"), badType: t("badType"), failed: t("failed"), takePhoto: t("takePhoto") };
}
