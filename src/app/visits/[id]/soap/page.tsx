import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { requirePermission } from "@/lib/auth/require-auth";
import {
  addVisitDiagnosis,
  createOrUpdateSoapNote,
  finalizeSoapNote,
  getActiveDiagnosisCodes,
  getSoapPageData,
  removeVisitDiagnosis,
} from "@/actions/soap.actions";
import { updateVisitStatus } from "@/actions/visit.actions";

export const dynamic = "force-dynamic";

type SoapPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ notice?: string; missing?: string; returnTo?: string; returnLabel?: string }>;
};

type OwnerAddress = {
  houseNo?: string | null;
  villageName?: string | null;
  buildingName?: string | null;
  soi?: string | null;
  road?: string | null;
  subDistrict?: string | null;
  district?: string | null;
  province?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

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

function formatValue(value?: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function isCorruptedText(value?: string | null) {
  if (!value) return false;
  return value.includes("???") || value.trim().replace(/\?/g, "").length === 0;
}

function diagnosisName(code?: { code?: string | null; nameEn?: string | null; nameTh?: string | null } | null) {
  if (!code) return "-";
  const displayName = code.nameTh && !isCorruptedText(code.nameTh) ? code.nameTh : code.nameEn;
  return [code.code, displayName].filter(Boolean).join(" - ") || "-";
}

function noticeMessage(value?: string | null) {
  switch (value) {
    case "diagnosis-added":
      return "✓ Diagnosis added successfully.";
    case "soap-saved":
      return "✓ SOAP saved. Continue to the next step.";
    case "soap-draft-saved":
      return "✓ SOAP draft saved successfully.";
    case "soap-finalize-missing":
      return "Cannot finalize SOAP. Please complete the highlighted required fields.";
    case "soap-finalized":
      return "✓ SOAP finalized. Visit is ready to complete.";
    case "visit-completed":
      return "✓ Visit completed successfully. Queue moved to Completed.";
    default:
      return null;
  }
}

function formatOwnerAddress(owner: OwnerAddress) {
  const line1 = [
    owner.houseNo,
    owner.villageName ? `หมู่บ้าน ${owner.villageName}` : null,
    owner.buildingName ? `อาคาร ${owner.buildingName}` : null,
    owner.soi ? `ซ.${owner.soi}` : null,
    owner.road ? `ถ.${owner.road}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const line2 = [
    owner.subDistrict ? `ต./แขวง ${owner.subDistrict}` : null,
    owner.district ? `อ./เขต ${owner.district}` : null,
    owner.province,
    owner.postalCode,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    line1: line1 || "-",
    line2: line2 || "",
  };
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

function TextAreaField({
  label,
  name,
  defaultValue,
  placeholder,
  rows = 4,
  minHeightClass = "min-h-[110px]",
  disabled = false,
  required = false,
  fieldStateClass = "",
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  rows?: number;
  minHeightClass?: string;
  disabled?: boolean;
  required?: boolean;
  fieldStateClass?: string;
}) {
  const length = (defaultValue ?? "").length;
  return (
    <label className="block h-full space-y-2 text-xs font-bold text-slate-700">
      <span className="text-[13px] font-bold text-slate-900">{label}{required ? <span className="ml-1 text-red-500">*</span> : null}</span>
      <textarea
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        rows={rows}
        maxLength={1000}
        disabled={disabled}
        id={`field-${name.toLowerCase()}`}
        className={`${minHeightClass} w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium leading-6 text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 disabled:shadow-none ${fieldStateClass}`}
      />
      <span className="block text-right text-xs font-semibold text-slate-400">
        {length} / 1000
      </span>
    </label>
  );
}

function SelectBox({
  label,
  name,
  defaultValue,
  options,
  disabled = false,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  options: string[];
  disabled?: boolean;
}) {
  return (
    <label className="block space-y-1.5 text-xs font-bold text-slate-700">
      <span>{label}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        disabled={disabled}
        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 disabled:shadow-none"
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

function WorkflowStepper({ step }: { step: number }) {
  const steps = [
    [1, "Intake"],
    [2, "SOAP"],
    [3, "Dx"],
    [4, "Tx"],
    [5, "Complete"],
  ] as const;

  return (
    <aside className="rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
      <h3 className="mb-1.5 text-center text-[9px] font-bold uppercase tracking-wide text-slate-400">
        Workflow
      </h3>
      <div className="space-y-1">
        {steps.map(([no, label]) => {
          const done = no < step;
          const active = no === step;
          return (
            <div
              key={no}
              className={`flex flex-col items-center justify-center rounded-lg px-1 py-1.5 text-[9px] font-bold ${
                active
                  ? "border border-blue-200 bg-blue-50 text-blue-700"
                  : "text-slate-500"
              }`}
            >
              <span
                className={`mb-1 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold ${
                  done
                    ? "bg-emerald-500 text-white"
                    : active
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-500"
                }`}
              >
                {done ? "✓" : no}
              </span>
              <span className="max-w-full truncate">{label}</span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function safeReturnPath(value?: string | null) {
  if (!value || !value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  return value;
}

function missingFieldList(value?: string | null) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default async function SoapRecordPage({ params, searchParams }: SoapPageProps) {
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const returnTo = safeReturnPath(query.returnTo);
  const returnLabel = query.returnLabel ? decodeURIComponent(query.returnLabel) : null;
  const backHref = returnTo ?? `/visits/${id}`;
  const backLabel = returnLabel ? `← Back to ${returnLabel}` : "← Back to Visit Detail";
  const missingFields = missingFieldList(query.missing);
  await requirePermission("soap", "view");

  const visit = await getSoapPageData(id);
  if (!visit) notFound();

  const diagnosisCodes = await getActiveDiagnosisCodes();
  const soap = visit.soapNote;
  const ownerAddress = formatOwnerAddress(visit.owner);
  const queueStatus = visit.medicalQueue?.deletedAt
    ? null
    : (visit.medicalQueue?.queueStatus ?? (visit.appointment?.medicalQueue?.deletedAt ? null : visit.appointment?.medicalQueue?.queueStatus ?? null));
  const displayStatus =
    queueStatus === "IN_SERVICE" ? "IN_SERVICE" : (queueStatus ?? visit.status);
  const hasDiagnosis = visit.diagnoses.length > 0;
  const isFinalized = soap?.status === "FINALIZED";
  const finalizedSoap = soap as
    | (typeof soap & {
        finalizedAt?: Date | string | null;
        finalizedByUser?: { fullName?: string | null } | null;
        finalizedBy?: { fullName?: string | null } | null;
      })
    | null;
  const finalizedByName =
    finalizedSoap?.finalizedByUser?.fullName ??
    finalizedSoap?.finalizedBy?.fullName ??
    null;
  const finalizedAt = finalizedSoap?.finalizedAt ?? null;
  const step =
    soap?.status === "FINALIZED" && hasDiagnosis ? 5 : hasDiagnosis ? 4 : 2;
  const canComplete =
    soap?.status === "FINALIZED" &&
    hasDiagnosis &&
    visit.status !== "COMPLETED";
  const notice = noticeMessage(query.notice);
  const completeDisabledReason = !hasDiagnosis
    ? "Add at least one diagnosis before completing the visit."
    : soap?.status !== "FINALIZED"
      ? "Finalize SOAP before completing the visit."
      : visit.status === "COMPLETED"
        ? "Visit is already completed."
        : "";
  const nextActionLabel = isFinalized
    ? "SOAP Finalized"
    : hasDiagnosis
      ? "Proceed to Finalize"
      : "Save & Next: Diagnosis";
  const hasMissing = (field: string) => missingFields.includes(field);
  const requiredClass = (field: string) =>
    hasMissing(field)
      ? "border-red-400 bg-red-50 ring-2 ring-red-100"
      : "";
  const withSoapReturn = (path: string) => {
    const current = `/visits/${visit.visitId}/soap${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}&returnLabel=${encodeURIComponent(returnLabel ?? "")}` : ""}`;
    const separator = path.includes("?") ? "&" : "?";
    return `${path}${separator}returnTo=${encodeURIComponent(current)}&returnLabel=${encodeURIComponent("SOAP")}`;
  };

  const saveSoapNote = async (formData: FormData) => {
    "use server";
    if (isFinalized) return;
    await createOrUpdateSoapNote(formData);
    redirect(`/visits/${visit.visitId}/soap?notice=soap-draft-saved${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}&returnLabel=${encodeURIComponent(returnLabel ?? "")}` : ""}`);
  };

  const saveSoapAndGoDiagnosis = async (formData: FormData) => {
    "use server";
    if (isFinalized) return;
    await createOrUpdateSoapNote(formData);
    redirect(`/visits/${visit.visitId}/soap?notice=soap-saved#diagnosis-panel`);
  };

  const addDiagnosisAction = async (formData: FormData) => {
    "use server";
    if (isFinalized) return;
    await addVisitDiagnosis(formData);
    redirect(`/visits/${visit.visitId}/soap?notice=diagnosis-added#diagnosis-panel`);
  };

  const removeDiagnosisAction = async (formData: FormData) => {
    "use server";
    if (isFinalized) return;
    await removeVisitDiagnosis(formData);
  };

  const finalizeSoapAction = async (formData: FormData) => {
    "use server";
    if (isFinalized) return;
    const savedSoap = await createOrUpdateSoapNote(formData);
    const finalizeData = new FormData();
    finalizeData.set("soapNoteId", savedSoap.soapNoteId);
    finalizeData.set("finalizationNote", String(formData.get("finalizationNote") ?? ""));
    const result = await finalizeSoapNote(finalizeData);

    if (!result.success) {
      redirect(`/visits/${visit.visitId}/soap?notice=soap-finalize-missing&missing=${encodeURIComponent(result.missingRequiredItems.join(","))}${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}&returnLabel=${encodeURIComponent(returnLabel ?? "")}` : ""}#soap-required-summary`);
    }

    redirect(`/visits/${visit.visitId}/soap?notice=soap-finalized${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}&returnLabel=${encodeURIComponent(returnLabel ?? "")}` : ""}`);
  };

  const completeVisit = async () => {
    "use server";
    await updateVisitStatus(visit.visitId, "COMPLETED");
    redirect(`/medical-queue?notice=visit-completed`);
  };

  return (
    <AppShell>
      <div className="bg-slate-50 px-5 pt-1 pb-2 text-slate-900">
        <div className="mb-2 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              href={backHref}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              {backLabel}
            </Link>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-950">
              SOAP Record
            </h1>
            <p className="text-sm font-medium text-slate-500">
              บันทึกการตรวจและรักษาโดยสัตวแพทย์
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={withSoapReturn(`/pets/${visit.petId}/medical-history`)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
            >
              Open History
            </Link>
            <form action={completeVisit}>
              <button
                disabled={!canComplete}
                title={!canComplete ? completeDisabledReason : "Complete this visit"}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Complete Visit
              </button>
            </form>
          </div>
        </div>

        {isFinalized ? (
          <div className="mb-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
            <div>✓ SOAP Finalized — this medical record is read-only.</div>
            {(finalizedByName || finalizedAt) ? (
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-emerald-700">
                {finalizedByName ? (
                  <span>Finalized By: {finalizedByName}</span>
                ) : null}
                {finalizedAt ? (
                  <span>Finalized At: {formatDateTime(finalizedAt)}</span>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {notice ? (
          <div className={`mb-2 rounded-xl px-4 py-2 text-sm font-semibold ${query.notice === "soap-finalize-missing" ? "border border-red-200 bg-red-50 text-red-700" : "border border-blue-100 bg-blue-50 text-blue-700"}`}>
            {notice}
          </div>
        ) : null}

        {missingFields.length > 0 ? (
          <div id="soap-required-summary" className="mb-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <p className="font-bold">Please complete required fields before finalizing SOAP.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {missingFields.map((field) => (
                <a key={field} href={`#field-${field.toLowerCase()}`} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-red-700 ring-1 ring-red-200 hover:bg-red-100">
                  {field}
                </a>
              ))}
            </div>
          </div>
        ) : null}

        {isFinalized && canComplete ? (
          <div className="mb-2 flex flex-col gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 md:flex-row md:items-center md:justify-between">
            <span>SOAP finalized. Visit is ready to complete.</span>
            <form action={completeVisit}>
              <button className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700">
                Complete Visit
              </button>
            </form>
          </div>
        ) : null}

        {!canComplete && completeDisabledReason ? (
          <div className="mb-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800">
            Complete Visit locked: {completeDisabledReason}
          </div>
        ) : null}

        <section className="mb-2 grid overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:grid-cols-[1.25fr_1.3fr_1fr_0.7fr]">
          <div className="flex gap-4 border-b border-slate-100 p-3 xl:border-b-0 xl:border-r">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              {visit.pet.petPhotoUrl ? (
                <div className="flex h-full w-full items-center justify-center">
                  <img
                    src={visit.pet.petPhotoUrl}
                    alt={visit.pet.petName}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl text-slate-400">
                  🐾
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-bold text-slate-950">
                {visit.pet.petName}
              </h2>
              <p className="mt-0.5 text-sm font-medium leading-5 text-slate-500">
                {visit.pet.species.speciesName} · {visit.pet.breed?.breedName ?? "-"}
              </p>
              <p className="text-sm font-medium leading-5 text-slate-500">
                {visit.pet.gender} · {calculateAge(visit.pet.birthDate, visit.pet.estimatedAge)}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {formatValue(visit.weightKg ?? visit.pet.weight)} kg
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {visit.pet.allergyNote ? visit.pet.allergyNote : "No Allergies"}
                </span>
              </div>
            </div>
          </div>

          <div className="border-b border-slate-100 p-3 xl:border-b-0 xl:border-r">
            <p className="text-sm font-bold text-slate-500">Owner</p>
            <p className="mt-2 text-base font-bold text-slate-950">
              {visit.owner.fullName}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-700">
              {visit.owner.phoneNo ?? "-"}
            </p>
            <div className="mt-1 text-sm font-medium leading-5 text-slate-500">
              <p>{ownerAddress.line1}</p>
              {ownerAddress.line2 ? <p>{ownerAddress.line2}</p> : null}
            </div>
          </div>

          <div className="border-b border-slate-100 p-3 xl:border-b-0 xl:border-r">
            <p className="text-sm font-bold text-slate-500">Visit</p>
            <p className="mt-2 text-base font-bold text-slate-950">
              {visit.visitNo}
            </p>
            <p className="text-sm font-medium text-slate-500">
              {formatDateTime(visit.checkedInAt ?? visit.visitDate)}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-bold text-slate-800">Vet:</span>{" "}
              <span className="font-medium text-slate-600">
                {visit.vet?.fullName ?? "-"}
              </span>
            </p>
          </div>

          <div className="p-3">
            <p className="text-sm font-bold text-slate-500">Status</p>
            <span className="mt-2 inline-flex rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-700">
              {displayStatus}
            </span>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              Step {step} of 5
            </p>
          </div>
        </section>

        <div className="grid items-stretch gap-2 xl:grid-cols-[72px_minmax(0,1fr)_360px]">
          <WorkflowStepper step={step} />

          <main className="space-y-2">
            <form id="soap-draft-form" action={saveSoapNote} className="space-y-2">
              <input type="hidden" name="visitId" value={visit.visitId} />
              {soap ? (
                <input
                  type="hidden"
                  name="soapNoteId"
                  value={soap.soapNoteId}
                />
              ) : null}

              <div className="grid gap-2 2xl:grid-cols-4">
                <section className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
                  <TextAreaField
                    label="S - Subjective"
                    name="subjective"
                    required
                    fieldStateClass={requiredClass("Subjective")}
                    defaultValue={soap?.subjective ?? visit.chiefComplaint}
                    placeholder="ข้อมูลที่ได้จากเจ้าของ (ประวัติ, อาการ)"
                    disabled={isFinalized}
                  />
                </section>
                <section className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
                  <TextAreaField
                    label="O - Objective"
                    name="objective"
                    required
                    fieldStateClass={requiredClass("Objective")}
                    defaultValue={soap?.objective ?? visit.clinicalNote}
                    placeholder="สิ่งที่ตรวจพบ (จากการตรวจร่างกาย, ผลตรวจ)"
                    disabled={isFinalized}
                  />
                </section>
                <section className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
                  <TextAreaField
                    label="A - Assessment"
                    name="assessment"
                    required
                    fieldStateClass={requiredClass("Assessment")}
                    defaultValue={soap?.assessment}
                    placeholder="ประเมินปัญหา / ความเป็นไปได้"
                    disabled={isFinalized}
                  />
                </section>
                <section className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
                  <TextAreaField
                    label="P - Plan"
                    name="plan"
                    required
                    fieldStateClass={requiredClass("Plan")}
                    defaultValue={soap?.plan}
                    placeholder="แผนการรักษา / แนวทางการดูแล"
                    disabled={isFinalized}
                  />
                </section>
              </div>

              <div className="grid gap-2 2xl:grid-cols-[1.05fr_1fr]">
                <section className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
                  <h3 className="mb-2 text-base font-bold text-slate-950">
                    Physical Exam
                  </h3>
                  <div className="grid gap-2 md:grid-cols-4">
                    <SelectBox
                      label="Body Condition Score"
                      name="physicalExamSummary"
                      defaultValue={
                        soap?.physicalExamSummary ??
                        (visit.bodyConditionScore
                          ? `${visit.bodyConditionScore}/9`
                          : "")
                      }
                      options={[
                        "-",
                        "1/9",
                        "2/9",
                        "3/9",
                        "4/9",
                        "5/9",
                        "6/9",
                        "7/9",
                        "8/9",
                        "9/9",
                        "3/5 (Ideal)",
                      ]}
                      disabled={isFinalized}
                    />
                    <SelectBox
                      label="Hydration"
                      name="generalAppearanceNote"
                      defaultValue={
                        soap?.generalAppearanceNote ?? visit.hydrationStatus
                      }
                      options={[
                        "-",
                        "ปกติ",
                        "Mild dehydration",
                        "Moderate dehydration",
                        "Severe dehydration",
                      ]}
                      disabled={isFinalized}
                    />
                    <SelectBox
                      label="Mucous Membrane"
                      name="oralCavityNote"
                      defaultValue={soap?.oralCavityNote ?? visit.mucousMembrane}
                      options={["-", "Pink", "Pale", "Red", "Blue/Purple", "Yellow"]}
                      disabled={isFinalized}
                    />
                    <SelectBox
                      label="Lymph Node"
                      name="lymphNodeNote"
                      defaultValue={soap?.lymphNodeNote}
                      options={["-", "ปกติ", "โต", "เจ็บ", "ผิดปกติ"]}
                      disabled={isFinalized}
                    />
                  </div>
                  <div className="mt-2">
                    <TextAreaField
                      label="Other Findings"
                      name="objective"
                      defaultValue={soap?.objective ?? visit.clinicalNote}
                      placeholder="อื่นๆ ที่พบในการตรวจร่างกาย"
                      rows={4}
                      minHeightClass="min-h-[120px]"
                      disabled={isFinalized}
                    />
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
                  <div className="mb-2.5 flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-950">
                      Problem List
                    </h3>
                  </div>
                  <textarea
                    name="problemList"
                    defaultValue={soap?.problemList ?? ""}
                    placeholder="ชื่อปัญหาอาการ"
                    rows={6}
                    disabled={isFinalized}
                    className="min-h-[150px] w-full resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium leading-6 text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                  />
                  <div className="mt-3 flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-950">
                      Plan Items
                    </h3>
                  </div>
                  <textarea
                    name="treatmentPlanSummary"
                    defaultValue={soap?.treatmentPlanSummary ?? ""}
                    placeholder="ชื่อแผนการรักษา"
                    rows={6}
                    disabled={isFinalized}
                    className="mt-2 min-h-[150px] w-full resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium leading-6 text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </section>
              </div>

              <input
                type="hidden"
                name="historyOfPresentIllness"
                value={soap?.historyOfPresentIllness ?? ""}
              />
              <input
                type="hidden"
                name="diagnosisSummary"
                value={soap?.diagnosisSummary ?? ""}
              />
              <input
                type="hidden"
                name="medicationPlanNote"
                value={soap?.medicationPlanNote ?? ""}
              />
              <input
                type="hidden"
                name="followUpNote"
                value={soap?.followUpNote ?? ""}
              />
            </form>
          </main>

          <aside className="flex h-full flex-col gap-2">
            <section id="field-diagnosis" className={`rounded-xl border bg-white p-2.5 shadow-sm ${requiredClass("Diagnosis") || "border-slate-200"}`}>
              <h3 className="mb-2 text-base font-bold text-slate-950">
                Diagnosis
              </h3>
              <div className="mb-2 space-y-2">
                {visit.diagnoses.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-400">
                    No diagnosis recorded
                  </p>
                ) : (
                  visit.diagnoses.map((item) => (
                    <div
                      key={item.visitDiagnosisId}
                      className="flex items-center justify-between gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-3.5 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-bold text-slate-800">
                          {item.diagnosisCode
                            ? diagnosisName(item.diagnosisCode)
                            : item.diagnosisText || "-"}
                        </p>
                        <p className="font-semibold text-slate-500">
                          {item.diagnosisType}
                        </p>
                      </div>
                      {!isFinalized ? (
                        <form action={removeDiagnosisAction}>
                          <input
                            type="hidden"
                            name="visitDiagnosisId"
                            value={item.visitDiagnosisId}
                          />
                          <button className="text-xs font-bold text-red-600">
                            Remove
                          </button>
                        </form>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
              {!isFinalized ? (
                <form action={addDiagnosisAction} className="space-y-2">
                  <input type="hidden" name="visitId" value={visit.visitId} />

                  <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-2">
                    <select
                      name="diagnosisType"
                      defaultValue="PRIMARY"
                      className="h-10 rounded-lg border border-slate-200 px-2 text-xs font-semibold"
                    >
                      <option value="PRIMARY">PRIMARY</option>
                      <option value="SECONDARY">SECONDARY</option>
                      <option value="DIFFERENTIAL">DIFFERENTIAL</option>
                    </select>
                    <select
                      name="diagnosisCodeId"
                      defaultValue=""
                      className="h-10 min-w-0 rounded-lg border border-slate-200 px-2 text-xs font-semibold"
                    >
                      <option value="">Code</option>
                      {diagnosisCodes.map((code) => (
                        <option
                          key={code.diagnosisCodeId}
                          value={code.diagnosisCodeId}
                        >
                          {diagnosisName(code)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <input
                    name="diagnosisText"
                    placeholder="หรือระบุ diagnosis เอง"
                    className="h-10 w-full min-w-0 rounded-lg border border-slate-200 px-3 text-xs font-semibold"
                  />

                  <button className="h-10 w-full rounded-lg bg-blue-600 px-3 text-xs font-bold text-white transition hover:bg-blue-700">
                    + Add Diagnosis
                  </button>
                </form>
              ) : (
                <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                  SOAP finalized — diagnosis is read-only.
                </p>
              )}
            </section>

            <section className="flex-1 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
              <div className="mb-2">
                <h3 className="text-base font-bold text-slate-950">
                  Clinical Notes
                </h3>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="mb-1.5 text-xs font-bold text-slate-600">
                    Attachments
                  </p>
                  <div className="grid grid-cols-[1fr_1fr] gap-2">
                    <div className="rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-400">
                      File upload coming soon
                    </div>
                    <div className="rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-400">
                      No Files uploaded
                    </div>
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-bold text-slate-600">
                    Notes
                  </p>
                  <textarea
                    maxLength={500}
                    placeholder="หมายเหตุเพิ่มเติม"
                    rows={4}
                    disabled={isFinalized}
                    className="min-h-[72px] w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                  />
                  <p className="mt-1 text-right text-xs font-semibold text-slate-400">
                    0 / 500
                  </p>
                </div>

                {soap ? (
                  <div className="space-y-2 border-t border-slate-100 pt-2">
                    <p className="text-xs font-bold text-slate-600">
                      Finalize
                    </p>
                    <div className="space-y-2">
                      {isFinalized ? (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                          {soap.finalizationNote ? soap.finalizationNote : "No finalization note recorded."}
                        </div>
                      ) : (
                        <input
                          form="soap-draft-form"
                          name="finalizationNote"
                          placeholder="Finalization note"
                          defaultValue={soap.finalizationNote ?? ""}
                          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      )}
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          form="soap-draft-form"
                          formAction={finalizeSoapAction}
                          disabled={soap.status === "FINALIZED"}
                          className={`h-10 rounded-lg px-5 text-xs font-bold transition ${
                            soap.status === "FINALIZED"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-emerald-600 text-white hover:bg-emerald-700"
                          }`}
                        >
                          {soap.status === "FINALIZED"
                            ? "✓ SOAP Finalized"
                            : "Finalize SOAP"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          </aside>
        </div>

        <div className="mt-2 rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href={backHref}
              className="inline-flex justify-center rounded-lg border border-slate-200 px-6 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Back
            </Link>
            <div className="flex flex-wrap gap-3 sm:justify-end">
              <button
                type="submit"
                form="soap-draft-form"
                disabled={isFinalized}
                className="rounded-lg border border-blue-300 px-6 py-1.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
              >
                Save Draft
              </button>
              <button
                type="submit"
                form="soap-draft-form"
                formAction={saveSoapAndGoDiagnosis}
                disabled={isFinalized}
                className="rounded-lg bg-blue-600 px-6 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white"
              >
                {nextActionLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
