/**
 * NextAuth handler providing Google SSO.
 * Falls back to a development credentials provider when Google
 * credentials are not configured.
 *
 * Example:
 *   GET /api/auth/signin (redirects to /login)
 *
 * Environment variables:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_URL, NEXTAUTH_SECRET
 */
import NextAuth from "next-auth";
import { getAuthOptions } from "@/lib/auth";

const handler = NextAuth(getAuthOptions());
export { handler as GET, handler as POST };

