import type { AppointmentType, VisitType } from "@/generated/prisma/client";

export function requiredString(value: FormDataEntryValue | null | undefined): string {
  return String(value ?? "").trim();
}

export function optionalString(value: FormDataEntryValue | null | undefined): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

export function requiredDate(value: FormDataEntryValue | null | undefined): Date {
  const text = requiredString(value);
  if (!text) throw new Error("Date is required.");
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date.");
  return date;
}

export function toJsonDate(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function formatDatePart(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function toCalendarDateParam(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function generateVisitNo(date = new Date()): string {
  return `VIS-${formatDatePart(date)}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export function generateAppointmentNo(date = new Date()): string {
  return `APT-${formatDatePart(date)}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export function generateQueueCode(queueDate: Date, queueNumber: number): string {
  return `MQ-${formatDatePart(queueDate)}-${String(queueNumber).padStart(3, "0")}`;
}

export function mapAppointmentTypeToVisitType(appointmentType: AppointmentType | string): VisitType {
  if (appointmentType === "VACCINE") return "VACCINATION";
  if (appointmentType === "SURGERY") return "SURGERY";
  if (appointmentType === "FOLLOW_UP") return "FOLLOW_UP";
  return "CONSULTATION";
}

export function minutesBetween(start: Date | null | undefined, end: Date): number | null {
  if (!start) return null;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));
}
