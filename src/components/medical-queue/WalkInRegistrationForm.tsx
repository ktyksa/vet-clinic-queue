"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";

const MEDICAL_APPOINTMENT_TYPES = [
  "CHECKUP",
  "VACCINE",
  "SICK",
  "FOLLOW_UP",
  "SURGERY",
  "OTHER",
] as const;

const PRIORITY_OPTIONS = ["NORMAL", "URGENT", "EMERGENCY"] as const;
const PAGE_SIZE = 5;
const LOV_MAX_HEIGHT = 220;

type LanguageCode = "TH" | "EN";

type OwnerOption = {
  ownerId: string;
  fullName: string;
  phoneNo: string | null;
  lineId: string | null;
  email: string | null;
};

type PetOption = {
  petId: string;
  ownerId: string;
  petName: string;
  microchipNo: string | null;
  gender: string;
  species: { speciesName: string } | null;
  breed: { breedName: string } | null;
  owner: OwnerOption;
};

type VetOption = {
  userId: string;
  fullName: string;
};

type WalkInRegistrationFormProps = {
  vets: VetOption[];
  action: (formData: FormData) => Promise<void>;
  arrivalDateTimeLabel: string;
  language?: string | null;
  variant?: "page" | "modal";
  onCancel?: () => void;
};

const messages = {
  EN: {
    ownerPetSelection: "Owner / Pet Selection",
    owner: "Owner",
    pet: "Pet",
    clear: "Clear",
    noOwnerSelected: "No owner selected",
    noPetSelected: "No pet selected",
    ownerPlaceholder: "Search owner or phone",
    petPlaceholder: "Search pet to resolve owner",
    petPlaceholderWithOwner: "Search pet",
    noOwnerFound: "No owner or pet found",
    noPetFound: "No pet found",
    noVetFound: "No veterinarian found",
    noTypeFound: "No appointment type found",
    noPriorityFound: "No priority found",
    noContact: "No contact",
    walkInInformation: "Walk-in Information",
    source: "Source",
    arrival: "Arrival / Check-in Time",
    medicalType: "Appointment type",
    veterinarian: "Veterinarian",
    unassignedVet: "Unassigned / assign later",
    optionalTriage: "Optional: Priority / Triage",
    priority: "Priority",
    queueType: "Queue Type",
    reason: "Reason / Chief Complaint",
    reasonPlaceholder: "Enter reason",
    cancel: "Cancel",
    createQueue: "Create Queue",
    requiredOwner: "Owner is required",
    requiredPet: "Pet is required",
    previous: "Previous",
    next: "Next",
    page: "Page",
    of: "of",
  },
  TH: {
    ownerPetSelection: "เลือกเจ้าของ / สัตว์เลี้ยง",
    owner: "เจ้าของ",
    pet: "สัตว์เลี้ยง",
    clear: "Clear",
    noOwnerSelected: "ยังไม่ได้เลือก Owner",
    noPetSelected: "ยังไม่ได้เลือก Pet",
    ownerPlaceholder: "ค้นหาเจ้าของหรือเบอร์โทร",
    petPlaceholder: "ค้นหาสัตว์เลี้ยงเพื่อระบุเจ้าของ",
    petPlaceholderWithOwner: "ค้นหาสัตว์เลี้ยง",
    noOwnerFound: "ไม่พบเจ้าของหรือสัตว์เลี้ยง",
    noPetFound: "ไม่พบสัตว์เลี้ยง",
    noVetFound: "ไม่พบสัตวแพทย์",
    noTypeFound: "ไม่พบประเภทนัดหมาย",
    noPriorityFound: "ไม่พบความเร่งด่วน",
    noContact: "ไม่มีข้อมูลติดต่อ",
    walkInInformation: "ข้อมูล Walk-in",
    source: "แหล่งที่มา",
    arrival: "เวลามาถึง / Check-in",
    medicalType: "ประเภทนัดหมาย",
    veterinarian: "สัตวแพทย์",
    unassignedVet: "ยังไม่ระบุ / มอบหมายภายหลัง",
    optionalTriage: "ตัวเลือกเพิ่มเติม: Priority / Triage",
    priority: "ความเร่งด่วน",
    queueType: "ประเภทคิว",
    reason: "เหตุผล / อาการเบื้องต้น",
    reasonPlaceholder: "ระบุเหตุผล",
    cancel: "ยกเลิก",
    createQueue: "สร้างคิว",
    requiredOwner: "กรุณาเลือกเจ้าของ",
    requiredPet: "กรุณาเลือกสัตว์เลี้ยง",
    previous: "ก่อนหน้า",
    next: "ถัดไป",
    page: "หน้า",
    of: "จาก",
  },
} as const;

