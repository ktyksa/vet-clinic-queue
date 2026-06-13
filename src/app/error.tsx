"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F7FAFF] px-4">
      <div className="w-full max-w-md rounded-2xl border border-rose-100 bg-white p-8 shadow-sm">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6 text-rose-600" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none" />
            <line x1="12" y1="15" x2="12" y2="16" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="text-lg font-bold text-slate-950">เกิดข้อผิดพลาด</h1>
        <p className="mt-1 text-sm text-slate-500">
          Something went wrong. Please try again or contact your system administrator.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-xs text-slate-400">Error ID: {error.digest}</p>
        )}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            ลองใหม่
          </button>
          <a
            href="/"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            กลับหน้าหลัก
          </a>
        </div>
      </div>
    </div>
  );
}
