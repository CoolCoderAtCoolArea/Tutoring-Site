import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { DashNav } from "@/components/dashboard/DashNav";
import { Container } from "@/components/ui/Layout";
import { requireUser, type Role } from "@/lib/auth";
import { signOut } from "@/lib/actions/auth";

// Dashboards are personal: never cache them, never index them.
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

const menus: Record<Role, { href: string; key: string; icon: string }[]> = {
  parent: [
    { href: "/dashboard/parent", key: "home", icon: "🏠" },
    { href: "/dashboard/parent/book", key: "book", icon: "📅" },
    { href: "/dashboard/parent/children", key: "children", icon: "👧" },
    { href: "/dashboard/parent/data", key: "data", icon: "🔒" },
  ],
  student: [
    { href: "/dashboard/student", key: "home", icon: "🏠" },
    { href: "/dashboard/student/assignments", key: "assignments", icon: "📝" },
    { href: "/dashboard/student/quizzes", key: "quizzes", icon: "🧩" },
  ],
  tutor: [
    { href: "/dashboard/tutor", key: "home", icon: "🏠" },
    { href: "/dashboard/tutor/availability", key: "availability", icon: "🗓️" },
    { href: "/dashboard/tutor/students", key: "students", icon: "👥" },
    { href: "/dashboard/tutor/assignments", key: "assignments", icon: "📝" },
    { href: "/dashboard/tutor/quizzes", key: "quizzes", icon: "🧩" },
    { href: "/dashboard/tutor/help", key: "help", icon: "🙋" },
    { href: "/dashboard/tutor/profile", key: "profile", icon: "🪪" },
  ],
  admin: [
    { href: "/dashboard/admin", key: "home", icon: "📊" },
    { href: "/dashboard/admin/users", key: "users", icon: "👥" },
    { href: "/dashboard/admin/bookings", key: "bookings", icon: "📅" },
    { href: "/dashboard/admin/content", key: "content", icon: "✏️" },
    { href: "/dashboard/admin/inbox", key: "inbox", icon: "📥" },
    { href: "/dashboard/tutor/quizzes", key: "quizzes", icon: "🧩" },
  ],
};

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const t = await getTranslations("dash");
  const ta = await getTranslations("auth");
  const menu = user.role === "tutor" && !user.approved ? menus.tutor.filter((m) => m.key === "profile") : menus[user.role];
  return (
    <div className="bg-paper">
      <div className="no-print bg-brand-soft">
        <Container className="flex flex-wrap items-center justify-between gap-2 py-2">
          <p className="font-bold">{t("hello", { name: user.display_name || "👋" })}</p>
          <form action={signOut}>
            <button type="submit" className="inline-flex min-h-11 items-center rounded-lg px-3 font-semibold underline">
              {ta("logout")}
            </button>
          </form>
        </Container>
      </div>
      <DashNav label={t("nav")} items={menu.map((m) => ({ href: m.href, icon: m.icon, label: t(`menu.${m.key}`) }))} />
      <Container className="py-6">{children}</Container>
    </div>
  );
}