type WalkInMessages = Record<keyof typeof messages["TH"], string>;

function getLanguage(language?: string | null): LanguageCode {
  return language === "EN" ? "EN" : "TH";
}

function ownerOptionText(owner: OwnerOption) {
  return `${owner.fullName}${owner.phoneNo ? ` • ${owner.phoneNo}` : ""}`;
}

function selectedPetText(pet: PetOption) {
  const breed = pet.breed?.breedName ? ` • ${pet.breed.breedName}` : "";
  const species = pet.species?.speciesName ? ` • ${pet.species.speciesName}${breed}` : "";
  return `${pet.petName}${species}`;
}

function normalize(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function matchesVet(text: string, query: string) {
  const q = normalize(query);
  if (!q) return true;
  return normalize(text).includes(q);
}

function getPageCount(total: number) {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

async function searchPatients(q: string): Promise<PetOption[]> {
  if (!q.trim()) return [];
  const response = await fetch(`/api/search/patients?q=${encodeURIComponent(q.trim())}`);
  if (!response.ok) return [];
  const data = await response.json() as { pets: PetOption[] };
  return data.pets;
}

function getFixedLovStyle(input: HTMLInputElement | null): CSSProperties {
  if (typeof window === "undefined" || !input) return {};
  const rect = input.getBoundingClientRect();
  const margin = 16;
  const gap = 4;
  const preferredHeight = LOV_MAX_HEIGHT;
  const belowSpace = window.innerHeight - rect.bottom - margin;
  const aboveSpace = rect.top - margin;
  const openAbove = belowSpace < 140 && aboveSpace > belowSpace;
  const maxHeight = Math.max(
    96,
    Math.min(preferredHeight, openAbove ? aboveSpace - gap : belowSpace - gap),
  );
  const top = openAbove
    ? Math.max(margin, rect.top - maxHeight - gap)
    : Math.min(rect.bottom + gap, window.innerHeight - margin - maxHeight);
  return {
    position: "fixed",
    left: rect.left,
    top,
    width: rect.width,
    maxHeight,
  };
}

function PaginationFooter({
  page,
  pageCount,
  total,
  onPageChange,
  t,
}: {
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
  t: WalkInMessages;
}) {
  if (total <= PAGE_SIZE) return null;

  return (
    <div className="mt-1 flex items-center justify-between gap-2 border-t border-slate-100 px-2 pt-2 text-[11px] font-semibold text-slate-500">
      <span>{t.page} {page + 1} {t.of} {pageCount}</span>
      <div className="flex gap-1">
        <button
          type="button"
          disabled={page === 0}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onPageChange(Math.max(0, page - 1))}
          className="rounded-md border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t.previous}
        </button>
        <button
          type="button"
          disabled={page >= pageCount - 1}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))}
          className="rounded-md border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t.next}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-700">
        <span>
          {label}
          {required ? <span className="ml-0.5 text-rose-600">*</span> : null}
        </span>
      </span>
      {children}
      {error ? <span className="mt-1 block text-[11px] font-semibold text-rose-600">{error}</span> : null}
    </label>
  );
}

function LovPanel({
  children,
  input,
}: {
  children: React.ReactNode;
  input: HTMLInputElement | null;
}) {
  return (
    <div
      onPointerDown={(event) => event.stopPropagation()}
      className="z-[9999] overflow-y-auto overflow-x-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl shadow-slate-300/40"
      style={getFixedLovStyle(input)}
    >
      {children}
    </div>
  );
}

