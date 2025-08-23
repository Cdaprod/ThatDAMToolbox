/**
 * Middleware tagging requests with the current tenant slug.
 *
 * Example:
 *   visiting /acme/dashboard sets `x-tenant-slug: acme`
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Tags responses with tenant slug and optionally checks local node session.
 * Example:
 *   request /acme/dashboard -> header x-tenant-slug: acme
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length > 0) {
    const tenant = parts[0];
    const isPublic = ["api", "auth", "studio", "login", "favicon.ico", "pair"].includes(tenant);
    if (!isPublic) {
      const res = NextResponse.next();
      res.headers.set("x-tenant-slug", decodeURIComponent(tenant));
      return res;
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};

