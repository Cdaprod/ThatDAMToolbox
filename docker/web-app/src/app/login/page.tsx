// /docker/web-app/src/app/login/page.tsx
// Simple Google SSO entry point.
'use client';

import { signIn } from 'next-auth/react';

export default function LoginPage() {
  return (
    <section className="max-w-md mx-auto py-8 text-center space-y-4">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <button
        className="px-4 py-2 bg-blue-600 text-white rounded"
        onClick={() => signIn('google')}
      >
        Continue with Google
      </button>
    </section>
  );
}

