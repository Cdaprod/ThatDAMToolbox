/**
 * NextAuth handler providing Google SSO.
 *
 * Example:
 *   GET /api/auth/signin
 *
 * Environment variables:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_URL, NEXTAUTH_SECRET
 */
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

