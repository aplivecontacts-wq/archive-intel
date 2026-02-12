'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { SidebarCases } from '@/components/sidebar-cases';
import { SearchBar } from '@/components/search-bar';
import { QueryList } from '@/components/query-list';
import { ResultsTabs } from '@/components/results-tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { detectInputType } from '@/lib/query-utils';
import { Menu } from 'lucide-react';

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

  const fetchQueries = useCallback(async () => {
    try {
      const response = await fetch(`/api/queries?caseId=${caseId}`);
      const data = await response.json();
      if (response.ok) {
        const list = data.queries || [];
        setQueries((prev) => {
          if (list.length === 0 && prev.length > 0) {
            return prev;
          }
          return list;
        });
        setSelectedQueryId((prev) => {
          if (list.length > 0 && !prev) return list[0].id;
          if (list.length > 0 && prev && !list.some((q: Query) => q.id === prev)) return list[0].id;
          return prev;
        });
        if (process.env.NODE_ENV === 'development' && list.length === 0) {
          console.warn('[CasePage] Queries fetch returned 0 for caseId=', caseId);
        }
      } else {
        console.error('Failed to fetch queries:', data?.error || response.statusText);
      }
    } catch (error) {
      console.error('Failed to fetch queries:', error);
    }
  }, [caseId]);

  const fetchCases = useCallback(async () => {
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
  }, [caseId]);

  useEffect(() => {
    fetchCases();
    fetchQueries();
  }, [caseId, fetchQueries, fetchCases]);

  useEffect(() => {
    const hasRunningQuery = queries.some((q) => q.status === 'running');
    if (hasRunningQuery) {
      const interval = setInterval(fetchQueries, 2000);
      return () => clearInterval(interval);
    }
  }, [queries, fetchQueries]);

  const selectedQuery = queries.find((q) => q.id === selectedQueryId);

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="hidden lg:block">
        <SidebarCases cases={cases} onCaseCreated={fetchCases} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto bg-gradient-to-b from-emerald-50 to-white">
          <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-5 lg:p-6 space-y-4 sm:space-y-5 lg:space-y-6">
            <div className="lg:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    className="border-emerald-300 text-emerald-700 hover:bg-emerald-100 font-mono"
                  >
                    <Menu className="h-4 w-4 mr-2" />
                    MENU
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-[85vw] max-w-[20rem]">
                  <SidebarCases cases={cases} onCaseCreated={fetchCases} />
                </SheetContent>
              </Sheet>
            </div>

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
                  onQueryCreated={(newQueryId, rawInput, fullQuery) => {
                    if (newQueryId) {
                      const q: Query = fullQuery
                        ? { id: fullQuery.id, case_id: fullQuery.case_id, raw_input: fullQuery.raw_input, normalized_input: fullQuery.normalized_input, input_type: fullQuery.input_type, status: fullQuery.status as 'running' | 'complete', created_at: fullQuery.created_at }
                        : rawInput
                          ? { id: newQueryId, case_id: caseId, raw_input: rawInput, normalized_input: rawInput, input_type: detectInputType(rawInput), status: 'running', created_at: new Date().toISOString() }
                          : { id: newQueryId, case_id: caseId, raw_input: '', normalized_input: '', input_type: 'quote', status: 'running', created_at: new Date().toISOString() };
                      setQueries((prev) => [q, ...prev.filter((x) => x.id !== q.id)]);
                      setSelectedQueryId(newQueryId);
                    }
                    fetchQueries();
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
                        caseId={caseId}
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
