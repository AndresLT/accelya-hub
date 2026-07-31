import { Skeleton } from "@/components/ui/Skeleton";

/** Suspense fallback for the admin parking occupancy view. */
export default function AdminParkingLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-10 w-44" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-bg-3 bg-bg-1 p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-8 w-16" />
            <Skeleton className="mt-3 h-2 w-full" />
          </div>
        ))}
      </div>

      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
