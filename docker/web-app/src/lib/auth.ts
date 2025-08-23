/**
 * Shared NextAuth configuration.
 *
 * Example:
 *   import { getAuthOptions } from "@/lib/auth";
 *   const session = await getServerSession(getAuthOptions());
 */
import { type NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

/**
 * Build NextAuth options. Uses Google OAuth when client credentials are
 * configured, otherwise falls back to a basic email-only credentials provider
 * in non-production environments.
 */
export function getAuthOptions(): NextAuthOptions {
  const providers: NextAuthOptions['providers'] = [];
  const clientId = process.env["GOOGLE_CLIENT_ID"];
  const clientSecret = process.env["GOOGLE_CLIENT_SECRET"];

  if (clientId && clientSecret) {
    providers.push(
      Google({
        clientId,
        clientSecret,
      })
    );
  } else if (process.env["NODE_ENV"] !== "production") {
    providers.push(
      Credentials({
        name: 'Dev Login',
        credentials: { email: { label: 'Email', type: 'email' } },
        async authorize(creds) {
          if (!creds?.email) return null;
          return {
            id: 'dev',
            email: String(creds.email),
            name: 'Dev User',
            tenant: 'demo',
            role: 'admin',
          } as any;
        },
      })
    );
  }

  return {
    providers,
    secret: process.env["NEXTAUTH_SECRET"],
    pages: { signIn: '/login' },
    session: { strategy: 'jwt' },
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
}
