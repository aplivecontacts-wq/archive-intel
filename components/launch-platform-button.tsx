'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';

/** Valid button semantics: render as anchor via Button asChild (avoid <a><button>). */
export function LaunchPlatformButton() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const href = appUrl ? new URL('/app', appUrl).toString() : '/app';

  return (
    <Button
      asChild
      size="lg"
      className="bg-emerald-600 hover:bg-emerald-700 text-white px-10 py-6 text-lg font-mono shadow-lg shadow-emerald-500/20"
    >
      <Link href={href}>
        <Zap className="mr-2 h-5 w-5" />
        LAUNCH PLATFORM
      </Link>
    </Button>
  );
}
