'use client';

import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="mb-6">
        <Link href="/" className="text-sm text-emerald-600 hover:text-emerald-700 font-mono">
          &lt; RETURN TO HOME
        </Link>
      </div>
      <SignIn 
        routing="hash"
        appearance={{
          variables: { colorPrimary: '#059669' },
        }}
      />
    </div>
  );
}