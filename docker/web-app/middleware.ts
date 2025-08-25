/**
 * Middleware providing tenant-aware routing and header tagging.
 *
 * Behaviors:
 *   - `/` or `/dashboard` redirect to `/{tenant}/dashboard` when a default
 *     tenant is known (cookie or API), else to `/login`.
 *   - All other tenant routes receive `x-tenant-slug` response header.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const { pathname } = url;

  // Skip API and static assets
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/public")
  )
    return NextResponse.next();

  // Prefer cookie for default tenant
  const cookieTenant = req.cookies.get("cda_tenant")?.value ?? null;

  async function getDefaultTenantViaApi(): Promise<string | null> {
    try {
      const res = await fetch(new URL("/api/account/default-tenant", url).toString(), {
        headers: { cookie: req.headers.get("cookie") ?? "" },
        cache: "no-store",
      });
      if (!res.ok) return null;
      const data = await res.json();
      const t = data?.tenant?.slug || data?.tenant;
      return t ? String(t) : null;
    } catch {
      return null;
    }
  }

  if (pathname === "/" || pathname === "/dashboard") {
    const tenant = cookieTenant || (await getDefaultTenantViaApi());
    return NextResponse.redirect(new URL(tenant ? `/${tenant}/dashboard` : "/login", url));
  }

  // Tag tenant slug header for other routes
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

export const config = { matcher: ["/((?!_next|api|favicon|public).*)"] };

