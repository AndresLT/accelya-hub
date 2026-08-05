import { Skeleton } from "@/components/ui/Skeleton";

/** Suspense fallback for the room booking page. */
export default function RoomsLoading() {
  return (
    <section>
      <Skeleton className="mb-4 h-4 w-24" />
      <Skeleton className="mb-2 h-7 w-44" />
      <Skeleton className="mb-6 h-4 w-80" />
      <Skeleton className="mb-6 h-11 w-56" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-bg-3 bg-bg-1 p-5">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="mt-4 h-8 w-full" />
            <Skeleton className="mt-2 h-8 w-full" />
            <Skeleton className="mt-4 h-9 w-full" />
          </div>
        ))}
      </div>
    </section>
  );
}
