import type { Metadata } from "next";
import { AdminSettingsPanel } from "@/components/admin/admin-settings";

export const metadata: Metadata = { title: "Settings" };

export default function AdminSettingsPage() {
  return <AdminSettingsPanel />;
}