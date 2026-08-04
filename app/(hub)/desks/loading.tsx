import { Skeleton } from "@/components/ui/Skeleton";

/** Suspense fallback for the desk booking page while the map loads. */
export default function DesksLoading() {
  return (
    <section>
      <Skeleton className="mb-4 h-4 w-24" />
      <Skeleton className="mb-2 h-7 w-40" />
      <Skeleton className="mb-6 h-4 w-80" />
      <Skeleton className="mb-4 h-11 w-56" />
      <Skeleton className="h-72 w-full rounded-xl" />
    </section>
  );
}
