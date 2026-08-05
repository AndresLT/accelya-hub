import { Skeleton } from "@/components/ui/Skeleton";

/** Suspense fallback for the admin room occupancy view. */
export default function AdminRoomsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-10 w-44" />
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}
