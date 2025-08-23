/**
 * Google Identity Services sign-in button.
 *
 * Example:
 *   <GoogleGISButton />
 */
'use client';

import { useEffect, useRef } from 'react';
import { signIn } from 'next-auth/react';

export default function GoogleGISButton({ callbackUrl = '/' }: { callbackUrl?: string }) {
  const btnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = 'google-identity-services';
    if (!document.getElementById(id)) {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.defer = true;
      s.id = id;
      s.onload = render;
      document.head.appendChild(s);
    } else {
      render();
    }

    function render() {
      // @ts-ignore Google Identity Services attaches to window
      if (window.google?.accounts?.id && btnRef.current) {
        // Render official button
        // @ts-ignore
        window.google.accounts.id.renderButton(btnRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          logo_alignment: 'left',
          text: 'signin_with',
        });
        btnRef.current.addEventListener(
          'click',
          () => signIn('google', { callbackUrl }),
          { once: true }
        );
      }
    }
  }, [callbackUrl]);

  return <div ref={btnRef} />;
}

