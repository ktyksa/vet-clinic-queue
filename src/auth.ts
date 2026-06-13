import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/security/password";
import { securityConfig } from "@/config/security.config";
import { authConfig } from "@/auth.config";
import type { Language, UserRole, UserStatus } from "@/generated/prisma/client";

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip");
}

const fullAuthConfig = {
  ...authConfig,

  session: {
    strategy: "jwt" as const,
    maxAge: securityConfig.auth.sessionMaxAgeSeconds,
  },

  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        email: {},
        password: {},
      },

      async authorize(credentials, request) {
        const email = String(credentials?.email || "").trim().toLowerCase();
        const password = String(credentials?.password || "");
        const ipAddress = getClientIp(request);

        if (!email || !password) {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
          return null;
        }

        if (
          user.status !== "ACTIVE" ||
          !user.activeFlag ||
          (user.lockedUntil && user.lockedUntil > new Date())
        ) {
          await prisma.auditLog.create({
            data: {
              userId: user.userId,
              action: "LOGIN_BLOCKED",
              entityName: "User",
              entityId: user.userId,
              newValue: { email: user.email, reason: user.lockedUntil ? "account_locked" : "account_inactive" },
              ipAddress,
            },
          });
          return null;
        }

        if (!user.passwordHash) {
          return null;
        }

        const validPassword = await verifyPassword(password, user.passwordHash);

        if (!validPassword) {
          const newFailedCount = (user.failedLoginCount ?? 0) + 1;
          const { maxFailedLoginAttempts, lockoutDurationMinutes } = securityConfig.auth;
          const shouldLock = newFailedCount >= maxFailedLoginAttempts;
          const lockedUntil = shouldLock
            ? new Date(Date.now() + lockoutDurationMinutes * 60_000)
            : null;

          await prisma.user.update({
            where: { userId: user.userId },
            data: {
              failedLoginCount: newFailedCount,
              ...(shouldLock ? { lockedUntil } : {}),
            },
          });

          await prisma.auditLog.create({
            data: {
              userId: user.userId,
              action: shouldLock ? "LOGIN_FAILED_ACCOUNT_LOCKED" : "LOGIN_FAILED",
              entityName: "User",
              entityId: user.userId,
              newValue: { email: user.email, failedCount: newFailedCount, lockedUntil: lockedUntil?.toISOString() ?? null },
              ipAddress,
            },
          });

          return null;
        }

        await prisma.user.update({
          where: { userId: user.userId },
          data: {
            lastLoginAt: new Date(),
            failedLoginCount: 0,
            lockedUntil: null,
          },
        });

        await prisma.auditLog.create({
          data: {
            userId: user.userId,
            action: "LOGIN_SUCCESS",
            entityName: "User",
            entityId: user.userId,
            newValue: { email: user.email, role: user.role, preferredLanguage: user.preferredLanguage },
            ipAddress,
          },
        });

        return {
          id: user.userId,
          name: user.fullName,
          email: user.email,
          role: user.role,
          status: user.status,
          preferredLanguage: user.preferredLanguage,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.status = user.status;
        token.preferredLanguage = user.preferredLanguage;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.userId = token.userId as string;
        session.user.role = token.role as UserRole;
        session.user.status = token.status as UserStatus;
        session.user.preferredLanguage = token.preferredLanguage as Language;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(fullAuthConfig);
