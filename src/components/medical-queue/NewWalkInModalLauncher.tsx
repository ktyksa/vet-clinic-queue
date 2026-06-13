"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { WalkInRegistrationForm } from "@/components/medical-queue/WalkInRegistrationForm";

type VetOption = {
  userId: string;
  fullName: string;
};

type NewWalkInModalLauncherProps = {
  vets: VetOption[];
  action: (formData: FormData) => Promise<void>;
  arrivalDateTimeLabel: string;
  language?: string | null;
};

type ModalPosition = {
  left: number;
  top: number;
};

const MODAL_WIDTH = 560;

const labels = {
  TH: { button: "New Walk-in", title: "New Walk-in" },
  EN: { button: "New Walk-in", title: "New Walk-in" },
} as const;

function getLanguage(language?: string | null): keyof typeof labels {
  return language === "EN" ? "EN" : "TH";
}

function clampModalPosition(left: number, top: number, fallbackHeight?: number): ModalPosition {
  const width = Math.min(MODAL_WIDTH, window.innerWidth - 16);
  const height = fallbackHeight ?? Math.min(window.innerHeight * 0.86, window.innerHeight - 24);

  return {
    left: Math.min(Math.max(left, 8), Math.max(8, window.innerWidth - width - 8)),
    top: Math.min(Math.max(top, 8), Math.max(8, window.innerHeight - height - 8)),
  };
}

function getAnchorModalPosition(anchorEl: HTMLButtonElement | null): ModalPosition {
  const width = Math.min(MODAL_WIDTH, window.innerWidth - 16);
  const fallbackLeft = Math.max(8, Math.round((window.innerWidth - width) / 2));
  const fallbackTop = Math.max(8, Math.round(window.innerHeight * 0.06));
  const anchorRect = anchorEl?.getBoundingClientRect();

  if (!anchorRect) return { left: fallbackLeft, top: fallbackTop };

  return clampModalPosition(anchorRect.right - width, anchorRect.bottom + 8);
}

export function NewWalkInModalLauncher({
  vets,
  action,
  arrivalDateTimeLabel,
  language,
}: NewWalkInModalLauncherProps) {
  const t = labels[getLanguage(language)];
  const [open, setOpen] = useState(false);
  const [modalPosition, setModalPosition] = useState<ModalPosition>({ left: 24, top: 24 });
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  function openWalkInModal() {
    setModalPosition(getAnchorModalPosition(buttonRef.current));
    setOpen(true);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={openWalkInModal}
        className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
      >
        {t.button}
      </button>
      {open ? (
        <WalkInModal
          title={t.title}
          anchorEl={buttonRef.current}
          initialPosition={modalPosition}
          onClose={() => setOpen(false)}
        >
          <WalkInRegistrationForm
            vets={vets}
            action={action}
            arrivalDateTimeLabel={arrivalDateTimeLabel}
            language={language}
            variant="modal"
            onCancel={() => setOpen(false)}
          />
        </WalkInModal>
      ) : null}
    </>
  );
}

function WalkInModal({
  title,
  anchorEl,
  initialPosition,
  onClose,
  children,
}: {
  title: string;
  anchorEl: HTMLButtonElement | null;
  initialPosition: ModalPosition;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState(initialPosition);

  useEffect(() => {
    setPosition(initialPosition);
  }, [initialPosition]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (cardRef.current?.contains(target)) return;
      if (anchorEl?.contains(target)) return;
      onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [anchorEl, onClose]);

  function clampPosition(left: number, top: number) {
    const height = cardRef.current?.getBoundingClientRect().height;
    return clampModalPosition(left, top, height);
  }

  function handleDragStart(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = position;

    function handleMove(moveEvent: PointerEvent) {
      setPosition(clampPosition(origin.left + moveEvent.clientX - startX, origin.top + moveEvent.clientY - startY));
    }

    function handleUp() {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp, { once: true });
  }

  return (
    <div
      ref={cardRef}
      style={{ left: position.left, top: position.top }}
      className="fixed z-50 max-h-[88vh] w-[560px] max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-400/30"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-1">
        <div onPointerDown={handleDragStart} className="flex min-w-0 flex-1 cursor-move items-center gap-2.5 select-none">
          <button
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onClose}
            type="button"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-50"
            aria-label="Close"
          >
            <span className="text-xl leading-none">×</span>
          </button>
          <h2 className="text-[15px] font-semibold tracking-tight text-slate-950">{title}</h2>
        </div>
      </div>
      <div className="max-h-[calc(88vh-42px)] overflow-y-auto overscroll-contain">
        {children}
      </div>
    </div>
  );
}
