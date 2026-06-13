"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-auth";
import { requiredString, optionalString } from "@/lib/action-utils";
import type { GroomingService } from "@/generated/prisma/client";

export async function getActiveGroomingServices(): Promise<GroomingService[]> {
  await requirePermission("groomer", "view");
  return prisma.groomingService.findMany({
    where: { isActive: true },
    orderBy: { serviceName: "asc" },
  });
}

export async function getAllGroomingServices(): Promise<GroomingService[]> {
  await requirePermission("groomer", "view");
  return prisma.groomingService.findMany({ orderBy: { serviceName: "asc" } });
}

export async function createGroomingService(formData: FormData) {
  const currentUser = await requirePermission("groomer", "create");

  const serviceName = requiredString(formData.get("serviceName"));
  const priceStr = requiredString(formData.get("price"));
  const durationMinStr = requiredString(formData.get("durationMin"));

  if (!serviceName) throw new Error("ชื่อบริการต้องไม่ว่างเปล่า");
  const price = parseFloat(priceStr);
  if (isNaN(price) || price < 0) throw new Error("ราคาไม่ถูกต้อง");
  const durationMin = parseInt(durationMinStr, 10);
  if (isNaN(durationMin) || durationMin < 1) throw new Error("ระยะเวลาไม่ถูกต้อง");

  await prisma.groomingService.create({
    data: {
      serviceName,
      price,
      durationMin,
      createdByUserId: currentUser.userId,
      updatedByUserId: currentUser.userId,
    },
  });

  revalidatePath("/setup/grooming-services");
  revalidatePath("/grooming");
}

export async function toggleGroomingServiceActive(groomingServiceId: string) {
  const currentUser = await requirePermission("groomer", "update");

  const service = await prisma.groomingService.findUnique({
    where: { groomingServiceId },
    select: { isActive: true },
  });
  if (!service) throw new Error("ไม่พบบริการ");

  await prisma.groomingService.update({
    where: { groomingServiceId },
    data: {
      isActive: !service.isActive,
      updatedByUserId: currentUser.userId,
    },
  });

  revalidatePath("/setup/grooming-services");
  revalidatePath("/grooming");
}

export async function seedGroomingServices() {
  await requirePermission("groomer", "create");

  const existing = await prisma.groomingService.count();
  if (existing > 0) return;

  await prisma.groomingService.createMany({
    data: [
      { serviceName: "อาบน้ำ", price: 350, durationMin: 60 },
      { serviceName: "ตัดขน", price: 450, durationMin: 90 },
      { serviceName: "อาบน้ำ + ตัดขน", price: 700, durationMin: 120 },
      { serviceName: "ตัดเล็บ", price: 150, durationMin: 20 },
      { serviceName: "บีบต่อมกลิ่น", price: 100, durationMin: 15 },
    ],
  });

  revalidatePath("/setup/grooming-services");
  revalidatePath("/grooming");
}
