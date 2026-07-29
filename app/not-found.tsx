import Link from "next/link";

/**
 * Branded 404 page (rendered by the root layout). Seen, for example, when
 * an assigned app points to a route that doesn't exist yet.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="text-center">
        <p className="font-heading text-6xl font-bold text-acc-blue">404</p>
        <h1 className="mt-4 text-xl font-bold text-tx-1">Page not found</h1>
        <p className="mt-2 text-sm text-tx-3">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-acc-blue px-4 py-2.5 text-sm font-semibold text-tx-1-c"
        >
          Back to Hub
        </Link>
      </div>
    </main>
  );
}
