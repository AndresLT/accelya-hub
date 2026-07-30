/**
 * Simple shimmer placeholder used by loading.tsx files (Suspense
 * fallbacks) to keep the app responsive while server data streams in.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-bg-3 ${className}`} />;
}
