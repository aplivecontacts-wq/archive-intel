'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Eye, Download } from 'lucide-react';
import { toast } from 'sonner';

interface BriefRow {
  id: string;
  case_id: string;
  version_number: number;
  brief_json: Record<string, unknown>;
  evidence_counts?: Record<string, number> | null;
  created_at: string;
}

interface CaseBriefsProps {
  caseId: string;
}

export function CaseBriefs({ caseId }: CaseBriefsProps) {
  const [briefs, setBriefs] = useState<BriefRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewBrief, setViewBrief] = useState<BriefRow | null>(null);
  const [loadingView, setLoadingView] = useState(false);

  const fetchBriefs = useCallback(async () => {
    if (!caseId) return;
    setLoadingList(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/briefs`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setBriefs(data.briefs || []);
      } else {
        toast.error(data?.error || 'Failed to load briefs');
      }
    } catch {
      toast.error('Failed to load briefs');
    } finally {
      setLoadingList(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchBriefs();
  }, [fetchBriefs]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/brief`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Brief generated (v${data.version_number ?? '?'})`);
        fetchBriefs();
      } else {
        toast.error(data?.error || 'Failed to generate brief');
      }
    } catch {
      toast.error('Failed to generate brief');
    } finally {
      setGenerating(false);
    }
  };

  const handleView = async (brief: BriefRow) => {
    setViewOpen(true);
    setViewBrief(null);
    setLoadingView(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/briefs/${brief.id}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.brief) {
        setViewBrief(data.brief);
      } else {
        toast.error(data?.error || 'Failed to load brief');
      }
    } catch {
      toast.error('Failed to load brief');
    } finally {
      setLoadingView(false);
    }
  };

  const handleDownloadPdf = async (brief: BriefRow) => {
    try {
      const res = await fetch(`/api/cases/${caseId}/briefs/${brief.id}/pdf`, {
        credentials: 'include',
      });
      if (!res.ok) {
        if (res.status === 404) {
          toast.error('PDF not available yet');
        } else {
          toast.error('Failed to download PDF');
        }
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `brief-v${brief.version_number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download PDF');
    }
  };

  const bj = viewBrief?.brief_json;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={handleGenerate}
          disabled={generating || !caseId}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono"
        >
          <FileText className="h-4 w-4 mr-2" />
          {generating ? 'GENERATING...' : 'Build Forensic Brief'}
        </Button>
      </div>

      <div className="border border-emerald-200 rounded-md bg-emerald-50/50 p-3">
        <p className="text-emerald-700 font-mono text-xs mb-2">BRIEFS</p>
        {loadingList ? (
          <p className="text-gray-500 font-mono text-sm">Loading...</p>
        ) : briefs.length === 0 ? (
          <p className="text-gray-500 font-mono text-sm">No briefs generated yet.</p>
        ) : (
          <ul className="space-y-2">
            {[...briefs]
              .sort((a, b) => (b.version_number ?? 0) - (a.version_number ?? 0))
              .map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center gap-2 text-sm font-mono"
              >
                <span className="text-emerald-700 font-medium">v{b.version_number}</span>
                <span className="text-gray-500">
                  {new Date(b.created_at).toLocaleDateString()}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-emerald-200 text-emerald-700 hover:bg-emerald-100 h-8 font-mono text-xs"
                  onClick={() => handleView(b)}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  View
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-emerald-200 text-emerald-700 hover:bg-emerald-100 h-8 font-mono text-xs"
                  onClick={() => handleDownloadPdf(b)}
                >
                  <Download className="h-3 w-3 mr-1" />
                  Download PDF
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Sheet
        open={viewOpen}
        onOpenChange={(open) => {
          setViewOpen(open);
          if (!open) setViewBrief(null);
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl border-emerald-200 bg-white"
        >
          <SheetHeader>
            <SheetTitle className="text-emerald-700 font-mono">
              {viewBrief ? `Brief v${viewBrief.version_number}` : 'Brief'}
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-6rem)] mt-4 pr-4">
            {loadingView ? (
              <p className="text-gray-500 font-mono text-sm">Loading...</p>
            ) : viewBrief && bj ? (
              <div className="space-y-6 font-mono text-sm">
                {typeof bj.executive_overview === 'string' && (
                  <Card className="bg-white border-emerald-200">
                    <CardContent className="pt-4">
                      <h3 className="text-emerald-700 font-semibold mb-2">
                        Executive Overview
                      </h3>
                      <p className="text-gray-700 whitespace-pre-wrap">
                        {bj.executive_overview}
                      </p>
                    </CardContent>
                  </Card>
                )}
                {Array.isArray(bj.working_timeline) && bj.working_timeline.length > 0 && (
                  <Card className="bg-white border-emerald-200">
                    <CardContent className="pt-4">
                      <h3 className="text-emerald-700 font-semibold mb-2">
                        Working Timeline
                      </h3>
                      <ul className="space-y-2">
                        {(bj.working_timeline as Array<Record<string, unknown>>).map(
                          (item, i) => (
                            <li key={i} className="border-l-2 border-emerald-200 pl-3 py-1">
                              <span className="text-gray-500">
                                {String(item.time_window ?? '')}
                              </span>{' '}
                              — {String(item.event ?? '')}{' '}
                              <span className="text-gray-400 text-xs">
                                [{String(item.confidence ?? '')} / {String(item.basis ?? '')}]
                              </span>
                            </li>
                          )
                        )}
                      </ul>
                    </CardContent>
                  </Card>
                )}
                {Array.isArray(bj.key_entities) && bj.key_entities.length > 0 && (
                  <Card className="bg-white border-emerald-200">
                    <CardContent className="pt-4">
                      <h3 className="text-emerald-700 font-semibold mb-2">
                        Key Entities
                      </h3>
                      <ul className="space-y-1">
                        {(bj.key_entities as Array<Record<string, unknown>>).map(
                          (e, i) => (
                            <li key={i}>
                              <strong>{String(e.name ?? '')}</strong>{' '}
                              <span className="text-gray-500">({String(e.type ?? '')})</span>
                            </li>
                          )
                        )}
                      </ul>
                    </CardContent>
                  </Card>
                )}
                {Array.isArray(bj.contradictions_tensions) &&
                  bj.contradictions_tensions.length > 0 && (
                    <Card className="bg-white border-emerald-200">
                      <CardContent className="pt-4">
                        <h3 className="text-emerald-700 font-semibold mb-2">
                          Contradictions / Tensions
                        </h3>
                        <ul className="space-y-2">
                          {(bj.contradictions_tensions as Array<Record<string, unknown>>).map(
                            (c, i) => (
                              <li key={i}>
                                <span className="font-medium text-gray-800">
                                  {String(c.issue ?? '')}
                                </span>
                                <p className="text-gray-600 text-xs mt-0.5">
                                  {String(c.details ?? '')}
                                </p>
                              </li>
                            )
                          )}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                {Array.isArray(bj.verification_tasks) && bj.verification_tasks.length > 0 && (
                  <Card className="bg-white border-emerald-200">
                    <CardContent className="pt-4">
                      <h3 className="text-emerald-700 font-semibold mb-2">
                        Verification Tasks
                      </h3>
                      <ul className="space-y-2">
                        {(bj.verification_tasks as Array<Record<string, unknown>>).map(
                          (v, i) => (
                            <li key={i} className="border-l-2 border-emerald-100 pl-2">
                              <span className="text-gray-800">{String(v.task ?? '')}</span>{' '}
                              <span className="text-gray-500 text-xs">
                                [{String(v.priority ?? '')}]
                              </span>
                              {Array.isArray(v.suggested_queries) &&
                                v.suggested_queries.length > 0 && (
                                  <p className="text-gray-500 text-xs mt-1">
                                    {String(v.suggested_queries.join(', '))}
                                  </p>
                                )}
                            </li>
                          )
                        )}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : null}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
