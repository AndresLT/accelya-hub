import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Suspense fallback for the users table (/admin) while the Server
 * Component loads users, apps and app-access rows.
 */
export default function UsersLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-28" />

      <div className="rounded-xl border border-bg-3 bg-bg-1">
        <div className="border-b border-bg-3 px-4 py-3">
          <Skeleton className="h-4 w-24" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-bg-3 px-4 py-4 last:border-0"
          >
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
