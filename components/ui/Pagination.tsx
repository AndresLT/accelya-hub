import Link from "next/link";

/**
 * Server-rendered pager. Navigates via the `?page=` query param on
 * `basePath`. Renders nothing when there's a single page.
 */
export function Pagination({
  basePath,
  page,
  totalPages,
  totalItems,
}: {
  basePath: string;
  page: number;
  totalPages: number;
  totalItems?: number;
}) {
  if (totalPages <= 1) return null;

  const linkClass =
    "rounded-lg border border-bg-3 px-3 py-1.5 text-sm font-semibold text-tx-2 hover:bg-bg-2";
  const disabledClass =
    "rounded-lg border border-bg-3 px-3 py-1.5 text-sm font-semibold text-tx-3 opacity-50";

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-tx-3">
        Page {page} of {totalPages}
        {typeof totalItems === "number" ? ` · ${totalItems} total` : ""}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={`${basePath}?page=${page - 1}`} className={linkClass}>
            Previous
          </Link>
        ) : (
          <span className={disabledClass}>Previous</span>
        )}
        {page < totalPages ? (
          <Link href={`${basePath}?page=${page + 1}`} className={linkClass}>
            Next
          </Link>
        ) : (
          <span className={disabledClass}>Next</span>
        )}
      </div>
    </div>
  );
}
