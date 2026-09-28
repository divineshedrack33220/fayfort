import type { Metadata } from "next";
import { SettingsPanel } from "@/components/portal/settings";

export const metadata: Metadata = {
  title: "Settings",
  description:
    "Your notification preferences and default sourcing settings.",
};

export default function SettingsPage() {
  return <SettingsPanel />;
}