export function WalkInRegistrationForm({
  vets,
  action,
  arrivalDateTimeLabel,
  language,
  variant = "page",
  onCancel,
}: WalkInRegistrationFormProps) {
  const t = messages[getLanguage(language)];
  const compact = variant === "modal";
  const ownerInputRef = useRef<HTMLInputElement | null>(null);
  const petInputRef = useRef<HTMLInputElement | null>(null);
  const vetInputRef = useRef<HTMLInputElement | null>(null);
  const typeInputRef = useRef<HTMLInputElement | null>(null);
  const priorityInputRef = useRef<HTMLInputElement | null>(null);
  const noteInputRef = useRef<HTMLTextAreaElement | null>(null);
  const skipNextOwnerFocusOpenRef = useRef(false);

  const [ownerQuery, setOwnerQuery] = useState("");
  const [petQuery, setPetQuery] = useState("");
  const [vetQuery, setVetQuery] = useState("");
  const [typeQuery, setTypeQuery] = useState("");
  const [priorityQuery, setPriorityQuery] = useState("NORMAL");
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [selectedPetId, setSelectedPetId] = useState("");
  const [selectedVetId, setSelectedVetId] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("NORMAL");
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [petOpen, setPetOpen] = useState(false);
  const [vetOpen, setVetOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [ownerPage, setOwnerPage] = useState(0);
  const [petPage, setPetPage] = useState(0);
  const [vetPage, setVetPage] = useState(0);
  const [typePage, setTypePage] = useState(0);
  const [priorityPage, setPriorityPage] = useState(0);

  // Server-side search results
  const [ownerSearchResults, setOwnerSearchResults] = useState<PetOption[]>([]);
  const [petSearchResults, setPetSearchResults] = useState<PetOption[]>([]);

  // Debounced owner search
  const triggerOwnerSearch = useCallback((q: string) => {
    searchPatients(q).then(setOwnerSearchResults).catch(() => setOwnerSearchResults([]));
  }, []);

  useEffect(() => {
    if (!ownerQuery.trim()) { setOwnerSearchResults([]); return; }
    const timer = setTimeout(() => triggerOwnerSearch(ownerQuery), 300);
    return () => clearTimeout(timer);
  }, [ownerQuery, triggerOwnerSearch]);

  // Debounced pet search
  const triggerPetSearch = useCallback((q: string) => {
    searchPatients(q).then(setPetSearchResults).catch(() => setPetSearchResults([]));
  }, []);

  useEffect(() => {
    if (!petQuery.trim()) { setPetSearchResults([]); return; }
    const timer = setTimeout(() => triggerPetSearch(petQuery), 300);
    return () => clearTimeout(timer);
  }, [petQuery, triggerPetSearch]);

  const filteredVets = vets.filter((vet) => matchesVet(vet.fullName, vetQuery));
  const filteredTypes = (() => {
    const shouldShowAllTypes = Boolean(selectedType) && typeQuery === selectedType;
    if (shouldShowAllTypes) return [...MEDICAL_APPOINTMENT_TYPES];
    return MEDICAL_APPOINTMENT_TYPES.filter((type) => normalize(type).includes(normalize(typeQuery)));
  })();
  const filteredPriorities = PRIORITY_OPTIONS.filter((p) => normalize(p).includes(normalize(priorityQuery)));

  const ownerPageCount = getPageCount(ownerSearchResults.length);
  const petPageCount = getPageCount(petSearchResults.length);
  const vetPageCount = getPageCount(filteredVets.length);
  const typePageCount = getPageCount(filteredTypes.length);
  const priorityPageCount = getPageCount(filteredPriorities.length);
  const pagedOwnerLovPets = ownerSearchResults.slice(ownerPage * PAGE_SIZE, ownerPage * PAGE_SIZE + PAGE_SIZE);
  const pagedPets = petSearchResults.slice(petPage * PAGE_SIZE, petPage * PAGE_SIZE + PAGE_SIZE);
  const pagedVets = filteredVets.slice(vetPage * PAGE_SIZE, vetPage * PAGE_SIZE + PAGE_SIZE);
  const pagedTypes = filteredTypes.slice(typePage * PAGE_SIZE, typePage * PAGE_SIZE + PAGE_SIZE);
  const pagedPriorities = filteredPriorities.slice(priorityPage * PAGE_SIZE, priorityPage * PAGE_SIZE + PAGE_SIZE);

  const missingOwner = !selectedOwnerId;
  const missingPet = !selectedPetId;
  const missingType = !selectedType;
  const showOwnerError = missingOwner && ownerQuery.trim().length > 0;
  const showPetError = missingPet && petQuery.trim().length > 0;
  const showTypeError = missingType && typeQuery.trim().length > 0;
  const canSave = Boolean(selectedOwnerId && selectedPetId && selectedType);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      const inputs = [
        ownerInputRef.current,
        petInputRef.current,
        vetInputRef.current,
        typeInputRef.current,
        priorityInputRef.current,
      ];
      if (inputs.some((input) => input?.contains(target))) return;
      setOwnerOpen(false);
      setPetOpen(false);
      setVetOpen(false);
      setTypeOpen(false);
      setPriorityOpen(false);
    }
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!compact) return;
    const timer = window.setTimeout(() => {
      skipNextOwnerFocusOpenRef.current = true;
      ownerInputRef.current?.focus();
    }, 80);
    return () => window.clearTimeout(timer);
  }, [compact]);

  function closeAll() {
    setOwnerOpen(false);
    setPetOpen(false);
    setVetOpen(false);
    setTypeOpen(false);
    setPriorityOpen(false);
  }


  function choosePet(pet: PetOption) {
    setSelectedPetId(pet.petId);
    setPetQuery(selectedPetText(pet));
    setSelectedOwnerId(pet.ownerId);
    setOwnerQuery(ownerOptionText(pet.owner));
    setPetOpen(false);
    setOwnerOpen(false);
    setPetPage(0);
    window.setTimeout(() => {
      vetInputRef.current?.focus();
      setVetOpen(true);
    }, 0);
  }

  function chooseVet(vet: VetOption | null) {
    setSelectedVetId(vet?.userId ?? "");
    setVetQuery(vet?.fullName ?? "");
    setVetOpen(false);
    setVetPage(0);
    window.setTimeout(() => {
      typeInputRef.current?.focus();
      setTypeOpen(true);
    }, 0);
  }

  function chooseType(type: string) {
    setSelectedType(type);
    setTypeQuery(type);
    setTypeOpen(false);
    setTypePage(0);
    window.setTimeout(() => noteInputRef.current?.focus(), 0);
  }

  function choosePriority(priority: string) {
    setSelectedPriority(priority);
    setPriorityQuery(priority);
    setPriorityOpen(false);
    setPriorityPage(0);
  }

  function clearOwner() {
    setSelectedOwnerId("");
    setOwnerQuery("");
    setSelectedPetId("");
    setPetQuery("");
    setOwnerPage(0);
    setPetPage(0);
    window.setTimeout(() => {
      ownerInputRef.current?.focus();
      setOwnerOpen(true);
    }, 0);
  }

  function clearPet() {
    setSelectedPetId("");
    setPetQuery("");
    setPetPage(0);
    window.setTimeout(() => {
      petInputRef.current?.focus();
      setPetOpen(true);
    }, 0);
  }

  function clearType() {
    setSelectedType("");
    setTypeQuery("");
    setTypePage(0);
    window.setTimeout(() => {
      typeInputRef.current?.focus();
      setTypeOpen(true);
    }, 0);
  }

  function toggleLov(
    event: MouseEvent<HTMLInputElement>,
    setter: (value: boolean | ((value: boolean) => boolean)) => void,
  ) {
    if (document.activeElement !== event.currentTarget) return;
    event.preventDefault();
    setter((open) => !open);
  }

  const modalFormClass = compact ? "space-y-2.5 px-3 pb-3 text-[12px]" : "space-y-6";
  const sectionClass = compact ? "rounded-xl border border-slate-200 bg-white" : "rounded-2xl border border-slate-200 bg-white shadow-sm";
  const sectionHeaderClass = compact ? "border-b border-slate-200 px-4 py-2" : "border-b border-slate-200 px-6 py-4";
  const ownerPetBodyClass = compact ? "grid gap-3 p-4" : "grid gap-5 p-6 lg:grid-cols-2";
  const sectionBodyClass = compact ? "grid gap-3 p-3 sm:grid-cols-2" : "grid gap-5 p-6 lg:grid-cols-2";
  const inputClass = "h-[34px] w-full rounded-lg border border-slate-300 px-3 py-1 text-xs outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
  const inputErrorClass = "h-[34px] w-full rounded-lg border border-blue-500 px-3 py-1 text-xs outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100";

  return (
    <form action={action} className={modalFormClass}>
      <input type="hidden" name="source" value="WALK_IN" />
      <input type="hidden" name="status" value="ARRIVED" />
      <input type="hidden" name="ownerId" value={selectedOwnerId} />
      <input type="hidden" name="petId" value={selectedPetId} />
      <input type="hidden" name="vetId" value={selectedVetId} />
      <input type="hidden" name="appointmentType" value={selectedType} />
      <input type="hidden" name="priority" value={selectedPriority} />
      <input type="hidden" name="queueType" value="MEDICAL" />

      <section className={sectionClass}>
        <div className={sectionHeaderClass}>
          <h2 className={compact ? "text-sm font-bold text-slate-950" : "text-base font-bold text-slate-950"}>{t.ownerPetSelection}</h2>
        </div>

        <div className={ownerPetBodyClass}>
          <Field label={t.owner} required error={showOwnerError ? t.requiredOwner : undefined}>
            <div className="relative">
              <input
                ref={ownerInputRef}
                value={ownerQuery}
                onMouseDown={(event) => toggleLov(event, setOwnerOpen)}
                onFocus={() => {
                  closeAll();
                  if (skipNextOwnerFocusOpenRef.current) {
                    skipNextOwnerFocusOpenRef.current = false;
                    return;
                  }
                  setOwnerOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setOwnerOpen(false);
                  if (event.key === "ArrowDown") setOwnerOpen(true);
                }}
                onChange={(event) => {
                  setOwnerQuery(event.target.value);
                  setOwnerPage(0);
                  setOwnerOpen(true);
                  if (selectedOwnerId) {
                    setSelectedOwnerId("");
                    setSelectedPetId("");
                    setPetQuery("");
                  }
                }}
                placeholder={t.ownerPlaceholder}
                className={missingOwner ? `${inputErrorClass} pr-16` : `${inputClass} pr-16`}
              />
              {ownerQuery ? (
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={clearOwner}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-100"
                >
                  {t.clear}
                </button>
              ) : null}
              {ownerOpen ? (
                <LovPanel input={ownerInputRef.current}>
                  {pagedOwnerLovPets.length ? pagedOwnerLovPets.map((pet) => (
                    <button
                      key={`${pet.ownerId}-${pet.petId}`}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => choosePet(pet)}
                      className={pet.petId === selectedPetId ? "block w-full rounded-lg bg-blue-50 px-3 py-1.5 text-left focus:outline-none" : "block w-full rounded-lg px-3 py-1.5 text-left hover:bg-slate-50 focus:bg-blue-50 focus:outline-none"}
                    >
                      <span className="block truncate text-xs font-bold text-slate-900">{pet.owner.fullName}{pet.owner.phoneNo ? ` • ${pet.owner.phoneNo}` : ""}</span>
                      <span className="block truncate text-[11px] font-semibold text-slate-500">{[pet.petName, pet.microchipNo, pet.species?.speciesName, pet.breed?.breedName].filter(Boolean).join(" • ")}</span>
                    </button>
                  )) : (
                    <div className="px-3 py-2 text-xs font-semibold text-slate-400">
                      {ownerQuery.trim() ? t.noOwnerFound : t.ownerPlaceholder}
                    </div>
                  )}
                  <PaginationFooter page={ownerPage} pageCount={ownerPageCount} total={ownerSearchResults.length} onPageChange={setOwnerPage} t={t} />
                </LovPanel>
              ) : null}
            </div>
          </Field>

          <Field label={t.pet} required error={showPetError ? t.requiredPet : undefined}>
            <div className="relative">
              <input
                ref={petInputRef}
                value={petQuery}
                onMouseDown={(event) => toggleLov(event, setPetOpen)}
                onFocus={() => {
                  closeAll();
                  setPetOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setPetOpen(false);
                  if (event.key === "ArrowDown") setPetOpen(true);
                }}
                onChange={(event) => {
                  setPetQuery(event.target.value);
                  setPetPage(0);
                  setPetOpen(true);
                  if (selectedPetId) setSelectedPetId("");
                }}
                placeholder={selectedOwnerId ? t.petPlaceholderWithOwner : t.petPlaceholder}
                className={missingPet ? `${inputErrorClass} pr-16` : `${inputClass} pr-16`}
              />
              {petQuery ? (
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={clearPet}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-100"
                >
                  {t.clear}
                </button>
              ) : null}
              {petOpen ? (
                <LovPanel input={petInputRef.current}>
                  {pagedPets.length ? pagedPets.map((pet) => (
                    <button
                      key={pet.petId}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => choosePet(pet)}
                      className={pet.petId === selectedPetId ? "block w-full rounded-lg bg-blue-50 px-3 py-1.5 text-left focus:outline-none" : "block w-full rounded-lg px-3 py-1.5 text-left hover:bg-slate-50 focus:bg-blue-50 focus:outline-none"}
                    >
                      <span className="block truncate text-xs font-bold text-slate-900">{pet.petName}</span>
                      <span className="block truncate text-[11px] font-semibold text-slate-500">{[pet.owner.fullName, pet.owner.phoneNo, pet.species?.speciesName, pet.breed?.breedName].filter(Boolean).join(" • ")}</span>
                    </button>
                  )) : (
                    <div className="px-3 py-2 text-xs font-semibold text-slate-400">
                      {petQuery.trim() ? t.noPetFound : t.petPlaceholder}
                    </div>
                  )}
                  <PaginationFooter page={petPage} pageCount={petPageCount} total={petSearchResults.length} onPageChange={setPetPage} t={t} />
                </LovPanel>
              ) : null}
            </div>
          </Field>
        </div>
      </section>

      <section className={sectionClass}>
        {!compact ? (
          <div className={sectionHeaderClass}>
            <h2 className="text-base font-bold text-slate-950">{t.walkInInformation}</h2>
          </div>
        ) : null}
        <div className={sectionBodyClass}>
          {!compact ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">{t.source}</div>
              <div className="mt-1 text-sm font-black text-emerald-900">WALK_IN</div>
            </div>
          ) : null}
          <div className={compact ? "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 sm:col-span-2" : "rounded-lg border border-slate-200 bg-slate-50 p-3"}>
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{t.arrival}</div>
            <div className="mt-0.5 text-[13px] font-black text-slate-950">{arrivalDateTimeLabel}</div>
          </div>

          <Field label={t.veterinarian}>
            <div className="relative">
              <input
                ref={vetInputRef}
                value={vetQuery}
                onMouseDown={(event) => toggleLov(event, setVetOpen)}
                onFocus={() => {
                  closeAll();
                  setVetOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setVetOpen(false);
                  if (event.key === "ArrowDown") setVetOpen(true);
                }}
                onChange={(event) => {
                  setVetQuery(event.target.value);
                  setVetPage(0);
                  setVetOpen(true);
                  if (selectedVetId) setSelectedVetId("");
                }}
                placeholder={t.unassignedVet}
                className={inputClass}
              />
              {vetQuery ? (
                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => chooseVet(null)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-100">{t.clear}</button>
              ) : null}
              {vetOpen ? (
                <LovPanel input={vetInputRef.current}>
                  <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => chooseVet(null)} className={!selectedVetId ? "block w-full rounded-lg bg-blue-50 px-3 py-1.5 text-left focus:outline-none" : "block w-full rounded-lg px-3 py-1.5 text-left hover:bg-slate-50 focus:bg-blue-50 focus:outline-none"}>
                    <span className="block truncate text-xs font-normal text-slate-900">{t.unassignedVet}</span>
                  </button>
                  {pagedVets.length ? pagedVets.map((vet) => (
                    <button key={vet.userId} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => chooseVet(vet)} className={vet.userId === selectedVetId ? "block w-full rounded-lg bg-blue-50 px-3 py-1.5 text-left focus:outline-none" : "block w-full rounded-lg px-3 py-1.5 text-left hover:bg-slate-50 focus:bg-blue-50 focus:outline-none"}>
                      <span className="block truncate text-xs font-normal text-slate-900">{vet.fullName}</span>
                    </button>
                  )) : <div className="px-3 py-2 text-xs font-semibold text-slate-400">{t.noVetFound}</div>}
                  <PaginationFooter page={vetPage} pageCount={vetPageCount} total={filteredVets.length} onPageChange={setVetPage} t={t} />
                </LovPanel>
              ) : null}
            </div>
          </Field>

          <Field label={t.medicalType} required error={showTypeError ? t.noTypeFound : undefined}>
            <div className="relative">
              <input
                ref={typeInputRef}
                value={typeQuery}
                onMouseDown={(event) => toggleLov(event, setTypeOpen)}
                onFocus={() => {
                  closeAll();
                  setTypeOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setTypeOpen(false);
                  if (event.key === "ArrowDown") setTypeOpen(true);
                }}
                onChange={(event) => {
                  setTypeQuery(event.target.value);
                  setTypePage(0);
                  setTypeOpen(true);
                  if (selectedType) setSelectedType("");
                }}
                placeholder={t.medicalType}
                className={missingType ? `${inputErrorClass} pr-16` : `${inputClass} pr-16`}
              />
              {typeQuery ? (
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={clearType}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-100"
                >
                  {t.clear}
                </button>
              ) : null}
              {typeOpen ? (
                <LovPanel input={typeInputRef.current}>
                  {pagedTypes.length ? pagedTypes.map((type) => (
                    <button key={type} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => chooseType(type)} className={type === selectedType ? "block w-full rounded-lg bg-blue-50 px-3 py-1.5 text-left focus:outline-none" : "block w-full rounded-lg px-3 py-1.5 text-left hover:bg-slate-50 focus:bg-blue-50 focus:outline-none"}>
                      <span className="block truncate text-xs font-normal text-slate-900">{type}</span>
                    </button>
                  )) : <div className="px-3 py-2 text-xs font-semibold text-slate-400">{t.noTypeFound}</div>}
                  <PaginationFooter page={typePage} pageCount={typePageCount} total={filteredTypes.length} onPageChange={setTypePage} t={t} />
                </LovPanel>
              ) : null}
            </div>
          </Field>

          <details className="rounded-lg border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
            <summary className="cursor-pointer text-xs font-bold text-slate-700">{t.optionalTriage}</summary>
            <div className="mt-3 grid gap-3">
              <Field label={t.priority}>
                <div className="relative">
                  <input
                    ref={priorityInputRef}
                    value={priorityQuery}
                    onMouseDown={(event) => toggleLov(event, setPriorityOpen)}
                    onFocus={() => {
                      closeAll();
                      setPriorityOpen(true);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setPriorityOpen(false);
                      if (event.key === "ArrowDown") setPriorityOpen(true);
                    }}
                    onChange={(event) => {
                      setPriorityQuery(event.target.value);
                      setPriorityPage(0);
                      setPriorityOpen(true);
                      if (selectedPriority) setSelectedPriority("");
                    }}
                    className={inputClass}
                  />
                  {priorityOpen ? (
                    <LovPanel input={priorityInputRef.current}>
                      {pagedPriorities.length ? pagedPriorities.map((priority) => (
                        <button key={priority} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => choosePriority(priority)} className={priority === selectedPriority ? "block w-full rounded-lg bg-blue-50 px-3 py-1.5 text-left focus:outline-none" : "block w-full rounded-lg px-3 py-1.5 text-left hover:bg-slate-50 focus:bg-blue-50 focus:outline-none"}>
                          <span className="block truncate text-xs font-normal text-slate-900">{priority}</span>
                        </button>
                      )) : <div className="px-3 py-2 text-xs font-semibold text-slate-400">{t.noPriorityFound}</div>}
                      <PaginationFooter page={priorityPage} pageCount={priorityPageCount} total={filteredPriorities.length} onPageChange={setPriorityPage} t={t} />
                    </LovPanel>
                  ) : null}
                </div>
              </Field>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">{t.queueType}</label>
                <input defaultValue="MEDICAL" readOnly className="h-[34px] w-full rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs" />
              </div>
            </div>
          </details>
        </div>
      </section>

      <section className={sectionClass}>
        <div className={sectionHeaderClass}>
          <h2 className={compact ? "text-sm font-bold text-slate-950" : "text-base font-bold text-slate-950"}>{t.reason}</h2>
        </div>
        <div className={compact ? "p-3" : "p-6"}>
          <textarea ref={noteInputRef} name="note" rows={compact ? 2 : 4} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder={t.reasonPlaceholder} />
        </div>
      </section>

      <div className={compact ? "sticky bottom-0 -mx-3 flex justify-end gap-2 border-t border-slate-100 bg-white px-3 pt-3" : "flex justify-end gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm"}>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="h-[34px] rounded-lg border border-slate-300 px-4 text-xs font-bold text-slate-700 hover:bg-slate-50">{t.cancel}</button>
        ) : (
          <Link href="/medical-queue" className="inline-flex h-[34px] items-center rounded-lg border border-slate-300 px-4 text-xs font-bold text-slate-700 hover:bg-slate-50">{t.cancel}</Link>
        )}
        <button type="submit" disabled={!canSave} className="h-[34px] rounded-lg bg-blue-600 px-5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">
          {t.createQueue}
        </button>
      </div>
    </form>
  );
}
