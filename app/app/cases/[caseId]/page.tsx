'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { debugLog } from '@/lib/debug-log';
import { SidebarCases } from '@/components/sidebar-cases';
import { SearchBar } from '@/components/search-bar';
import { QueryList } from '@/components/query-list';
import { ResultsTabs } from '@/components/results-tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface Case {
  id: string;
  title: string;
  tags: string[];
  created_at: string;
}

interface Query {
  id: string;
  case_id: string;
  raw_input: string;
  normalized_input: string;
  input_type: 'url' | 'username' | 'quote';
  status: 'running' | 'complete';
  created_at: string;
}

export default function CasePage() {
  const params = useParams();
  const caseId = params.caseId as string;

  const [cases, setCases] = useState<Case[]>([]);
  const [currentCase, setCurrentCase] = useState<Case | null>(null);
  const [queries, setQueries] = useState<Query[]>([]);
  const [selectedQueryId, setSelectedQueryId] = useState<string | undefined>();

  useEffect(() => {
    fetchCases();
    fetchQueries();
  }, [caseId]);

  useEffect(() => {
    const hasRunningQuery = queries.some((q) => q.status === 'running');
    if (hasRunningQuery) {
      const interval = setInterval(fetchQueries, 2000);
      return () => clearInterval(interval);
    }
  }, [queries]);

  const fetchCases = async () => {
    try {
      const response = await fetch('/api/cases');
      if (response.ok) {
        const data = await response.json();
        setCases(data.cases || []);
        const current = data.cases.find((c: Case) => c.id === caseId);
        setCurrentCase(current || null);
      }
    } catch (error) {
      console.error('Failed to fetch cases:', error);
    }
  };

  const fetchQueries = async () => {
    try {
      const response = await fetch(`/api/queries?caseId=${caseId}`);
      if (response.ok) {
        const data = await response.json();
        setQueries(data.queries || []);

        if (data.queries.length > 0 && !selectedQueryId) {
          setSelectedQueryId(data.queries[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch queries:', error);
    }
  };

  const selectedQuery = queries.find((q) => q.id === selectedQueryId);
  // #region agent log
  if (selectedQueryId) debugLog('app/app/cases/[caseId]/page.tsx', 'selectedQueryId state', { selectedQueryId, hasSelectedQuery: !!selectedQuery, queriesLength: queries.length }, 'H1');
  // #endregion

  return (
    <div className="flex h-screen bg-gray-50">
      <SidebarCases cases={cases} onCaseCreated={fetchCases} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto bg-gradient-to-b from-emerald-50 to-white">
          <div className="container mx-auto p-6 space-y-6">
            <Card className="bg-white border-emerald-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-emerald-700 text-2xl font-mono">
                  {currentCase?.title || 'LOADING...'}
                </CardTitle>
                <CardDescription className="text-gray-600 font-mono text-sm">
                  {currentCase && `CREATED: ${new Date(currentCase.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  }).toUpperCase()}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SearchBar
                  caseId={caseId}
                  onQueryCreated={(newQueryId) => {
                    fetchQueries();
                    if (newQueryId) setSelectedQueryId(newQueryId);
                  }}
                />
              </CardContent>
            </Card>

            <div className="grid lg:grid-cols-5 gap-6">
              <div className="lg:col-span-2">
                <Card className="bg-white border-emerald-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-emerald-700 text-lg font-mono">QUERY.TIMELINE</CardTitle>
                    <CardDescription className="text-gray-600 font-mono text-xs">
                      {queries.length} {queries.length === 1 ? 'QUERY' : 'QUERIES'} EXECUTED
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <QueryList
                      queries={queries}
                      selectedQueryId={selectedQueryId}
                      onSelectQuery={setSelectedQueryId}
                      onQueryDeleted={fetchQueries}
                    />
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-3">
                {selectedQuery ? (
                  <Card className="bg-white border-emerald-200 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-emerald-700 text-lg font-mono">RESULTS</CardTitle>
                      <CardDescription className="text-gray-600 truncate font-mono text-xs">
                        {selectedQuery.raw_input}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResultsTabs
                        queryId={selectedQuery.id}
                        queryStatus={selectedQuery.status}
                        rawInput={selectedQuery.raw_input}
                      />
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="bg-white border-emerald-200 shadow-sm">
                    <CardContent className="text-center py-12 text-emerald-600/50 font-mono text-sm">
                      SELECT.QUERY.TO.VIEW.RESULTS
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
