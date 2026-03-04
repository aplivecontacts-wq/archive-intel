'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Globe, User, Quote, Loader2, Bookmark, ExternalLink } from 'lucide-react';
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

interface SavedLink {
  id: string;
  url: string;
  title: string | null;
  query_id: string | null;
  case_id: string | null;
  source?: string;
}

export default function CaseTimelinePage() {
  const params = useParams();
  const caseId = params.caseId as string;

  const [queries, setQueries] = useState<Query[]>([]);
  const [savedLinks, setSavedLinks] = useState<SavedLink[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQueries = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      const [qRes, sRes] = await Promise.all([
        fetch(`/api/queries?caseId=${caseId}`, { credentials: 'include' }),
        fetch('/api/saved', { credentials: 'include' }),
      ]);
      const qData = await qRes.json();
      const sData = await sRes.json();
      if (qRes.ok) setQueries(qData.queries || []);
      if (sRes.ok) setSavedLinks(sData.saved || []);
    } catch {
      setQueries([]);
      setSavedLinks([]);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchQueries();
  }, [fetchQueries]);

  const linkLabel = (s: SavedLink) => {
    if (s.title?.trim()) return s.title.trim();
    try {
      return new URL(s.url).hostname;
    } catch {
      return String(s.url).slice(0, 40);
    }
  };

  const savedByQueryId = useMemo(() => {
    const forCase = savedLinks.filter((s) => s.case_id === caseId && s.query_id != null);
    const map = new Map<string, SavedLink[]>();
    for (const s of forCase) {
      const id = s.query_id!;
      const list = map.get(id) ?? [];
      list.push(s);
      map.set(id, list);
    }
    return map;
  }, [savedLinks, caseId]);

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
                    const links = savedByQueryId.get(query.id) ?? [];
                    return (
                      <li key={query.id} className="relative py-4">
                        <div className="flex items-start min-h-[4.5rem]">
                          {/* Left half: content when isLeft */}
                          <div className="flex-1 flex justify-end pr-3">
                            {isLeft && (
                              <>
                                <div className="w-6 sm:w-8 h-0.5 bg-emerald-300 shrink-0 mt-6" aria-hidden />
                                <div className="max-w-[80%] text-right">
                                  <Link
                                    href={`/app/cases/${caseId}?queryId=${query.id}`}
                                    className="block hover:bg-emerald-50/50 rounded p-1 -m-1 transition-colors"
                                  >
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
                                  </Link>
                                  {links.length > 0 && (
                                    <div className="mt-2 text-left border-l-2 border-emerald-200 pl-2 ml-auto max-w-full">
                                      <p className="text-emerald-600 font-mono text-xs flex items-center gap-1 mb-1">
                                        <Bookmark className="h-3 w-3" /> Saved ({links.length})
                                      </p>
                                      <ul className="space-y-1">
                                        {links.slice(0, 5).map((s) => (
                                          <li key={s.id}>
                                            <a
                                              href={s.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-gray-600 hover:text-emerald-700 font-mono text-xs truncate block max-w-full"
                                              title={s.title || s.url}
                                            >
                                              <ExternalLink className="h-3 w-3 inline mr-0.5 align-middle" />
                                              {linkLabel(s)}
                                            </a>
                                          </li>
                                        ))}
                                        {links.length > 5 && (
                                          <li className="text-gray-500 font-mono text-xs">+{links.length - 5} more</li>
                                        )}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </div>

                          {/* Center dot */}
                          <div
                            className="absolute left-1/2 top-[2.25rem] -translate-x-1/2 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-white border-2 border-emerald-300 z-10 shrink-0"
                            aria-hidden
                          />

                          {/* Right half: content when !isLeft */}
                          <div className="flex-1 flex justify-start pl-3">
                            {!isLeft && (
                              <>
                                <div className="max-w-[80%] text-left">
                                  <Link
                                    href={`/app/cases/${caseId}?queryId=${query.id}`}
                                    className="block hover:bg-emerald-50/50 rounded p-1 -m-1 transition-colors"
                                  >
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
                                  </Link>
                                  {links.length > 0 && (
                                    <div className="mt-2 border-l-2 border-emerald-200 pl-2">
                                      <p className="text-emerald-600 font-mono text-xs flex items-center gap-1 mb-1">
                                        <Bookmark className="h-3 w-3" /> Saved ({links.length})
                                      </p>
                                      <ul className="space-y-1">
                                        {links.slice(0, 5).map((s) => (
                                          <li key={s.id}>
                                            <a
                                              href={s.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-gray-600 hover:text-emerald-700 font-mono text-xs truncate block max-w-full"
                                              title={s.title || s.url}
                                            >
                                              <ExternalLink className="h-3 w-3 inline mr-0.5 align-middle" />
                                              {linkLabel(s)}
                                            </a>
                                          </li>
                                        ))}
                                        {links.length > 5 && (
                                          <li className="text-gray-500 font-mono text-xs">+{links.length - 5} more</li>
                                        )}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                                <div className="w-6 sm:w-8 h-0.5 bg-emerald-300 shrink-0 mt-6" aria-hidden />
                              </>
                            )}
                          </div>
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
