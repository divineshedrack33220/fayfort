import type { Metadata } from "next";
import { Quotes } from "@/components/portal/quotes";
import { getPortalQuotes } from "@/lib/data/portal";

export const metadata: Metadata = {
  title: "Quotes",
  description:
    "Review, approve or decline the Fayfort quotes on your sourcing requests, and see your full quote history.",
};

export default async function QuotesPage() {
  const quotes = await getPortalQuotes();
  return <Quotes quotes={quotes} />;
}