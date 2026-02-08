'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * Always links to /app. Clerk middleware protects /app and redirects
 * unauthenticated users to /login (NEXT_PUBLIC_CLERK_SIGN_IN_URL).
 */
export function AccessSystemButton() {
  return (
    <Button
      asChild
      variant="outline"
      className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 font-mono"
    >
      <Link href="/app">ACCESS SYSTEM</Link>
    </Button>
  );
}
