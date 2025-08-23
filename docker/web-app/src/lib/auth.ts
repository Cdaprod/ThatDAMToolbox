/**
 * Shared NextAuth configuration.
 *
 * Example:
 *   import { authOptions } from "@/lib/auth";
 *   const session = await getServerSession(authOptions);
 */
import { type NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

/**
 * Build NextAuth options. Uses Google OAuth when client credentials are
 * configured, otherwise falls back to a basic email-only credentials provider
 * in non-production environments.
 */
export function buildAuthOptions(): NextAuthOptions {
  const providers: NextAuthOptions['providers'] = [];
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      })
    );
  } else if (process.env.NODE_ENV !== 'production') {
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
    secret: process.env.NEXTAUTH_SECRET,
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

export const authOptions: NextAuthOptions = buildAuthOptions();
