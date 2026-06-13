import { describe, it, expect } from "vitest";
import { hasPermission } from "@/lib/permissions";

describe("hasPermission", () => {
  describe("user module", () => {
    it("ADMIN can manage users", () => {
      expect(hasPermission("ADMIN", "user", "manage")).toBe(true);
    });
    it("CLINIC_OWNER can manage users", () => {
      expect(hasPermission("CLINIC_OWNER", "user", "manage")).toBe(true);
    });
    it("RECEPTIONIST cannot manage users", () => {
      expect(hasPermission("RECEPTIONIST", "user", "manage")).toBe(false);
    });
    it("VETERINARIAN cannot delete users", () => {
      expect(hasPermission("VETERINARIAN", "user", "delete")).toBe(false);
    });
  });

  describe("pet module", () => {
    it("VETERINARIAN can view pets", () => {
      expect(hasPermission("VETERINARIAN", "pet", "view")).toBe(true);
    });
    it("GROOMER cannot view pets", () => {
      expect(hasPermission("GROOMER", "pet", "view")).toBe(false);
    });
    it("RECEPTIONIST can create pets", () => {
      expect(hasPermission("RECEPTIONIST", "pet", "create")).toBe(true);
    });
    it("CASHIER cannot create pets", () => {
      expect(hasPermission("CASHIER", "pet", "create")).toBe(false);
    });
    it("only ADMIN and CLINIC_OWNER can delete pets", () => {
      expect(hasPermission("ADMIN", "pet", "delete")).toBe(true);
      expect(hasPermission("CLINIC_OWNER", "pet", "delete")).toBe(true);
      expect(hasPermission("VETERINARIAN", "pet", "delete")).toBe(false);
      expect(hasPermission("RECEPTIONIST", "pet", "delete")).toBe(false);
    });
  });

  describe("appointment module", () => {
    it("VETERINARIAN can start treatment", () => {
      expect(hasPermission("VETERINARIAN", "appointment", "startTreatment")).toBe(true);
    });
    it("RECEPTIONIST cannot start treatment", () => {
      expect(hasPermission("RECEPTIONIST", "appointment", "startTreatment")).toBe(false);
    });
    it("RECEPTIONIST can cancel appointments", () => {
      expect(hasPermission("RECEPTIONIST", "appointment", "cancel")).toBe(true);
    });
    it("STAFF cannot cancel appointments", () => {
      expect(hasPermission("STAFF", "appointment", "cancel")).toBe(false);
    });
    it("STAFF can view appointments", () => {
      expect(hasPermission("STAFF", "appointment", "view")).toBe(true);
    });
    it("VET_ASSISTANT can check-in appointments", () => {
      expect(hasPermission("VET_ASSISTANT", "appointment", "checkIn")).toBe(true);
    });
    it("CASHIER cannot check-in appointments", () => {
      expect(hasPermission("CASHIER", "appointment", "checkIn")).toBe(false);
    });
  });

  describe("queue module", () => {
    it("VETERINARIAN can complete queue items", () => {
      expect(hasPermission("VETERINARIAN", "queue", "complete")).toBe(true);
    });
    it("RECEPTIONIST cannot complete queue items", () => {
      expect(hasPermission("RECEPTIONIST", "queue", "complete")).toBe(false);
    });
    it("RECEPTIONIST can cancel queue items", () => {
      expect(hasPermission("RECEPTIONIST", "queue", "cancel")).toBe(true);
    });
    it("PHARMACIST cannot access queue", () => {
      expect(hasPermission("PHARMACIST", "queue", "view")).toBe(false);
    });
  });

  describe("payment module", () => {
    it("CASHIER can create payments", () => {
      expect(hasPermission("CASHIER", "payment", "create")).toBe(true);
    });
    it("RECEPTIONIST can view payments", () => {
      expect(hasPermission("RECEPTIONIST", "payment", "view")).toBe(true);
    });
    it("RECEPTIONIST cannot create payments", () => {
      expect(hasPermission("RECEPTIONIST", "payment", "create")).toBe(false);
    });
    it("only ADMIN and CLINIC_OWNER can void payments", () => {
      expect(hasPermission("ADMIN", "payment", "void")).toBe(true);
      expect(hasPermission("CLINIC_OWNER", "payment", "void")).toBe(true);
      expect(hasPermission("CASHIER", "payment", "void")).toBe(false);
    });
  });

  describe("soap module", () => {
    it("VETERINARIAN can finalize SOAP notes", () => {
      expect(hasPermission("VETERINARIAN", "soap", "finalize")).toBe(true);
    });
    it("VET_ASSISTANT can view SOAP notes", () => {
      expect(hasPermission("VET_ASSISTANT", "soap", "view")).toBe(true);
    });
    it("VET_ASSISTANT cannot create SOAP notes", () => {
      expect(hasPermission("VET_ASSISTANT", "soap", "create")).toBe(false);
    });
    it("RECEPTIONIST cannot access SOAP notes", () => {
      expect(hasPermission("RECEPTIONIST", "soap", "view")).toBe(false);
    });
  });

  describe("empty modules (lab, inventory, etc.)", () => {
    it("returns false for any role on lab module", () => {
      expect(hasPermission("ADMIN", "lab", "view")).toBe(false);
      expect(hasPermission("VETERINARIAN", "lab", "create")).toBe(false);
    });
    it("returns false for any role on inventory module", () => {
      expect(hasPermission("ADMIN", "inventory", "manage")).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("returns false for non-existent action on a module", () => {
      expect(hasPermission("ADMIN", "pet", "void" as never)).toBe(false);
    });
  });
});
