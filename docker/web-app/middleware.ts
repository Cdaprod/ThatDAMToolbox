/**
 * Middleware tagging requests with the current tenant slug.
 *
 * Example: visiting /acme/dashboard sets x-tenant-slug: acme.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length > 0) {
    const maybeTenant = parts[0];
    const isPublic = ["api", "auth", "studio", "login", "favicon.ico"].includes(maybeTenant);
    if (isPublic) return NextResponse.next();
    const res = NextResponse.next();
    res.headers.set("x-tenant-slug", decodeURIComponent(maybeTenant));
    return res;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};

