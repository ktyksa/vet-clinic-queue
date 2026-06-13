import type { DefaultSession } from "next-auth";
import type { Language, UserRole, UserStatus } from "@/generated/prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      userId: string;
      role: UserRole | string;
      status: UserStatus | string;
      preferredLanguage: Language | string;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    status: UserStatus;
    preferredLanguage: Language;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    role: UserRole | string;
    status: UserStatus | string;
    preferredLanguage: Language | string;
  }
}