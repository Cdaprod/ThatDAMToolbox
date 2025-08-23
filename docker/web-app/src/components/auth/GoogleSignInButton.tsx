/**
 * Google-branded sign in button.
 *
 * Example:
 *   <GoogleSignInButton fullWidth />
 */
'use client';

import { signIn } from 'next-auth/react';

type Props = {
  callbackUrl?: string;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
  dark?: boolean;
};

export default function GoogleSignInButton({
  callbackUrl = '/',
  fullWidth = false,
  size = 'md',
  dark = false,
}: Props) {
  const px = size === 'sm' ? '10px' : size === 'lg' ? '16px' : '12px';
  const py = size === 'sm' ? '8px' : size === 'lg' ? '12px' : '10px';
  const fs = size === 'sm' ? 14 : size === 'lg' ? 16 : 15;

  // Google brand: white button (dark gets near-black), gray border, subtle shadow,
  // exact label “Sign in with Google”, Google "G" mark at 18px.
  const bg = dark ? '#131314' : '#ffffff';
  const color = dark ? '#E3E3E3' : '#1f1f1f';
  const border = dark ? '1px solid #3c4043' : '1px solid #dadce0';

  return (
    <button
      type="button"
      onClick={() => signIn('google', { callbackUrl })}
      aria-label="Sign in with Google"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        background: bg,
        color,
        border,
        borderRadius: 999,
        padding: `${py} ${px}`,
        fontSize: fs,
        fontWeight: 500,
        lineHeight: 1,
        boxShadow: dark
          ? '0 1px 1px rgba(0,0,0,0.25)'
          : '0 1px 2px rgba(0,0,0,0.05)',
        cursor: 'pointer',
        width: fullWidth ? '100%' : undefined,
        transition: 'transform .02s ease, background .15s ease',
      }}
      onMouseDown={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(1px)';
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
      }}
    >
      {/* Google "G" mark (official multi-color paths, 18x18 box) */}
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.72 1.22 9.22 3.6l6.9-6.9C35.9 1.9 30.35 0 24 0 14.62 0 6.38 5.38 2.56 13.22l8.95 6.95C13.01 13.6 18.06 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.5 24c0-1.55-.14-3.04-.4-4.5H24v9h12.7c-.55 2.95-2.2 5.44-4.7 7.1l7.2 5.6C43.8 37.1 46.5 31.1 46.5 24z"/>
        <path fill="#FBBC05" d="M11.51 20.17l-8.95-6.95C.89 15.36 0 19.57 0 24c0 4.42.89 8.64 2.56 12.78l8.95-6.95C10.66 27.36 10 25.73 10 24s.66-3.36 1.51-3.83z"/>
        <path fill="#34A853" d="M24 48c6.35 0 11.9-2.1 15.9-5.7l-7.2-5.6c-2.02 1.37-4.62 2.2-8.7 2.2-5.94 0-10.99-4.1-12.49-9.67l-8.95 6.95C6.38 42.62 14.62 48 24 48z"/>
        <path fill="none" d="M0 0h48v48H0z"/>
      </svg>
      <span>Sign in with Google</span>
    </button>
  );
}

