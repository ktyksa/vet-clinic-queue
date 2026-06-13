"use client";

import { useRef, useState } from "react";

type IntakeAttachmentInputProps = {
  disabled?: boolean;
  existingFiles?: {
    visitAttachmentId: string;
    originalFileName: string;
    filePath: string;
    fileSizeBytes: number;
  }[];
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ type = "existing" }: { type?: "new" | "existing" }) {
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs ${
        type === "new"
          ? "bg-blue-100 text-blue-600"
          : "bg-slate-100 text-slate-500"
      }`}
    >
      📄
    </span>
  );
}

export function IntakeAttachmentInput({
  disabled = false,
  existingFiles = [],
}: IntakeAttachmentInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [deletedFileIds, setDeletedFileIds] = useState<string[]>([]);

  const visibleExistingFiles = existingFiles.filter(
    (file) => !deletedFileIds.includes(file.visitAttachmentId)
  );

  const totalFiles = selectedFiles.length + visibleExistingFiles.length;

  function setInputFiles(files: File[]) {
    setSelectedFiles(files);
    if (!inputRef.current) return;
    const dataTransfer = new DataTransfer();
    files.forEach((file) => dataTransfer.items.add(file));
    inputRef.current.files = dataTransfer.files;
  }

  function removeSelectedFile(fileToRemove: File) {
    setInputFiles(
      selectedFiles.filter(
        (file) =>
          !(
            file.name === fileToRemove.name &&
            file.size === fileToRemove.size &&
            file.lastModified === fileToRemove.lastModified
          )
      )
    );
  }

  function markExistingFileForDelete(fileId: string) {
    setDeletedFileIds((current) =>
      current.includes(fileId) ? current : [...current, fileId]
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">ไฟล์แนบ</span>
          {totalFiles > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              {totalFiles} ไฟล์
            </span>
          )}
          {selectedFiles.length > 0 && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
              รออัปโหลด {selectedFiles.length}
            </span>
          )}
        </div>

        {/* Compact upload button */}
        {!disabled && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-7 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition"
          >
            <span className="text-sm leading-none">↥</span>
            เพิ่มไฟล์
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          name="attachments"
          multiple
          accept="image/*,.pdf"
          disabled={disabled}
          className="sr-only"
          onChange={(event) =>
            setInputFiles(Array.from(event.currentTarget.files ?? []))
          }
        />
      </div>

      {/* Drop zone — only show when no files yet or not disabled */}
      {!disabled && totalFiles === 0 && (
        <div
          className="mx-3 my-2 flex h-14 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-center transition hover:border-blue-300 hover:bg-blue-50"
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            setInputFiles(Array.from(e.dataTransfer.files));
          }}
        >
          <span className="text-xs font-semibold text-blue-600">
            คลิกเพื่อเลือกไฟล์ หรือลากมาวางที่นี่
          </span>
          <span className="mt-0.5 text-[10px] text-slate-400">
            รูปภาพ / PDF สูงสุด 10MB/ไฟล์
          </span>
        </div>
      )}

      {/* Drop zone when there are files — compact strip */}
      {!disabled && totalFiles > 0 && (
        <div
          className="mx-3 my-1.5 flex h-8 cursor-pointer items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-center transition hover:border-blue-300 hover:bg-blue-50"
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            setInputFiles(Array.from(e.dataTransfer.files));
          }}
        >
          <span className="text-[11px] text-slate-400">
            ลากไฟล์มาวางที่นี่เพื่อเพิ่ม
          </span>
        </div>
      )}

      {/* File list */}
      {(selectedFiles.length > 0 || visibleExistingFiles.length > 0) && (
        <div className="px-3 pb-3 space-y-1.5">
          {/* New files */}
          {selectedFiles.map((file) => (
            <div
              key={`${file.name}-${file.size}-${file.lastModified}`}
              className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5"
            >
              <FileIcon type="new" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-blue-800">
                  {file.name}
                </div>
                <div className="text-[10px] text-blue-500">
                  {formatFileSize(file.size)} · ยังไม่บันทึก
                </div>
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeSelectedFile(file)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-blue-400 hover:bg-blue-100 hover:text-blue-700 transition"
                  title="เอาออก"
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          {/* Existing files */}
          {visibleExistingFiles.map((file) => (
            <div
              key={file.visitAttachmentId}
              className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5"
            >
              <FileIcon type="existing" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-slate-700">
                  {file.originalFileName}
                </div>
                <div className="text-[10px] text-slate-400">
                  {formatFileSize(file.fileSizeBytes)}
                </div>
              </div>
              <a
                href={file.filePath}
                target="_blank"
                rel="noreferrer"
                className="flex h-6 items-center rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                เปิด
              </a>
              {!disabled && (
                <button
                  type="button"
                  onClick={() =>
                    markExistingFileForDelete(file.visitAttachmentId)
                  }
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition"
                  title="ลบ"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {deletedFileIds.map((fileId) => (
        <input
          key={fileId}
          type="hidden"
          name="deleteAttachmentIds"
          value={fileId}
        />
      ))}
    </div>
  );
}
