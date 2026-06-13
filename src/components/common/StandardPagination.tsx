import Link from "next/link";

type StandardPaginationProps = {
  basePath: string;
  page: number;
  pageSize: number;
  totalCount: number;
  searchParams?: Record<string, string | number | null | undefined>;
  pageSizeOptions?: number[];
};

function buildHref(
  basePath: string,
  params: Record<string, string | number | null | undefined>,
  page: number,
  pageSize: number,
) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (key === "page" || key === "pageSize") return;
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      query.set(key, String(value));
    }
  });

  query.set("page", String(page));
  query.set("pageSize", String(pageSize));

  return `${basePath}?${query.toString()}`;
}

export function StandardPagination({
  basePath,
  page,
  pageSize,
  totalCount,
  searchParams = {},
  pageSizeOptions = [10, 25, 50, 100],
}: StandardPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalCount);
  const canPrevious = currentPage > 1;
  const canNext = currentPage < totalPages;

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-600 lg:flex-row lg:items-center lg:justify-between">
      <div className="font-medium">
        Showing <span className="font-bold text-slate-900">{start}-{end}</span> of{" "}
        <span className="font-bold text-slate-900">{totalCount}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Rows</span>
        {pageSizeOptions.map((option) => (
          <Link
            key={option}
            href={buildHref(basePath, searchParams, 1, option)}
            className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold ${
              option === pageSize
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {option}
          </Link>
        ))}

        <div className="mx-1 h-6 border-l border-slate-200" />

        <Link
          href={buildHref(basePath, searchParams, Math.max(1, currentPage - 1), pageSize)}
          aria-disabled={!canPrevious}
          className={`rounded-lg border px-3 py-1.5 font-semibold ${
            canPrevious
              ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              : "pointer-events-none border-slate-100 bg-slate-50 text-slate-300"
          }`}
        >
          Previous
        </Link>

        <span className="rounded-lg bg-slate-50 px-3 py-1.5 font-bold text-slate-700 ring-1 ring-slate-200">
          Page {currentPage} / {totalPages}
        </span>

        <Link
          href={buildHref(basePath, searchParams, Math.min(totalPages, currentPage + 1), pageSize)}
          aria-disabled={!canNext}
          className={`rounded-lg border px-3 py-1.5 font-semibold ${
            canNext
              ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              : "pointer-events-none border-slate-100 bg-slate-50 text-slate-300"
          }`}
        >
          Next
        </Link>
      </div>
    </div>
  );
}
