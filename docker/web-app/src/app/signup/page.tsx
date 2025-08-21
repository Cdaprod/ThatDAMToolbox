// /docker/web-app/src/app/signup/page.tsx
'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';

/**
 * SignupPage creates a personal tenant then optionally lets the user
 * create an organization or invite members.
 *
 * Example:
 * ```tsx
 * <SignupPage />
 * ```
 */
interface SignupPageProps {
  router?: { push: (url: string) => void };
}

export default function SignupPage({
  router = useRouter(),
}: SignupPageProps = {}) {
  const { login } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [tenant, setTenant] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch('/api/tenancy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      if (!res.ok) throw new Error('signup failed');
      const data = await res.json();
      login(data.token, { name }, data.tenantId);
      setTenant(data.tenantId);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (tenant) {
    return (
      <section className="max-w-md mx-auto py-8 text-center space-y-6">
        <h1 className="text-2xl font-bold">Welcome</h1>
        <p>Your workspace is ready.</p>
        <div className="space-x-4">
          <button
            className="underline"
            onClick={() => router.push('/create-org')}
          >
            Create Organization
          </button>
          <button
            className="underline"
            onClick={() => router.push('/invite')}
          >
            Invite Members
          </button>
        </div>
        <button
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
          onClick={() => router.push(`/${tenant}/dashboard`)}
        >
          Go to Dashboard
        </button>
      </section>
    );
  }

  return (
    <section className="max-w-md mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Sign Up</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          className="w-full border p-2"
          placeholder="Name"
          value={name}
          onChange={e => setName(e.target.value)}
          required
        />
        <input
          className="w-full border p-2"
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        {error && <p className="text-red-600">{error}</p>}
        <button
          type="submit"
          className="w-full bg-blue-600 text-white px-4 py-2 rounded"
        >
          Create Account
        </button>
      </form>
    </section>
  );
}

