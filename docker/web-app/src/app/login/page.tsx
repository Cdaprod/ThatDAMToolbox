// Server component rendering the Google GIS button when configured
import GoogleGISButton from '@/components/auth/GoogleGISButton';
import { getServerSession } from 'next-auth/next';
import { getAuthOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DevSignIn from '@/components/auth/DevSignIn';
import VoidScene from '@/components/void/VoidScene';
import nextDynamic from 'next/dynamic';

export const dynamic = 'force-dynamic';

// dynamic import for neon title on client
const NeonTitle = nextDynamic(() => import('@/components/void/NeonTitle'), {
  ssr: false,
});

export default async function LoginPage() {
  const authOptions = await getAuthOptions(); // if this is async in your impl
  const session = await getServerSession(authOptions);
  if (session) redirect('/' + (session.user?.tenant ?? 'demo') + '/dashboard');

  const googleEnabled = authOptions.providers.some((p) => p.id === 'google');

  return (
    <main className="relative min-h-[100svh] flex items-center justify-center overflow-hidden">
      <VoidScene />
      <div className="relative z-10 grid gap-6 justify-items-center p-6">
        <NeonTitle title="THATDAMTOOLBOX" subtitle="Sign in to continue" />
        <div className="grid gap-3 w-[min(88vw,360px)] pointer-events-auto">
          {googleEnabled ? (
            <GoogleGISButton />
          ) : (
            <DevSignIn callbackUrl="/" />
          )}
        </div>
      </div>
    </main>
  );
}

