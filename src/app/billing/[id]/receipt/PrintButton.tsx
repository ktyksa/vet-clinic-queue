"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg bg-slate-800 px-5 py-2 text-sm font-medium text-white hover:bg-slate-900 print:hidden"
    >
      พิมพ์ใบเสร็จ
    </button>
  );
}
