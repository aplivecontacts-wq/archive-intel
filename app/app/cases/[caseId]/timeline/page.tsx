'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Globe, User, Quote, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Query {
  id: string;
  case_id: string;
  raw_input: string;
  normalized_input: string;
  input_type: 'url' | 'username' | 'quote';
  status: 'running' | 'complete';
  created_at: string;
}

export default function CaseTimelinePage() {
  const params = useParams();
  const caseId = params.caseId as string;

  const [queries, setQueries] = useState<Query[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQueries = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/queries?caseId=${caseId}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setQueries(data.queries || []);
    } catch {
      setQueries([]);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchQueries();
  }, [fetchQueries]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'url':
        return <Globe className="h-3 w-3" />;
      case 'username':
        return <User className="h-3 w-3" />;
      default:
        return <Quote className="h-3 w-3" />;
    }
  };

  const sortedQueries = [...queries].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <Button
            variant="outline"
            size="sm"
            className="border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-mono mb-4"
            asChild
          >
            <Link href={`/app/cases/${caseId}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to case
            </Link>
          </Button>
          <Card className="bg-white border-emerald-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-emerald-700 text-lg font-mono">QUERY.TIMELINE</CardTitle>
              <CardDescription className="text-gray-600 font-mono text-xs">
                Tower view — queries in order
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Card className="bg-white border-emerald-200 shadow-sm">
          <CardContent className="pt-6 pb-8">
            {loading ? (
              <p className="text-gray-500 font-mono text-sm flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </p>
            ) : sortedQueries.length === 0 ? (
              <p className="text-emerald-600/50 font-mono text-sm text-center py-8">
                NO.QUERIES.YET — RUN.A.SEARCH.ON.THE.CASE.PAGE
              </p>
            ) : (
              <div className="relative">
                {/* Vertical line */}
                <div
                  className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2 bg-emerald-300"
                  aria-hidden
                />
                <ul className="space-y-0">
                  {sortedQueries.map((query, index) => {
                    const isLeft = index % 2 === 0;
                    return (
                      <li key={query.id} className="relative flex items-center min-h-[4.5rem] py-4">
                        {/* Left half: content when isLeft */}
                        <div className="flex-1 flex justify-end items-center pr-3">
                          {isLeft && (
                            <>
                              <div className="w-6 sm:w-8 h-0.5 bg-emerald-300 shrink-0" aria-hidden />
                              <div className="max-w-[80%] text-right">
                                <p className="text-emerald-700 font-mono text-xs mb-0.5">
                                  {formatDistanceToNow(new Date(query.created_at), { addSuffix: true }).toUpperCase()}
                                </p>
                                <p className="text-gray-900 font-mono text-sm truncate" title={query.raw_input}>
                                  {query.raw_input}
                                </p>
                                <Badge
                                  variant="secondary"
                                  className="mt-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono text-xs"
                                >
                                  {getIcon(query.input_type)}
                                  <span className="ml-1 uppercase">{query.input_type}</span>
                                </Badge>
                                {query.status === 'running' && (
                                  <span className="ml-2 inline-flex items-center text-emerald-600 text-xs font-mono">
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" /> RUNNING
                                  </span>
                                )}
                              </div>
                            </>
                          )}
                        </div>

                        {/* Center dot on the vertical line */}
                        <div
                          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-white border-2 border-emerald-300 z-10"
                          aria-hidden
                        />

                        {/* Right half: content when !isLeft */}
                        <div className="flex-1 flex justify-start items-center pl-3">
                          {!isLeft && (
                            <>
                              <div className="max-w-[80%] text-left">
                                <p className="text-emerald-700 font-mono text-xs mb-0.5">
                                  {formatDistanceToNow(new Date(query.created_at), { addSuffix: true }).toUpperCase()}
                                </p>
                                <p className="text-gray-900 font-mono text-sm truncate" title={query.raw_input}>
                                  {query.raw_input}
                                </p>
                                <Badge
                                  variant="secondary"
                                  className="mt-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono text-xs"
                                >
                                  {getIcon(query.input_type)}
                                  <span className="ml-1 uppercase">{query.input_type}</span>
                                </Badge>
                                {query.status === 'running' && (
                                  <span className="ml-2 inline-flex items-center text-emerald-600 text-xs font-mono">
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" /> RUNNING
                                  </span>
                                )}
                              </div>
                              <div className="w-6 sm:w-8 h-0.5 bg-emerald-300 shrink-0" aria-hidden />
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
