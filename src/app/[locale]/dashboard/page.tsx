import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { dashboardPath, requireUser } from "@/lib/auth";

/** /dashboard sends each person to the right dashboard for their role. */
export default async function DashboardIndex() {
  const user = await requireUser();
  const locale = await getLocale();
  if (user.role === "tutor" && !user.approved) redirect({ href: "/dashboard/pending", locale });
  redirect({ href: dashboardPath(user.role), locale });
}
