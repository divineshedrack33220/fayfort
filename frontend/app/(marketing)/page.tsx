import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { About } from "@/components/marketing/about";
import { TrustBand } from "@/components/marketing/trust-band";
import { PwaLaunchRedirect } from "@/components/marketing/pwa-launch-redirect";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Know what your China purchase will really cost",
  description:
    "Get accurate landed-cost estimates and find verified suppliers with transparent pricing. Fayfort helps businesses across Africa source efficiently.",
};

export default async function HomePage() {
  const session = await getSession();
  if (session?.role === "admin") redirect("/admin");
  if (session?.role === "customer") redirect("/overview");

  return (
    <>
      <PwaLaunchRedirect />
      <Hero />
      <HowItWorks />
      <About />
      <TrustBand />
    </>
  );
}