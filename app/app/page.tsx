'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SidebarCases } from '@/components/sidebar-cases';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, FolderPlus } from 'lucide-react';

interface Case {
  id: string;
  title: string;
  tags: string[];
  created_at: string;
}

export default function AppPage() {
  const router = useRouter();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCases();
  }, []);

  useEffect(() => {
    if (cases.length === 0 || loading) return;
    router.replace(`/app/cases/${cases[0].id}`);
  }, [cases, loading, router]);

  /** If client navigation stalls, hard-navigate to the case (avoids endless REDIRECTING…). */
  useEffect(() => {
    if (cases.length === 0 || loading) return;
    const id = cases[0].id;
    const t = window.setTimeout(() => {
      if (window.location.pathname === '/app') {
        window.location.assign(`/app/cases/${id}`);
      }
    }, 4000);
    return () => window.clearTimeout(t);
  }, [cases, loading]);

  const fetchCases = async () => {
    const t0 = Date.now();
    const controller = new AbortController();
    const timeoutMs = 25000;
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch('/api/cases', {
        credentials: 'include',
        signal: controller.signal,
      });
      const text = await response.text();
      let data: { cases?: Case[] } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        // non-JSON (e.g. 500 HTML) – leave cases empty
      }
      if (response.ok && data.cases) {
        setCases(data.cases);
      }
    } catch (error) {
      console.error('Failed to fetch cases:', error);
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <SidebarCases cases={cases} onCaseCreated={fetchCases} />
      <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-emerald-50 to-white">
        <Card className="bg-white border-emerald-200 shadow-lg max-w-md">
          <CardContent className="text-center py-12">
            {loading ? (
              <div className="space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-emerald-600 mx-auto" />
                <p className="text-emerald-700 font-mono text-sm">LOADING.SYSTEM...</p>
              </div>
            ) : cases.length === 0 ? (
              <div className="space-y-4">
                <FolderPlus className="h-16 w-16 text-emerald-600/50 mx-auto" />
                <div>
                  <p className="text-emerald-700 font-mono text-lg mb-2">NO.CASES.FOUND</p>
                  <p className="text-gray-600 text-sm font-mono">
                    CREATE.NEW.CASE.TO.BEGIN
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-emerald-600 mx-auto" />
                <p className="text-emerald-700 font-mono text-sm">REDIRECTING...</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
