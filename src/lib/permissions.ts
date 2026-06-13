import type { UserRole } from "@/generated/prisma/client";

export type ModuleName =
  | "user"
  | "pet"
  | "owner"
  | "appointment"
  | "blockTime"
  | "queue"
  | "visit"
  | "payment"

  // เพิ่มเติมสำหรับระบบระดับ Enterprise:
  | "soap" // ประวัติการรักษา
  | "lab" // ผลตรวจเลือด/เอกซเรย์
  | "inventory" // คลังยาและสินค้า
  | "prescription" // การสั่งและจัดยา
  | "ipd" // สัตว์ป่วยใน/แอดมิต
  | "groomer" // แผนกอาบน้ำตัดขน
  | "notification" // ระบบแจ้งเตือน/LINE
  | "auditLog" // ประวัติการเข้าถึงข้อมูล
  | "report" // รายงานบัญชีและสถิติคลินิก
  | "medicalDocument" // เอกสารทางการแพทย์ เช่น ใบรับรองแพทย์, ใบส่งตรวจ, ใบสั่งยา, ส่งต่อโรงพยาบาลสัตว์, ส่งต่อ Specialist, ส่งต่อ MRI / CT, ส่งต่อ Lab ภายนอก
  | "vaccine"; // ประวัติวัคซีนและระบบ reminder

export type ActionName =
  | "view"
  | "create"
  | "update"
  | "delete"
  | "manage"
  | "void"
  | "cancel"
  | "checkIn"
  | "complete"
  | "confirm"
  | "startTreatment"
  | "noShow"
  | "reschedule"
  | "finalize"
  | "addendum"
  | "diagnosis";

export const permissions: Record<
  ModuleName,
  Partial<Record<ActionName, UserRole[]>>
