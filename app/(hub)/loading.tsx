import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Suspense fallback for the app catalog (/). Shown instantly on navigation
 * while the Server Component fetches the user's assigned apps.
 */
export default function CatalogLoading() {
  return (
    <section>
      <Skeleton className="mb-2 h-7 w-40" />
      <Skeleton className="mb-6 h-4 w-72" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-bg-3 bg-bg-1 p-5">
            <Skeleton className="mb-3 h-5 w-32" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
    </section>
  );
}
