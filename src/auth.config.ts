import type { NextAuthConfig } from "next-auth";

const PUBLIC_PATHS = ["/login", "/unauthorized"];
// API routes that do not require authentication (e.g. health checks for load balancers)
const PUBLIC_API_PATHS = ["/api/health"];

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const pathname = nextUrl.pathname;

      // NextAuth own routes are always allowed
      if (pathname.startsWith("/api/auth")) return true;

      // Explicitly public pages and API routes
      if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
      if (PUBLIC_API_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;

      // For all other /api/* routes: return 401 JSON (not a redirect) when unauthenticated
      if (pathname.startsWith("/api/")) {
        if (!auth?.user) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        return true;
      }

      // For page routes: redirect to /login when unauthenticated
      return !!auth?.user;
    },
  },
};
