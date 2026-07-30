import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Suspense fallback for the access log (/admin/logs) while the Server
 * Component fetches recent authentication events.
 */
export default function AccessLogLoading() {
  return (
    <div className="rounded-xl border border-bg-3 bg-bg-1">
      <div className="border-b border-bg-3 px-4 py-3">
        <Skeleton className="h-4 w-24" />
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-bg-3 px-4 py-4 last:border-0"
        >
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
      ))}
    </div>
  );
}
