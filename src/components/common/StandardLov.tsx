import Link from "next/link";

type LovOption = {
  value: string;
  label: string;
  description?: string;
};

type StandardLovProps = {
  label: string;
  value: string;
  options: LovOption[];
  basePath: string;
  paramName: string;
  searchParams?: Record<string, string | number | null | undefined>;
};

function buildHref(
  basePath: string,
  params: Record<string, string | number | null | undefined>,
  paramName: string,
  value: string,
) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, paramValue]) => {
    if (key === "page") return;
    if (paramValue !== null && paramValue !== undefined && String(paramValue).trim() !== "") {
      query.set(key, String(paramValue));
    }
  });

  if (value) query.set(paramName, value);
  else query.delete(paramName);

  query.set("page", "1");

  const queryText = query.toString();
  return queryText ? `${basePath}?${queryText}` : basePath;
}

export function StandardLov({
  label,
  value,
  options,
  basePath,
  paramName,
  searchParams = {},
}: StandardLovProps) {
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <div className="relative">
      <span className="mb-1 block text-xs font-bold text-slate-500">{label}</span>
      <details className="group relative">
        <summary className="flex h-10 cursor-pointer list-none items-center justify-between rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition hover:border-blue-300 hover:bg-blue-50 [&::-webkit-details-marker]:hidden">
          <span className="truncate">{selected?.label ?? "-"}</span>
          <span className="ml-2 text-slate-400 transition group-open:rotate-180">⌄</span>
        </summary>

        <div className="absolute z-30 mt-2 max-h-72 w-full min-w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
          {options.map((option) => (
            <Link
              key={option.value || "__all"}
              href={buildHref(basePath, searchParams, paramName, option.value)}
              className={`block rounded-lg px-3 py-2 text-sm ${
                option.value === value
                  ? "bg-blue-50 font-bold text-blue-700"
                  : "font-semibold text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="block">{option.label}</span>
              {option.description ? (
                <span className="mt-0.5 block text-xs font-medium text-slate-400">{option.description}</span>
              ) : null}
            </Link>
          ))}
        </div>
      </details>
    </div>
  );
}
