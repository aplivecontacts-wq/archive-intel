'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { SignIn, useAuth } from '@clerk/nextjs';

/**
 * If a session already exists, embedded <SignIn /> only shows “already signed in”.
 * Use a full page navigation to /app so middleware + auth() see the same session cookie
 * as the server (router.replace alone can loop: client userId vs auth.protect() on /app).
 * Guard with a ref so we only call location.replace once — without it, the effect can re-run
 * many times before navigation completes.
 */
export default function LoginPage() {
  const { isLoaded, userId } = useAuth();
  const didRedirectToApp = useRef(false);

  useEffect(() => {
    if (!isLoaded || !userId || didRedirectToApp.current) return;
    didRedirectToApp.current = true;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const href = appUrl ? new URL('/app', appUrl).toString() : '/app';
    window.location.replace(href);
  }, [isLoaded, userId]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <p className="font-mono text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  if (userId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <p className="font-mono text-sm text-emerald-700">Opening app…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="mb-6">
        <Link href="/" className="text-sm text-emerald-600 hover:text-emerald-700 font-mono">
          &lt; RETURN TO HOME
        </Link>
      </div>
      <SignIn
        routing="hash"
        fallbackRedirectUrl="/app"
        appearance={{
          variables: { colorPrimary: '#059669' },
        }}
      />
    </div>
  );
}
