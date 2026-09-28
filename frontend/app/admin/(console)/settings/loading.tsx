import { PageSkeleton } from "@/components/portal/page-skeleton";

export default function AdminLoading() {
  return <PageSkeleton variant="list" rows={4} />;
}
