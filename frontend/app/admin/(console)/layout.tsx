import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: { default: "Staff console — Fayfort Admin", template: "%s — Fayfort Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!isAdmin(session)) {
    redirect("/admin/login");
  }
  return (
    <AdminShell session={session}>
      {children}
    </AdminShell>
  );
}