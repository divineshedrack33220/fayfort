import type { Metadata } from "next";
import { MyRequests } from "@/components/portal/my-requests";
import { getPortalRequests } from "@/lib/data/portal";

export const metadata: Metadata = {
  title: "My Requests — sourcing requests",
  description:
    "Track your sourcing requests and view updates from the Fayfort team — status, quotes and delivery progress.",
};

export default async function MyRequestsPage() {
  const requests = await getPortalRequests();
  return <MyRequests requests={requests} />;
}