/**
 * Development credentials sign-in form.
 *
 * Example:
 *   <DevSignIn callbackUrl="/" />
 */
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';

export default function DevSignIn({ callbackUrl = '/' }: { callbackUrl?: string }) {
  const [email, setEmail] = useState('dev@local');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await signIn('credentials', {
      email,
      redirect: true,
      callbackUrl,
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block text-sm">
        <span className="mb-1 block text-muted-foreground">Email</span>
        <input
          className="w-full rounded-md bg-black/20 border border-border/60 px-3 py-2 outline-none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="you@local"
          required
        />
      </label>
      <button
        type="submit"
        className="w-full rounded-md px-3 py-2 bg-white/90 text-black hover:bg-white"
      >
        Sign in (development)
      </button>
    </form>
  );
}
