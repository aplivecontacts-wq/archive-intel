import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AccessSystemButton } from '@/components/access-system-button';
import { Terminal, Database, Activity, Zap, Lock, Archive } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-50 via-white to-gray-50" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzEwYjk4MSIgc3Ryb2tlLW9wYWNpdHk9IjAuMDUiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-40" />

      <div className="relative z-10 container mx-auto px-4 py-8">
        <nav className="flex justify-between items-center mb-16 backdrop-blur-sm bg-white/80 border border-emerald-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Terminal className="h-7 w-7 text-emerald-600" />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-600 rounded-full animate-pulse" />
            </div>
            <span className="text-2xl font-mono font-bold text-emerald-700">ARCHIVE.INTEL</span>
          </div>
          <AccessSystemButton />
        </nav>

        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-8 mb-20">
            <div className="inline-block">
              <div className="flex items-center justify-center space-x-2 text-emerald-600 mb-4 font-mono text-sm">
                <span className="animate-pulse">&gt;</span>
                <span>OSINT PLATFORM v2.1.4</span>
                <span className="animate-pulse">_</span>
              </div>
            </div>

            <h1 className="text-7xl font-bold text-gray-900 leading-tight font-mono">
              DIGITAL
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">
                FORENSICS
              </span>
            </h1>

            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Advanced open-source intelligence gathering and digital archaeology platform.
              <br />Track, analyze, and document your investigations in one secure workspace.
            </p>

            <div className="flex justify-center gap-4 pt-8">
              <Link href="/app">
                <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white px-10 py-6 text-lg font-mono shadow-lg shadow-emerald-500/20">
                  <Zap className="mr-2 h-5 w-5" />
                  LAUNCH PLATFORM
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg border border-emerald-200 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all group">
              <div className="bg-emerald-50 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:bg-emerald-100 transition-colors">
                <Database className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-emerald-700 mb-2 font-mono">CASE.DB</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Structured investigation management with full query history, result caching, and cross-reference capabilities.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg border border-emerald-200 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all group">
              <div className="bg-emerald-50 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:bg-emerald-100 transition-colors">
                <Archive className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-emerald-700 mb-2 font-mono">ARCHIVES</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Access archived web snapshots and track digital footprints across multiple time periods and sources.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg border border-emerald-200 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all group">
              <div className="bg-emerald-50 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:bg-emerald-100 transition-colors">
                <Activity className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-emerald-700 mb-2 font-mono">AUTO.DETECT</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Intelligent input parsing with automatic URL, username, and keyword detection for streamlined searches.
              </p>
            </div>
          </div>

          <div className="mt-16 p-6 rounded-lg border border-emerald-200 bg-emerald-50 shadow-sm">
            <div className="flex items-start space-x-4">
              <Lock className="h-5 w-5 text-emerald-600 mt-1 flex-shrink-0" />
              <div>
                <h4 className="text-emerald-700 font-mono font-semibold mb-2">SECURITY NOTICE</h4>
                <p className="text-gray-600 text-sm">
                  All investigations are encrypted and stored securely. This platform is designed for authorized OSINT research only.
                  User authentication will be implemented via Clerk in production deployments.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
