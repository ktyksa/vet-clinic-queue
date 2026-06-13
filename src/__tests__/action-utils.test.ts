import { describe, it, expect } from "vitest";
import {
  requiredString,
  optionalString,
  requiredDate,
  toJsonDate,
  formatDatePart,
  startOfDay,
  toCalendarDateParam,
  generateVisitNo,
  generateAppointmentNo,
  generateQueueCode,
  mapAppointmentTypeToVisitType,
  minutesBetween,
} from "@/lib/action-utils";

describe("requiredString", () => {
  it("returns trimmed string for normal input", () => {
    expect(requiredString("  hello  ")).toBe("hello");
  });
  it("returns empty string for null", () => {
    expect(requiredString(null)).toBe("");
  });
  it("returns empty string for undefined", () => {
    expect(requiredString(undefined)).toBe("");
  });
});

describe("optionalString", () => {
  it("returns trimmed string when non-empty", () => {
    expect(optionalString("  value  ")).toBe("value");
  });
  it("returns null for empty string", () => {
    expect(optionalString("")).toBeNull();
  });
  it("returns null for whitespace-only", () => {
    expect(optionalString("   ")).toBeNull();
  });
  it("returns null for null input", () => {
    expect(optionalString(null)).toBeNull();
  });
});

describe("requiredDate", () => {
  it("parses a valid ISO date string", () => {
    const d = requiredDate("2024-01-15");
    expect(d).toBeInstanceOf(Date);
    expect(Number.isNaN(d.getTime())).toBe(false);
  });
  it("throws for empty string", () => {
    expect(() => requiredDate("")).toThrow("Date is required.");
  });
  it("throws for invalid date", () => {
    expect(() => requiredDate("not-a-date")).toThrow("Invalid date.");
  });
  it("throws for null", () => {
    expect(() => requiredDate(null)).toThrow("Date is required.");
  });
});

describe("toJsonDate", () => {
  it("returns ISO string for a Date", () => {
    const d = new Date("2024-06-01T00:00:00.000Z");
    expect(toJsonDate(d)).toBe("2024-06-01T00:00:00.000Z");
  });
  it("returns null for null", () => {
    expect(toJsonDate(null)).toBeNull();
  });
  it("returns null for undefined", () => {
    expect(toJsonDate(undefined)).toBeNull();
  });
});

describe("formatDatePart", () => {
  it("formats date as YYYYMMDD", () => {
    expect(formatDatePart(new Date(2024, 0, 5))).toBe("20240105");
  });
  it("pads month and day with leading zeros", () => {
    expect(formatDatePart(new Date(2024, 8, 9))).toBe("20240909");
  });
});

describe("startOfDay", () => {
  it("resets time to 00:00:00.000", () => {
    const d = new Date(2024, 5, 13, 14, 30, 45, 999);
    const result = startOfDay(d);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });
  it("does not mutate the original date", () => {
    const d = new Date(2024, 5, 13, 14, 30);
    startOfDay(d);
    expect(d.getHours()).toBe(14);
  });
});

describe("toCalendarDateParam", () => {
  it("formats as YYYY-MM-DD", () => {
    expect(toCalendarDateParam(new Date(2024, 0, 5))).toBe("2024-01-05");
  });
  it("pads month and day", () => {
    expect(toCalendarDateParam(new Date(2024, 8, 9))).toBe("2024-09-09");
  });
});

describe("generateVisitNo", () => {
  it("starts with VIS-", () => {
    expect(generateVisitNo()).toMatch(/^VIS-/);
  });
  it("includes the date part", () => {
    const d = new Date(2024, 0, 15);
    expect(generateVisitNo(d)).toMatch(/^VIS-20240115-/);
  });
  it("generates unique values", () => {
    const a = generateVisitNo();
    const b = generateVisitNo();
    expect(a).not.toBe(b);
  });
});

describe("generateAppointmentNo", () => {
  it("starts with APT-", () => {
    expect(generateAppointmentNo()).toMatch(/^APT-/);
  });
  it("includes the date part", () => {
    const d = new Date(2024, 5, 1);
    expect(generateAppointmentNo(d)).toMatch(/^APT-20240601-/);
  });
});

describe("generateQueueCode", () => {
  it("formats as MQ-YYYYMMDD-NNN", () => {
    const d = new Date(2024, 0, 5);
    expect(generateQueueCode(d, 7)).toBe("MQ-20240105-007");
  });
  it("pads queue number to 3 digits", () => {
    const d = new Date(2024, 5, 13);
    expect(generateQueueCode(d, 42)).toBe("MQ-20240613-042");
  });
  it("handles triple-digit queue numbers", () => {
    const d = new Date(2024, 5, 13);
    expect(generateQueueCode(d, 123)).toBe("MQ-20240613-123");
  });
});

describe("mapAppointmentTypeToVisitType", () => {
  it("maps VACCINE → VACCINATION", () => {
    expect(mapAppointmentTypeToVisitType("VACCINE")).toBe("VACCINATION");
  });
  it("maps SURGERY → SURGERY", () => {
    expect(mapAppointmentTypeToVisitType("SURGERY")).toBe("SURGERY");
  });
  it("maps FOLLOW_UP → FOLLOW_UP", () => {
    expect(mapAppointmentTypeToVisitType("FOLLOW_UP")).toBe("FOLLOW_UP");
  });
  it("maps unknown type → CONSULTATION", () => {
    expect(mapAppointmentTypeToVisitType("GROOMING")).toBe("CONSULTATION");
    expect(mapAppointmentTypeToVisitType("CHECKUP")).toBe("CONSULTATION");
  });
});

describe("minutesBetween", () => {
  it("returns null when start is null", () => {
    expect(minutesBetween(null, new Date())).toBeNull();
  });
  it("returns null when start is undefined", () => {
    expect(minutesBetween(undefined, new Date())).toBeNull();
  });
  it("calculates minutes correctly", () => {
    const start = new Date("2024-06-13T08:00:00Z");
    const end = new Date("2024-06-13T08:45:00Z");
    expect(minutesBetween(start, end)).toBe(45);
  });
  it("returns 0 when end is before start (floor at 0)", () => {
    const start = new Date("2024-06-13T09:00:00Z");
    const end = new Date("2024-06-13T08:00:00Z");
    expect(minutesBetween(start, end)).toBe(0);
  });
  it("rounds fractional minutes", () => {
    const start = new Date("2024-06-13T08:00:00Z");
    const end = new Date(start.getTime() + 90_000); // +90 seconds = 1.5 min → rounds to 2
    expect(minutesBetween(start, end)).toBe(2);
  });
});