> = {
  user: {
    view: ["ADMIN", "CLINIC_OWNER"],
    create: ["ADMIN", "CLINIC_OWNER"],
    update: ["ADMIN", "CLINIC_OWNER"],
    delete: ["ADMIN", "CLINIC_OWNER"],
    manage: ["ADMIN", "CLINIC_OWNER"],
  },

  pet: {
    view: [
      "ADMIN",
      "CLINIC_OWNER",
      "VETERINARIAN",
      "VET_ASSISTANT",
      "RECEPTIONIST",
      "CASHIER",
    ],
    create: ["ADMIN", "CLINIC_OWNER", "VETERINARIAN", "RECEPTIONIST"],
    update: ["ADMIN", "CLINIC_OWNER", "VETERINARIAN", "RECEPTIONIST"],
    delete: ["ADMIN", "CLINIC_OWNER"],
  },

  owner: {
    view: [
      "ADMIN",
      "CLINIC_OWNER",
      "VETERINARIAN",
      "VET_ASSISTANT",
      "RECEPTIONIST",
      "CASHIER",
    ],
    create: ["ADMIN", "CLINIC_OWNER", "RECEPTIONIST"],
    update: ["ADMIN", "CLINIC_OWNER", "RECEPTIONIST"],
    delete: ["ADMIN", "CLINIC_OWNER"],
  },

  appointment: {
    view: [
      "ADMIN",
      "CLINIC_OWNER",
      "VETERINARIAN",
      "VET_ASSISTANT",
      "RECEPTIONIST",
      "CASHIER",
      "STAFF",
    ],
    create: ["ADMIN", "CLINIC_OWNER", "RECEPTIONIST", "VET_ASSISTANT"],
    update: ["ADMIN", "CLINIC_OWNER", "RECEPTIONIST"],
    delete: ["ADMIN", "CLINIC_OWNER"],

    confirm: ["ADMIN", "CLINIC_OWNER", "RECEPTIONIST", "VETERINARIAN"],
    checkIn: ["ADMIN", "CLINIC_OWNER", "RECEPTIONIST", "VET_ASSISTANT"],
    startTreatment: ["ADMIN", "CLINIC_OWNER", "VETERINARIAN"],
    complete: ["ADMIN", "CLINIC_OWNER", "VETERINARIAN"],
    cancel: ["ADMIN", "CLINIC_OWNER", "RECEPTIONIST"],
    noShow: ["ADMIN", "CLINIC_OWNER", "RECEPTIONIST"],
    reschedule: ["ADMIN", "CLINIC_OWNER", "RECEPTIONIST"],
  },

  blockTime: {
    view: [
      "ADMIN",
      "CLINIC_OWNER",
      "VETERINARIAN",
      "VET_ASSISTANT",
      "RECEPTIONIST",
      "STAFF",
    ],
    create: ["ADMIN", "CLINIC_OWNER", "RECEPTIONIST"],
    update: ["ADMIN", "CLINIC_OWNER", "RECEPTIONIST"],
    delete: ["ADMIN", "CLINIC_OWNER"],
    manage: ["ADMIN", "CLINIC_OWNER"],
  },

  queue: {
    view: [
      "ADMIN",
      "CLINIC_OWNER",
      "VETERINARIAN",
      "VET_ASSISTANT",
      "RECEPTIONIST",
      "STAFF",
    ],
    create: ["ADMIN", "CLINIC_OWNER", "RECEPTIONIST", "VET_ASSISTANT"],
    update: [
      "ADMIN",
      "CLINIC_OWNER",
      "RECEPTIONIST",
      "VET_ASSISTANT",
      "VETERINARIAN",
    ],
    complete: [
      "ADMIN",
      "CLINIC_OWNER",
      "VETERINARIAN",
      "VET_ASSISTANT",
    ],
    cancel: ["ADMIN", "CLINIC_OWNER", "RECEPTIONIST"],
    delete: ["ADMIN", "CLINIC_OWNER"],
    manage: ["ADMIN", "CLINIC_OWNER"],
  },

visit: {
  view: [
    "ADMIN",
    "CLINIC_OWNER",
    "VETERINARIAN",
    "VET_ASSISTANT",
    "RECEPTIONIST",
    "CASHIER",
    "PHARMACIST",
    "STAFF",
  ],
  create: ["ADMIN", "CLINIC_OWNER", "VETERINARIAN", "RECEPTIONIST"],
  checkIn: ["ADMIN", "CLINIC_OWNER", "RECEPTIONIST", "VET_ASSISTANT"],
  update: ["ADMIN", "CLINIC_OWNER", "VETERINARIAN", "VET_ASSISTANT"],
  complete: ["ADMIN", "CLINIC_OWNER", "VETERINARIAN"],
  cancel: ["ADMIN", "CLINIC_OWNER", "VETERINARIAN", "RECEPTIONIST"],
  delete: ["ADMIN", "CLINIC_OWNER"],
},

  payment: {
    view: ["ADMIN", "CLINIC_OWNER", "CASHIER", "RECEPTIONIST"],
    create: ["ADMIN", "CLINIC_OWNER", "CASHIER"],
    void: ["ADMIN", "CLINIC_OWNER"],
  },

  soap: {
    view: [
      "ADMIN",
      "CLINIC_OWNER",
      "VETERINARIAN",
      "VET_ASSISTANT",
    ],
    create: ["ADMIN", "CLINIC_OWNER", "VETERINARIAN"],
    update: ["ADMIN", "CLINIC_OWNER", "VETERINARIAN"],
    finalize: ["ADMIN", "CLINIC_OWNER", "VETERINARIAN"],
    addendum: ["ADMIN", "CLINIC_OWNER", "VETERINARIAN"],
    diagnosis: ["ADMIN", "CLINIC_OWNER", "VETERINARIAN"],
    delete: ["ADMIN", "CLINIC_OWNER"],
    manage: ["ADMIN", "CLINIC_OWNER"],
  },
  lab: {},
  inventory: {},
  prescription: {},
  ipd: {},
  groomer: {},
  notification: {},
  auditLog: {},
  report: {},
  medicalDocument: {},

  vaccine: {
    view: [
      "ADMIN",
      "CLINIC_OWNER",
      "VETERINARIAN",
      "VET_ASSISTANT",
      "RECEPTIONIST",
      "CASHIER",
      "STAFF",
    ],
    create: ["ADMIN", "CLINIC_OWNER", "VETERINARIAN", "VET_ASSISTANT"],
    update: ["ADMIN", "CLINIC_OWNER", "VETERINARIAN", "VET_ASSISTANT"],
    delete: ["ADMIN", "CLINIC_OWNER"],
  },
};

export function hasPermission(
  role: UserRole,
  moduleName: ModuleName,
  actionName: ActionName
) {
  return permissions[moduleName]?.[actionName]?.includes(role) ?? false;
}