// Server component that renders the branded Google button
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect('/' + (session.user?.tenant ?? 'demo') + '/dashboard');

  return (
    <main className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="w-full max-w-[420px] rounded-2xl border border-zinc-800/40 bg-black/30 p-6 backdrop-blur">
        <h1 className="text-2xl font-semibold mb-2">Welcome</h1>
        <p className="text-sm text-zinc-400 mb-6">
          Sign in to continue to your dashboard.
        </p>
        <GoogleSignInButton fullWidth />
      </div>
    </main>
  );
}

