'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * Links to /app. Clerk middleware protects /app and sends unauthenticated users
 * to sign-in (NEXT_PUBLIC_CLERK_SIGN_IN_URL).
 */
export function AccessSystemButton() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const href = appUrl ? new URL('/app', appUrl).toString() : '/app';

  return (
    <Button
      asChild
      variant="outline"
      className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 font-mono"
    >
      <Link href={href}>ACCESS SYSTEM</Link>
    </Button>
  );
}
