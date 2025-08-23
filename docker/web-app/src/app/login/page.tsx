// Server component rendering the Google GIS button when configured
import GoogleGISButton from '@/components/auth/GoogleGISButton';
import { getServerSession } from 'next-auth/next';
import { getAuthOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const authOptions = getAuthOptions();
  const session = await getServerSession(authOptions);
  if (session) redirect('/' + (session.user?.tenant ?? 'demo') + '/dashboard');

  const googleEnabled = authOptions.providers.some((p) => p.id === 'google');

  return (
    <main className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="w-full max-w-[420px] rounded-2xl border border-zinc-800/40 bg-black/30 p-6 backdrop-blur">
        <h1 className="text-2xl font-semibold mb-2">Welcome</h1>
        <p className="text-sm text-zinc-400 mb-6">
          Sign in to continue to your dashboard.
        </p>
        {googleEnabled ? (
          <GoogleGISButton />
        ) : (
          <Link href="/api/auth/signin" className="text-sm underline">
            Use development sign-in
          </Link>
        )}
      </div>
    </main>
  );
}

