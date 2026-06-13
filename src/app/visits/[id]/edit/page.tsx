import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { requirePermission } from "@/lib/auth/require-auth";
import { getVisitById, updateVisitClinicalInfo } from "@/actions/visit.actions";
import { IntakeAttachmentInput } from "@/components/visits/IntakeAttachmentInput";

export const dynamic = "force-dynamic";

type VisitDetailPageProps = { params: Promise<{ id: string }>; searchParams?: Promise<{ returnTo?: string; returnLabel?: string; notice?: string }> };

function formatDateTime(value?: Date | string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

function minutesSince(value?: Date | string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
}

function formatQueueTime(minutes: number | null) {
  if (minutes === null) return "-";
  if (minutes < 60) return `${minutes} นาที`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours} ชม. ${mins} นาที` : `${hours} ชม.`;
}

function safeReturnPath(value?: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function noticeText(value?: string | null) {
  switch (value) {
    case "intake-saved":
      return "✓ บันทึกฉบับร่างสำเร็จ (Draft Saved)";
    case "ready-for-vet":
      return "✓ ซักประวัติเสร็จสิ้นและส่งต่อสัตวแพทย์แล้ว";
    default:
      return null;
  }
}

function formatValue(value?: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function calculateAge(value?: Date | string | null, fallback?: string | null) {
  if (!value) return fallback || "-";
  const birthDate = new Date(value);
  if (Number.isNaN(birthDate.getTime())) return fallback || "-";
  const today = new Date();
  let years = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth() - birthDate.getMonth();
  if (today.getDate() < birthDate.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years <= 0) return `${months} เดือน`;
  return months > 0 ? `${years} ปี ${months} เดือน` : `${years} ปี`;
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function SelectField({ label, name, defaultValue, options, disabled = false }: { label: string; name: string; defaultValue?: string | number | null; options: string[]; disabled?: boolean }) {
  return (
    <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
      <span>{label}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        disabled={disabled}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
      >
        {options.map((option) => (
          <option key={option} value={option === "-" ? "" : option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function InputField({ label, name, defaultValue, placeholder, type = "text", disabled = false }: { label: string; name: string; defaultValue?: string | number | null; placeholder?: string; type?: string; disabled?: boolean }) {
  return (
    <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
      <span>{label}</span>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        disabled={disabled}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
      />
    </label>
  );
}

function TextAreaField({ label, name, defaultValue, placeholder, rows = 4, disabled = false }: { label: string; name: string; defaultValue?: string | null; placeholder?: string; rows?: number; disabled?: boolean }) {
  return (
    <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
      <span>{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
      />
    </label>
  );
}


function formatOwnerAddress(owner: { houseNo?: string | null; villageName?: string | null; buildingName?: string | null; soi?: string | null; road?: string | null; subDistrict?: string | null; district?: string | null; province?: string | null; postalCode?: string | null }) {
  const parts = [
    owner.houseNo,
    owner.villageName ? `หมู่บ้าน${owner.villageName}` : null,
    owner.buildingName,
    owner.soi ? `ซ.${owner.soi}` : null,
    owner.road ? `ถ.${owner.road}` : null,
    owner.subDistrict ? `ต./แขวง ${owner.subDistrict}` : null,
    owner.district ? `อ./เขต ${owner.district}` : null,
    owner.province,
    owner.postalCode,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "-";
}

function formatVisitType(visit: { reasonType?: string | null; visitType?: string | null; appointment?: { appointmentType?: string | null } | null }) {
  return visit.reasonType ?? visit.appointment?.appointmentType ?? visit.visitType ?? "-";
}


function intakeStatusLabel(status?: string | null) {
  switch (status) {
    case "WAITING_TRIAGE":
      return "รอซักประวัติ";
    case "TRIAGE_IN_PROGRESS":
      return "กำลังซักประวัติ";
    case "WAITING_VET":
      return "รอพบหมอ";
    case "IN_SERVICE":
      return "กำลังตรวจ";
    case "COMPLETED":
      return "เสร็จสิ้น";
    case "NO_SHOW":
      return "ไม่มา";
    case "CANCELLED":
      return "ยกเลิก";
    case "CHECKED_IN":
      return "เช็กอินแล้ว";
    case "IN_PROGRESS":
      return "กำลังตรวจ";
    default:
      return status ?? "-";
  }
}

function yesNoDash(value?: string | null) {
  return value || "-";
}

export default async function VisitIntakePage({ params, searchParams }: VisitDetailPageProps) {
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const returnTo = safeReturnPath(query.returnTo);
  const returnLabel = query.returnLabel ? decodeURIComponent(query.returnLabel) : null;
  const backHref = returnTo ?? "/medical-queue";
  const backLabel = returnLabel ? `← กลับไป ${returnLabel}` : "← กลับไปคิวรักษา";
  const notice = noticeText(query.notice);
  await requirePermission("visit", "view");
  const visit = await getVisitById(id);
  if (!visit) notFound();

  const activeQueue = visit.medicalQueue?.deletedAt ? null : (visit.medicalQueue ?? (visit.appointment?.medicalQueue?.deletedAt ? null : visit.appointment?.medicalQueue ?? null));
  const queueStatus = activeQueue?.queueStatus ?? null;
  const displayStatus = queueStatus === "IN_SERVICE" ? "IN_SERVICE" : queueStatus ?? visit.status;
  const petAge = calculateAge(visit.pet.birthDate, visit.pet.estimatedAge);
  const latestWeight = visit.weightKg ?? visit.pet.weight;
  const ownerAddress = formatOwnerAddress(visit.owner);
  const displayedVisitType = formatVisitType(visit);
  const queueTime = minutesSince(activeQueue?.waitingAt ?? activeQueue?.checkedInAt ?? visit.checkedInAt ?? activeQueue?.createdAt ?? null);
  const isCancelled = visit.status === "CANCELLED" || queueStatus === "CANCELLED";
  const canOpenSoap = !isCancelled && visit.status !== "COMPLETED" && ["WAITING_VET", "IN_PROGRESS"].includes(visit.status);
  const hasIntakeData = Boolean(visit.weightKg || visit.temperatureC || visit.heartRateBpm || visit.respiratoryRateBpm || visit.chiefComplaint || visit.clinicalNote);
  const canPrintIntake = !isCancelled && hasIntakeData;
  const isIntakeLocked = isCancelled || ["WAITING_VET", "IN_PROGRESS", "COMPLETED"].includes(visit.status) || ["WAITING_VET", "IN_SERVICE", "COMPLETED", "NO_SHOW"].includes(queueStatus ?? "");

  return (
    <AppShell>
      <div className="bg-slate-50 px-6 py-5 text-slate-900">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 shadow-sm">
            <IconCalendar />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">ซักประวัติผู้ป่วย <span className="text-base font-semibold text-slate-500">(Intake / Triage)</span></h1>
            <p className="mt-0.5 text-sm font-medium text-slate-500">ซักประวัติและบันทึกข้อมูลเบื้องต้นก่อนพบสัตวแพทย์</p>
          </div>
        </div>

        <div className="mb-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <Link href={backHref} className="text-sm font-semibold text-slate-600 hover:text-blue-700">{backLabel}</Link>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-slate-950">{visit.visitNo}</span>
            <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-extrabold text-purple-700">{displayStatus}</span>
            <details className="relative">
              <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-xl text-xl font-bold text-slate-400 hover:bg-slate-100 hover:text-slate-700 [&::-webkit-details-marker]:hidden">⋮</summary>
              <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-2 text-sm font-semibold shadow-lg">
                {visit.appointmentId ? <Link className="block px-4 py-2 text-slate-700 hover:bg-slate-50" href={`/appointments/${visit.appointmentId}`}>ดูนัดหมาย</Link> : null}
                <Link className="block px-4 py-2 text-slate-700 hover:bg-slate-50" href={`/owners/${visit.ownerId}`}>ข้อมูลเจ้าของ</Link>
                <Link className="block px-4 py-2 text-slate-700 hover:bg-slate-50" href={`/pets/${visit.petId}`}>ข้อมูลสัตว์เลี้ยง</Link>
                {canPrintIntake ? <Link className="block px-4 py-2 text-slate-700 hover:bg-slate-50" href={`/visits/${visit.visitId}?print=1`}>พิมพ์ใบซักประวัติ</Link> : null}
              </div>
            </details>
          </div>
        </div>

        {notice ? (
          <div className="mb-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
            {notice}
          </div>
        ) : null}

        {isIntakeLocked ? (
          <div className={`mb-3 rounded-xl border px-4 py-3 text-sm font-semibold ${isCancelled ? "border-rose-100 bg-rose-50 text-rose-700" : "border-emerald-100 bg-emerald-50 text-emerald-800"}`}>
            {isCancelled ? "Visit ถูกยกเลิกแล้ว ไม่สามารถแก้ไขข้อมูลซักประวัติได้" : "✓ ซักประวัติเสร็จสิ้นและส่งต่อสัตวแพทย์แล้ว ข้อมูลนี้เป็นแบบอ่านอย่างเดียว"}
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
          <aside className="space-y-3">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex gap-3.5">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                  {visit.pet.petPhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={visit.pet.petPhotoUrl} alt={visit.pet.petName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl text-slate-400">🐾</div>
                  )}
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h2 className="truncate text-lg font-semibold leading-6 text-slate-950">{visit.pet.petName}</h2>
                  <div className="mt-1 space-y-0.5 text-sm font-normal leading-5 text-slate-500">
                    <p className="break-words">{visit.pet.species.speciesName} · {visit.pet.breed?.breedName ?? "-"}</p>
                    <p>{visit.pet.gender} · {petAge}</p>
                    <p>น้ำหนักล่าสุด {formatValue(latestWeight)} kg</p>
                  </div>
                </div>
              </div>
              <div className="my-3.5 border-t border-slate-100" />
              <h3 className="mb-2 text-base font-semibold leading-6 text-slate-800">Owner</h3>
              <div className="space-y-1.5 text-sm font-normal leading-5 text-slate-700">
                <p><span className="font-normal text-slate-500">Name:</span> <span className="font-medium text-slate-900">{visit.owner.fullName}</span></p>
                <p><span className="font-normal text-slate-500">Phone:</span> <span className="font-medium text-slate-900">{visit.owner.phoneNo ?? "-"}</span></p>
                <p className="leading-5"><span className="font-normal text-slate-500">Address:</span> <span className="font-medium text-slate-900">{ownerAddress}</span></p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <Link href={`/owners/${visit.ownerId}`} className="rounded-lg border border-blue-200 px-3 py-2 text-center text-sm font-semibold leading-5 text-blue-700 hover:bg-blue-50">View Owner</Link>
                <Link href={`/pets/${visit.petId}`} className="rounded-lg border border-blue-200 px-3 py-2 text-center text-sm font-semibold leading-5 text-blue-700 hover:bg-blue-50">View Pet</Link>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-base font-semibold leading-6 text-slate-800">Visit Info</h3>
              <dl className="space-y-2.5 text-sm leading-5">
                <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3"><dt className="font-medium text-slate-500">Medical Type</dt><dd className="text-right font-semibold text-slate-900">{displayedVisitType}</dd></div>
                <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3"><dt className="font-medium text-slate-500">Veterinarian</dt><dd className="text-right font-semibold text-slate-900">{visit.vet?.fullName ?? "-"}</dd></div>
                <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3"><dt className="font-medium text-slate-500">Check-in Time</dt><dd className="text-right font-semibold text-slate-900">{formatDateTime(visit.checkedInAt)}</dd></div>
                <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3"><dt className="font-medium text-slate-500">Queue Time</dt><dd className="text-right font-semibold text-slate-900">{formatQueueTime(queueTime)}</dd></div>
              </dl>
            </section>
          </aside>

          <form action={updateVisitClinicalInfo} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <input type="hidden" name="visitId" value={visit.visitId} />
            <h2 className="mb-4 text-lg font-bold text-slate-950">สัญญาณชีพ <span className="text-sm font-semibold text-slate-500">Vital Signs</span></h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <InputField label="น้ำหนัก (kg)" name="weightKg" defaultValue={visit.weightKg?.toString()} disabled={isIntakeLocked} />
              <InputField label="อุณหภูมิ (°C)" name="temperatureC" defaultValue={visit.temperatureC?.toString()} disabled={isIntakeLocked} />
              <InputField label="ชีพจร (bpm)" name="heartRateBpm" type="number" defaultValue={visit.heartRateBpm} disabled={isIntakeLocked} />
              <InputField label="อัตราหายใจ (/min)" name="respiratoryRateBpm" type="number" defaultValue={visit.respiratoryRateBpm} disabled={isIntakeLocked} />
              <SelectField label="ระดับปวด (0-10)" name="painScore" defaultValue={visit.painScore} options={["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]} disabled={isIntakeLocked} />
              <SelectField label="สีเยื่อเมือก" name="mucousMembrane" defaultValue={visit.mucousMembrane} options={["-", "Pink", "Pale", "Red", "Blue/Purple", "Yellow"]} disabled={isIntakeLocked} />
              <SelectField label="CRT (sec)" name="capillaryRefillTime" defaultValue={visit.capillaryRefillTime} options={["-", "< 2 sec", "2 sec", "> 2 sec"]} disabled={isIntakeLocked} />
              <SelectField label="รูปร่าง/BCS" name="bodyConditionScore" defaultValue={visit.bodyConditionScore} options={["-", "1", "2", "3", "4", "5", "6", "7", "8", "9"]} disabled={isIntakeLocked} />
            </div>

            <div className="mt-4 space-y-3">
              <TextAreaField label="อาการสำคัญ" name="chiefComplaint" defaultValue={visit.chiefComplaint} placeholder="ระบุอาการสำคัญของเคสนี้ / เหตุผลที่มา" rows={3} disabled={isIntakeLocked} />
              <TextAreaField label="บันทึกเพิ่มเติม" name="clinicalNote" defaultValue={visit.clinicalNote} placeholder="บันทึกประวัติและข้อมูลเพิ่มเติม" rows={3} disabled={isIntakeLocked} />
            </div>

            <h3 className="mt-5 text-base font-bold text-slate-950">ข้อมูลเพิ่มเติม <span className="text-sm font-semibold text-slate-500">Additional Information</span></h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <SelectField label="การกิน" name="appetiteStatus" defaultValue={visit.appetiteStatus} options={["ปกติ", "ลดลง", "ไม่กิน", "เพิ่มขึ้น"]} disabled={isIntakeLocked} />
              <SelectField label="กิจกรรม" name="mentalStatus" defaultValue={visit.mentalStatus} options={["ปกติ", "ซึม", "กระสับกระส่าย", "อ่อนแรง"]} disabled={isIntakeLocked} />
              <SelectField label="การดื่มน้ำ" name="waterIntakeStatus" defaultValue={visit.waterIntakeStatus} options={["ปกติ", "ลดลง", "เพิ่มขึ้น", "ไม่ดื่ม"]} disabled={isIntakeLocked} />
              <SelectField label="ปัสสาวะ" name="urinationStatus" defaultValue={visit.urinationStatus} options={["ปกติ", "ลดลง", "เพิ่มขึ้น", "ผิดปกติ"]} disabled={isIntakeLocked} />
              <SelectField label="อุจจาระ" name="defecationStatus" defaultValue={visit.defecationStatus} options={["ปกติ", "ลดลง", "ท้องเสีย", "ไม่ถ่าย"]} disabled={isIntakeLocked} />
            </div>

            <div className="mt-4">
              <div className="intake-attachment-compact [&>div]:items-stretch md:[&>div]:grid-cols-1 xl:[&>div]:grid-cols-[minmax(0,1.45fr)_minmax(460px,520px)] 2xl:[&>div]:grid-cols-[minmax(0,1.35fr)_520px]">
                <IntakeAttachmentInput disabled={isIntakeLocked} existingFiles={visit.intakeAttachments} />
              </div>
            </div>

            <div className="mt-3 flex justify-end gap-3 border-t border-slate-100 pt-3">
              <Link href={backHref} className="rounded-lg border border-slate-200 px-7 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">กลับ</Link>
              {isIntakeLocked && canOpenSoap ? (
                <Link href={`/visits/${visit.visitId}/soap?returnTo=${encodeURIComponent(backHref)}&returnLabel=${encodeURIComponent(returnLabel ?? "Medical Queue")}`} className="rounded-lg bg-violet-600 px-7 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700">เปิด SOAP</Link>
              ) : !isIntakeLocked ? (
                <>
                  <button type="submit" className="rounded-lg border border-blue-200 px-7 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50">บันทึกฉบับร่าง</button>
                  <button type="submit" name="readyForVet" value="true" className="rounded-lg bg-emerald-600 px-7 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">บันทึกและส่งต่อหมอ</button>
                </>
              ) : null}
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
