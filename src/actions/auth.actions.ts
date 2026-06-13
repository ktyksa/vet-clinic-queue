"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    throw new Error("กรุณากรอกอีเมลและรหัสผ่าน");
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/pets",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      throw new Error("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    }

    throw error;
  }
}

export async function logoutAction(): Promise<void> {
  await signOut({
    redirectTo: "/login",
  });
}