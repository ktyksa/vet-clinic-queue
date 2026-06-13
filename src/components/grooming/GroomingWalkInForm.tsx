"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createWalkInGrooming } from "@/actions/grooming-queue.actions";
import type { GroomingService, User } from "@/generated/prisma/client";

interface PetResult {
  petId: string;
  petName: string;
  microchipNo: string | null;
  gender: string;
  species: { speciesName: string } | null;
  breed: { breedName: string } | null;
  owner: {
    ownerId: string;
    fullName: string;
    phoneNo: string;
    lineId: string | null;
    email: string | null;
  };
}

interface Props {
  services: GroomingService[];
  groomers: Pick<User, "userId" | "fullName">[];
}

export function GroomingWalkInForm({ services, groomers }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PetResult[]>([]);
  const [selected, setSelected] = useState<PetResult | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected) return;
    if (!query || query.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/patients?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = (await res.json()) as { pets: PetResult[] };
          setResults(data.pets ?? []);
          setShowDropdown(true);
        }
      } catch {
        // ignore search errors
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, selected]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(pet: PetResult) {
    setSelected(pet);
    setQuery(`${pet.owner.fullName} — ${pet.petName} (${pet.species?.speciesName ?? ""})`);
    setShowDropdown(false);
    setResults([]);
  }

  function clearSelected() {
    setSelected(null);
    setQuery("");
    setResults([]);
  }

  function toggleService(id: string) {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  async function handleSubmit(formData: FormData) {
    if (!selected) {
      setError("กรุณาเลือกเจ้าของ/สัตว์เลี้ยง");
      return;
    }
    if (selectedServices.length === 0) {
      setError("กรุณาเลือกบริการอย่างน้อย 1 รายการ");
      return;
    }
    setError(null);
    formData.set("petId", selected.petId);
    formData.set("ownerId", selected.owner.ownerId);
    startTransition(async () => {
      try {
        await createWalkInGrooming(formData);
      } catch (e: unknown) {
        if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) return;
        setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
      }
    });
  }

  const total = selectedServices.reduce((sum, id) => {
    const svc = services.find((s) => s.groomingServiceId === id);
    return sum + (svc ? Number(svc.price) : 0);
  }, 0);

  return (
    <form action={handleSubmit} className="space-y-8">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Owner / Pet search */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          ค้นหาเจ้าของ / สัตว์เลี้ยง <span className="text-red-500">*</span>
        </label>
        <div className="relative" ref={dropdownRef}>
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (selected) setSelected(null);
              }}
              placeholder="ชื่อเจ้าของ, ชื่อสัตว์เลี้ยง, เบอร์โทร..."
              disabled={isPending}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-50"
            />
            {selected && (
              <button
                type="button"
                onClick={clearSelected}
                className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-500 hover:bg-gray-50"
              >
                ล้าง
              </button>
            )}
          </div>

          {showDropdown && results.length > 0 && (
            <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              {results.map((pet) => (
                <button
                  key={pet.petId}
                  type="button"
                  onClick={() => handleSelect(pet)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-indigo-50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm">
                      {pet.owner.fullName}
                      <span className="ml-2 text-gray-400 text-xs">{pet.owner.phoneNo}</span>
                    </div>
                    <div className="text-sm text-gray-600 truncate">
                      {pet.petName}
                      {pet.species && (
                        <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                          {pet.species.speciesName}
                        </span>
                      )}
                      {pet.breed && (
                        <span className="ml-1 text-xs text-gray-400">{pet.breed.breedName}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {showDropdown && results.length === 0 && query.length >= 2 && !selected && (
            <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500 shadow-lg">
              ไม่พบข้อมูล
            </div>
          )}
        </div>

        {selected && (
          <div className="mt-2 rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-indigo-900">{selected.owner.fullName}</span>
                <span className="ml-2 text-sm text-indigo-600">{selected.owner.phoneNo}</span>
              </div>
              <div className="text-sm text-indigo-700">
                {selected.petName}
                {selected.species && (
                  <span className="ml-2 rounded bg-indigo-100 px-1.5 py-0.5 text-xs">
                    {selected.species.speciesName}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Services */}
      <div>
        <label className="mb-3 block text-sm font-medium text-gray-700">
          บริการ <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {services.map((svc) => {
            const checked = selectedServices.includes(svc.groomingServiceId);
            return (
              <label
                key={svc.groomingServiceId}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors ${
                  checked
                    ? "border-indigo-400 bg-indigo-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <input
                  type="checkbox"
                  name="serviceIds"
                  value={svc.groomingServiceId}
                  checked={checked}
                  onChange={() => toggleService(svc.groomingServiceId)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">{svc.serviceName}</div>
                  <div className="text-xs text-gray-500">{svc.durationMin} นาที</div>
                </div>
                <div className="text-sm font-semibold text-gray-700">
                  ฿{Number(svc.price).toLocaleString("th-TH")}
                </div>
              </label>
            );
          })}
        </div>

        {selectedServices.length > 0 && (
          <div className="mt-3 flex justify-end rounded-lg bg-gray-50 px-4 py-2 text-sm">
            <span className="text-gray-600">รวม:</span>
            <span className="ml-2 font-bold text-gray-900">
              ฿{total.toLocaleString("th-TH")}
            </span>
          </div>
        )}
      </div>

      {/* Groomer */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          พนักงาน Groomer
        </label>
        <select
          name="groomerId"
          disabled={isPending}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-50"
        >
          <option value="">— ไม่ระบุ —</option>
          {groomers.map((g) => (
            <option key={g.userId} value={g.userId}>
              {g.fullName}
            </option>
          ))}
        </select>
      </div>

      {/* Special requests */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          คำขอพิเศษ / ข้อควรระวัง
        </label>
        <textarea
          name="specialRequests"
          rows={2}
          disabled={isPending}
          placeholder="เช่น ไม่ชอบใช้เครื่องเป่า, แพ้แชมพูบางชนิด..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-50"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">หมายเหตุ</label>
        <textarea
          name="notes"
          rows={2}
          disabled={isPending}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-50"
        />
      </div>

      <div className="flex gap-3">
        <a
          href="/grooming"
          className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          ยกเลิก
        </a>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-8 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isPending ? "กำลังบันทึก..." : "เพิ่มคิวอาบน้ำตัดขน"}
        </button>
      </div>
    </form>
  );
}
