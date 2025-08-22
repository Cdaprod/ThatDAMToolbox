/**
 * Server-only tenancy helpers.
 *
 * Example:
 *   const { slug, session } = await requireTenant();
 */
import "server-only";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function requireTenant() {
  const slug = headers().get("x-tenant-slug");
  if (!slug) throw new Error("Missing tenant slug");
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthenticated");
  return { slug, session };
}

export async function requireRole(_roles: ("owner" | "admin")[]) {
  await requireTenant();
}

