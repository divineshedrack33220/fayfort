import { PageSkeleton } from "@/components/portal/page-skeleton";

export default function AdminMessagesLoading() {
  return <PageSkeleton variant="list" rows={4} />;
}