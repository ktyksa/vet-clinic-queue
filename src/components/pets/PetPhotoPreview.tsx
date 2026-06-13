"use client";

import Image from "next/image";
import { useState } from "react";

export function PetPhotoPreview({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex rounded-full outline-none ring-blue-100 transition hover:opacity-80 focus:ring-4"
        title="View pet photo"
      >
        <Image
          src={src}
          alt={alt}
          width={48}
          height={48}
          className="h-12 w-12 rounded-full object-cover"
        />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative max-h-[90vh] max-w-4xl rounded-2xl bg-white p-4 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white text-xl font-bold text-slate-700 shadow hover:bg-slate-100"
              aria-label="Close photo preview"
            >
              ×
            </button>

            <Image
              src={src}
              alt={alt}
              width={900}
              height={900}
              className="max-h-[80vh] w-auto rounded-xl object-contain"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}