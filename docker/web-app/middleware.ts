/**
 * Middleware tagging requests with the current tenant slug and enforcing node
 * pairing for protected tenant routes.
 *
 * Examples:
 *   visiting /acme/dashboard sets `x-tenant-slug: acme`
 *   visiting /acme/dashboard without a session redirects to /pair
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Redirect to the pairing screen when protected tenant pages are accessed
  // without an active node session cookie. Protected pages include tenant
  // dashboards, access control and settings screens.
  const needsAuth = /^\/[^/]+\/(dashboard|access-control|settings)/.test(pathname);
  const hasSession = req.cookies.get("node_session");
  if (needsAuth && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/pair";
    return NextResponse.redirect(url);
  }

  const parts = pathname.split("/").filter(Boolean);
  if (parts.length > 0) {
    const maybeTenant = parts[0];
    const isPublic = ["api", "auth", "studio", "login", "favicon.ico", "pair"].includes(maybeTenant);
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

