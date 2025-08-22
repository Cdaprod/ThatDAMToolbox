/**
 * Shared NextAuth configuration.
 *
 * Example:
 *   import { authOptions } from "@/lib/auth";
 *   const session = await getServerSession(authOptions);
 */
import { type NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token }) {
      return token;
    },
    async session({ session, token }) {
      (session as any).tenants = (token as any).tenants ?? [];
      return session;
    },
  },
};
