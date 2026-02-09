import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <h1 className="text-6xl font-bold text-gray-900 font-mono mb-2">404</h1>
      <p className="text-gray-600 font-mono mb-6">Page not found</p>
      <Button asChild className="bg-emerald-600 hover:bg-emerald-700 font-mono">
        <Link href="/">GO TO HOME</Link>
      </Button>
    </div>
  );
}
