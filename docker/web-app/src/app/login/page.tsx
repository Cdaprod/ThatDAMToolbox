// Server component rendering the Google GIS button when configured
import GoogleGISButton from '@/components/auth/GoogleGISButton';
import { getServerSession } from 'next-auth/next';
import { getAuthOptions } from '@/lib/auth';
import TenantRedirect from './TenantRedirect';
import DevSignIn from '@/components/auth/DevSignIn';
import { Suspense } from 'react';
import NeonTitle from '@/components/void/NeonTitle.client';
import VoidScene from '@/components/void/VoidScene.client';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const authOptions = getAuthOptions();
  const session = await getServerSession(authOptions);
  if (session) {
    const tenant = session.user?.tenant ?? 'demo';
    // cookie is set client-side via TenantRedirect
    return <TenantRedirect tenant={tenant} />;
  }

  const googleEnabled = authOptions.providers.some((p) => p.id === 'google');

  return (
    <main className="relative min-h-[100svh] flex items-center justify-center overflow-hidden">
      <Suspense fallback={null}>
        <VoidScene />
      </Suspense>
      <div className="relative z-10 grid gap-6 justify-items-center p-6">
        <Suspense fallback={null}>
          <NeonTitle title="THATDAMTOOLBOX" subtitle="Sign in to continue" />
        </Suspense>
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

