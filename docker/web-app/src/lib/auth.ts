/**
 * Shared NextAuth configuration.
 *
 * Example:
 *   import { getAuthOptions } from "@/lib/auth";
 *   const session = await getServerSession(getAuthOptions());
 */
import { type NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

/**
 * Build NextAuth options. Uses Google OAuth when client credentials are
 * configured, otherwise falls back to a basic email-only credentials provider
 * in non-production environments.
 */
export function getAuthOptions(): NextAuthOptions {
  const isProd = process.env["NODE_ENV"] === "production";

  const providers: NextAuthOptions['providers'] = [
    ...(!isProd
      ? [
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
          }),
        ]
      : []),
    ...(process.env["GOOGLE_CLIENT_ID"] && process.env["GOOGLE_CLIENT_SECRET"]
      ? [
          GoogleProvider({
            clientId: process.env["GOOGLE_CLIENT_ID"]!,
            clientSecret: process.env["GOOGLE_CLIENT_SECRET"]!,
          }),
        ]
      : []),
  ];

  return {
    providers,
    secret:
      process.env["NEXTAUTH_SECRET"] ?? (!isProd ? "dev-secret-only" : undefined),
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
    debug: process.env["NEXTAUTH_DEBUG"] === 'true',
  };
}
