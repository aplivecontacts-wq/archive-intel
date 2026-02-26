'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';
import { FileText, Eye, Download, StickyNote, GitCompare, LayoutList, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { computeChangesSinceLastVersion } from '@/lib/brief-diff';
import type { BriefChangeEntry, BriefJson } from '@/lib/ai/brief-schema';
import { IntelDashboard } from '@/components/intel-dashboard';

interface BriefRow {
  id: string;
  case_id: string;
  version_number: number;
  brief_json: Record<string, unknown>;
  evidence_counts?: Record<string, number> | null;
  user_note?: string | null;
  created_at: string;
}

interface SavedLinkNoteRow {
  id: string;
  content: string;
  created_at: string;
}

interface SavedLinkWithNotes {
  id: string;
  source: string;
  url: string;
  title: string | null;
  captured_at: string | null;
  source_tier?: 'primary' | 'secondary' | null;
  created_at: string;
  notes: SavedLinkNoteRow[];
}

interface CaseBriefsProps {
  caseId: string;
  /** Optional case objective — shown at top of brief view; brief generation orients toward it when set */
  caseObjective?: string | null;
  /** Phase 5: after importing tasks from brief, parent can refetch tasks */
  onTasksImported?: () => void;
  /** Phase 6: Intel Dashboard — entities + open mentions callback */
  entities?: { id: string; name: string; entity_type: string; mention_count: number }[];
  onOpenEntityMentions?: (entity: { id: string; name: string; entity_type: string; mention_count: number }) => void;
  /** Phase 6: Next Moves tasks + refetch */
  tasks?: { id: string; title: string; status: string; detail?: string | null }[];
  fetchTasks?: () => void;
}

export function CaseBriefs({ caseId, caseObjective, onTasksImported, entities, onOpenEntityMentions, tasks, fetchTasks }: CaseBriefsProps) {
  const [briefs, setBriefs] = useState<BriefRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewBrief, setViewBrief] = useState<BriefRow | null>(null);
  const [viewSavedLinksEvidence, setViewSavedLinksEvidence] = useState<SavedLinkWithNotes[]>([]);
  const [loadingView, setLoadingView] = useState(false);
  const [noteBrief, setNoteBrief] = useState<BriefRow | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [savingVerifiedIndex, setSavingVerifiedIndex] = useState<number | null>(null);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [diffSheetOpen, setDiffSheetOpen] = useState(false);
  const [compareLeftId, setCompareLeftId] = useState<string>('');
  const [compareRightId, setCompareRightId] = useState<string>('');
  const [diffEntries, setDiffEntries] = useState<BriefChangeEntry[]>([]);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffLeftVersion, setDiffLeftVersion] = useState<number | null>(null);
  const [diffRightVersion, setDiffRightVersion] = useState<number | null>(null);
  const [importingTasks, setImportingTasks] = useState(false);
  const [caseCodeOpen, setCaseCodeOpen] = useState(false);
  const [generateProgress, setGenerateProgress] = useState(0);
  const generateProgressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  useEffect(() => {
    return () => {
      if (generateProgressIntervalRef.current) {
        clearInterval(generateProgressIntervalRef.current);
        generateProgressIntervalRef.current = null;
      }
    };
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerateProgress(0);
    if (generateProgressIntervalRef.current) {
      clearInterval(generateProgressIntervalRef.current);
      generateProgressIntervalRef.current = null;
    }
    generateProgressIntervalRef.current = setInterval(() => {
      setGenerateProgress((p) => Math.min(p + 10, 90));
    }, 1200);
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
      if (generateProgressIntervalRef.current) {
        clearInterval(generateProgressIntervalRef.current);
        generateProgressIntervalRef.current = null;
      }
      setGenerateProgress(100);
      setTimeout(() => {
        setGenerating(false);
        setGenerateProgress(0);
      }, 400);
    }
  };

  const handleView = async (brief: BriefRow) => {
    setViewOpen(true);
    setViewBrief(null);
    setViewSavedLinksEvidence([]);
    setLoadingView(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/briefs/${brief.id}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.brief) {
        const raw = data.brief;
        let briefJson = raw.brief_json;
        while (typeof briefJson === 'string') {
          try {
            briefJson = JSON.parse(briefJson);
          } catch {
            break;
          }
        }
        if (briefJson == null || typeof briefJson !== 'object') {
          briefJson = {};
        }
        const obj = briefJson as Record<string, unknown>;
        const ensureArray = (snake: string, camel: string): unknown[] => {
          const val = obj[snake] ?? obj[camel];
          if (Array.isArray(val)) return val;
          if (typeof val === 'string') {
            try {
              const parsed = JSON.parse(val);
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          }
          return [];
        };
        // #region agent log
        if (process.env.NODE_ENV !== 'production') {
          const arrLen = (key: string) => {
            const v = obj[key];
            if (Array.isArray(v)) return v.length;
            return v === undefined ? 'undef' : typeof v;
          };
          console.log('[brief view client] INCOMING brief_json keys & lengths', {
            obj_keys: Object.keys(obj),
            working_timeline: arrLen('working_timeline'),
            key_entities: arrLen('key_entities'),
            contradictions_tensions: arrLen('contradictions_tensions'),
            evidence_strength: arrLen('evidence_strength'),
            verification_tasks: arrLen('verification_tasks'),
          });
        }
        // #endregion
        const normalized = {
          ...briefJson,
          working_timeline: ensureArray('working_timeline', 'workingTimeline'),
          key_entities: ensureArray('key_entities', 'keyEntities'),
          contradictions_tensions: ensureArray('contradictions_tensions', 'contradictionsTensions'),
          verification_tasks: ensureArray('verification_tasks', 'verificationTasks'),
          evidence_strength: ensureArray('evidence_strength', 'evidenceStrength'),
          hypotheses: ensureArray('hypotheses', 'hypotheses'),
          critical_gaps: ensureArray('critical_gaps', 'criticalGaps'),
          collapse_tests: ensureArray('collapse_tests', 'collapseTests'),
          incentive_matrix: ensureArray('incentive_matrix', 'incentiveMatrix'),
        };
        // #region agent log
        if (process.env.NODE_ENV !== 'production') {
          const payload = {
            sessionId: '726d5f',
            hypothesisId: 'B',
            location: 'components/case-briefs.tsx:handleView',
            message: 'Client after normalization, before setState',
            data: {
              normalized_typeof: typeof normalized,
              normalized_keys: Object.keys(normalized),
              working_timeline_len: Array.isArray(normalized.working_timeline) ? normalized.working_timeline.length : 'n/a',
              key_entities_len: Array.isArray(normalized.key_entities) ? normalized.key_entities.length : 'n/a',
              contradictions_tensions_len: Array.isArray(normalized.contradictions_tensions) ? normalized.contradictions_tensions.length : 'n/a',
              evidence_strength_len: Array.isArray(normalized.evidence_strength) ? normalized.evidence_strength.length : 'n/a',
              verification_tasks_len: Array.isArray(normalized.verification_tasks) ? normalized.verification_tasks.length : 'n/a',
              saved_links_with_notes_len: Array.isArray(data.saved_links_with_notes) ? data.saved_links_with_notes.length : 'n/a',
              raw_brief_json_typeof: typeof raw.brief_json,
            },
            timestamp: Date.now(),
          };
          console.log('[brief view client]', payload.data);
          fetch('http://127.0.0.1:7242/ingest/e0a55016-0dba-46c8-8112-7b93c9c9c645', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '726d5f' }, body: JSON.stringify(payload) }).catch(() => {});
        }
        // #endregion
        setViewBrief({ ...raw, brief_json: normalized });
        setViewSavedLinksEvidence(Array.isArray(data.saved_links_with_notes) ? data.saved_links_with_notes : []);
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

  const openNoteDialog = (brief: BriefRow) => {
    setNoteBrief(brief);
    setNoteText(brief.user_note ?? '');
  };

  const closeNoteDialog = () => {
    setNoteBrief(null);
    setNoteText('');
  };

  const handleSaveNote = async () => {
    if (!noteBrief) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/briefs/${noteBrief.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user_note: noteText.trim() || null }),
      });
      const data = await res.json();
      if (res.ok) {
        setBriefs((prev) =>
          prev.map((b) =>
            b.id === noteBrief.id ? { ...b, user_note: noteText.trim() || null } : b
          )
        );
        toast.success('Note saved');
        closeNoteDialog();
      } else {
        toast.error(data?.error || 'Failed to save note');
      }
    } catch {
      toast.error('Failed to save note');
    } finally {
      setSavingNote(false);
    }
  };

  const handleTimelineVerifiedChange = async (briefId: string, index: number, checked: boolean) => {
    if (!viewBrief?.brief_json) return;
    const bj = viewBrief.brief_json as Record<string, unknown>;
    const timeline = Array.isArray(bj.working_timeline) ? [...bj.working_timeline] : [];
    if (index < 0 || index >= timeline.length) return;
    const item = timeline[index] as Record<string, unknown>;
    timeline[index] = { ...item, verified: checked };
    const nextBj = { ...bj, working_timeline: timeline };
    setViewBrief((prev) => (prev ? { ...prev, brief_json: nextBj } : null));
    setSavingVerifiedIndex(index);
    try {
      const res = await fetch(`/api/cases/${caseId}/briefs/${briefId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          brief_json: nextBj,
          user_note: viewBrief.user_note ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || 'Failed to save verified status');
        setViewBrief((prev) => (prev ? { ...prev, brief_json: bj } : null));
      }
    } catch {
      toast.error('Failed to save verified status');
      setViewBrief((prev) => (prev ? { ...prev, brief_json: bj } : null));
    } finally {
      setSavingVerifiedIndex(null);
    }
  };

  const bj = viewBrief?.brief_json;

  const handleShowDiff = async () => {
    if (!compareLeftId || !compareRightId || compareLeftId === compareRightId || !caseId) return;
    setDiffLoading(true);
    try {
      const [resLeft, resRight] = await Promise.all([
        fetch(`/api/cases/${caseId}/briefs/${compareLeftId}`, { credentials: 'include' }),
        fetch(`/api/cases/${caseId}/briefs/${compareRightId}`, { credentials: 'include' }),
      ]);
      const dataLeft = await resLeft.json();
      const dataRight = await resRight.json();
      if (!resLeft.ok || !resRight.ok) {
        toast.error(dataLeft?.error || dataRight?.error || 'Failed to load one or both briefs');
        setDiffLoading(false);
        return;
      }
      const rawLeft = dataLeft.brief?.brief_json;
      const rawRight = dataRight.brief?.brief_json;
      if (!rawLeft || !rawRight) {
        toast.error('Brief data missing');
        setDiffLoading(false);
        return;
      }
      let leftJson: BriefJson = typeof rawLeft === 'string' ? JSON.parse(rawLeft) : rawLeft;
      let rightJson: BriefJson = typeof rawRight === 'string' ? JSON.parse(rawRight) : rawRight;
      const leftVersion = dataLeft.brief?.version_number ?? 0;
      const rightVersion = dataRight.brief?.version_number ?? 0;
      const prev: BriefJson = leftVersion < rightVersion ? leftJson : rightJson;
      const next: BriefJson = leftVersion < rightVersion ? rightJson : leftJson;
      const prevVer = leftVersion < rightVersion ? leftVersion : rightVersion;
      const nextVer = leftVersion < rightVersion ? rightVersion : leftVersion;
      const changes = computeChangesSinceLastVersion(prev, next);
      setDiffEntries(changes);
      setDiffLeftVersion(prevVer);
      setDiffRightVersion(nextVer);
      setCompareDialogOpen(false);
      setDiffSheetOpen(true);
    } catch (e) {
      toast.error('Failed to compute diff');
      setDiffLoading(false);
      return;
    }
    setDiffLoading(false);
  };

  const sortedBriefs = [...briefs].sort((a, b) => (b.version_number ?? 0) - (a.version_number ?? 0));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={handleGenerate}
          disabled={generating || !caseId}
          className="relative overflow-hidden bg-emerald-600 hover:bg-emerald-700 text-white font-mono min-w-[12rem]"
        >
          {generating && (
            <span
              className="absolute inset-y-0 left-0 bg-emerald-500 transition-[width] duration-300 ease-out"
              style={{ width: `${generateProgress}%` }}
              aria-hidden
            />
          )}
          <span className="relative z-10 flex items-center">
            <FileText className="h-4 w-4 mr-2 shrink-0" />
            {generating ? `GENERATING... ${generateProgress}%` : 'Build Forensic Brief'}
          </span>
        </Button>
        {briefs.length >= 2 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-mono"
            onClick={() => setCompareDialogOpen(true)}
          >
            <GitCompare className="h-4 w-4 mr-2" />
            Compare Versions
          </Button>
        )}
        {briefs.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-mono"
            disabled={importingTasks}
            onClick={async () => {
              setImportingTasks(true);
              try {
                const res = await fetch(`/api/cases/${caseId}/tasks/import-from-brief`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ briefId: viewBrief?.id ?? undefined }),
                });
                const data = await res.json();
                if (res.ok) {
                  toast.success(data.imported > 0 ? `Imported ${data.imported} task(s)` : data.message ?? 'No new tasks to import');
                  onTasksImported?.();
                } else {
                  toast.error(data?.error ?? 'Import failed');
                }
              } catch {
                toast.error('Import failed');
              } finally {
                setImportingTasks(false);
              }
            }}
          >
            {importingTasks ? 'Importing…' : 'Import tasks from brief'}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-mono"
          asChild
        >
          <Link href={`/app/cases/${caseId}/timeline`}>
            <LayoutList className="h-4 w-4 mr-2" />
            Tower view
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-mono"
          onClick={() => setCaseCodeOpen(true)}
        >
          <BookOpen className="h-4 w-4 mr-2" />
          Case code
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
            {sortedBriefs.map((b) => (
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={`h-8 font-mono text-xs ${b.user_note ? 'border-amber-300 text-amber-700 hover:bg-amber-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-100'}`}
                  onClick={() => openNoteDialog(b)}
                  title={b.user_note ? 'Edit note' : 'Add note'}
                >
                  <StickyNote className={`h-3 w-3 mr-1 ${b.user_note ? 'fill-amber-200' : ''}`} />
                  Note
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
          if (!open) {
            setViewBrief(null);
            setViewSavedLinksEvidence([]);
          }
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
            <SheetDescription className="sr-only">
              Case brief content, timeline, entities, and evidence
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-6rem)] mt-4 pr-4">
            {loadingView ? (
              <p className="text-gray-500 font-mono text-sm">Loading...</p>
            ) : viewBrief && bj ? (
              <div className="space-y-6 font-mono text-sm">
                {caseObjective && (
                  <Card className="bg-emerald-50 border-emerald-200">
                    <CardContent className="pt-4">
                      <h3 className="text-emerald-700 font-semibold mb-1.5 text-xs uppercase tracking-wide">
                        Case objective
                      </h3>
                      <p className="text-emerald-900/90 text-sm leading-relaxed">
                        {caseObjective}
                      </p>
                    </CardContent>
                  </Card>
                )}
                <IntelDashboard
                  briefJson={bj}
                  caseId={caseId}
                  entities={entities}
                  onOpenEntityMentions={onOpenEntityMentions}
                  tasks={tasks}
                  fetchTasks={fetchTasks}
                />
                {Array.isArray(bj.changes_since_last_version) && bj.changes_since_last_version.length > 0 && (
                  <Card className="bg-white border-emerald-200">
                    <CardContent className="pt-4">
                      <h3 className="text-emerald-700 font-semibold mb-2">
                        What Changed
                      </h3>
                      <ul className="space-y-2">
                        {(bj.changes_since_last_version as Array<{ section?: string; kind?: string; label?: string; detail?: string }>).map((entry, idx) => (
                          <li key={idx} className="text-sm">
                            <span
                              className={`text-xs font-mono px-1.5 py-0.5 rounded mr-1.5 ${
                                entry.kind === 'added'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : entry.kind === 'removed'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {entry.kind === 'added' ? 'Added' : entry.kind === 'removed' ? 'Removed' : 'Modified'}
                            </span>
                            {entry.section && (
                              <span className="text-gray-500 text-xs mr-1">{entry.section}</span>
                            )}
                            <span className="text-gray-800">{entry.label ?? ''}</span>
                            {entry.detail && (
                              <p className="text-gray-500 text-xs mt-0.5">{entry.detail}</p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
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
                <Card className="bg-white border-emerald-200">
                  <CardContent className="pt-4">
                    <h3 className="text-emerald-700 font-semibold mb-2">
                      Working Timeline
                    </h3>
                    {Array.isArray(bj.working_timeline) && bj.working_timeline.length > 0 ? (
                      <ul className="space-y-2">
                        {(bj.working_timeline as Array<Record<string, unknown>>).map(
                          (item, i) => {
                            const refs = Array.from(new Set((item.source_ids ?? item.source_refs ?? []) as string[]));
                            const evidenceIndex = (bj.evidence_index ?? {}) as Record<string, { type?: string; description?: string; url?: string }>;
                            return (
                              <li key={i} className="border-l-2 border-emerald-200 pl-3 py-1 flex flex-col gap-1">
                                <div className="flex items-start gap-2">
                                  <div className="flex-1 min-w-0">
                                    <span className="text-gray-500">
                                      {String(item.time_window ?? '')}
                                    </span>{' '}
                                    — {String(item.event ?? '')}{' '}
                                    <span className="text-gray-400 text-xs">
                                      [{String(item.confidence ?? '')} / {String(item.basis ?? '')}]
                                    </span>
                                  </div>
                                  <label className="flex items-center gap-1.5 shrink-0 text-xs text-emerald-700 cursor-pointer">
                                    <Checkbox
                                      checked={item.verified === true}
                                      disabled={savingVerifiedIndex === i}
                                      onCheckedChange={(checked) =>
                                        viewBrief &&
                                        handleTimelineVerifiedChange(viewBrief.id, i, checked === true)
                                      }
                                      aria-label={`Verified (User) for timeline item ${i + 1}`}
                                    />
                                    <span>Verified (User)</span>
                                  </label>
                                </div>
                                {refs.length > 0 && (
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    <span className="text-emerald-700 font-medium">Evidence:</span>{' '}
                                    {refs.map((id) => {
                                      const evidence = evidenceIndex[id];
                                      const label = evidence
                                        ? ((evidence.description && String(evidence.description).trim()) ? String(evidence.description).trim() : (evidence.type ? `${evidence.type}: ${evidence.description ?? id}` : id))
                                        : id;
                                      if (evidence?.url) {
                                        return (
                                          <a
                                            key={id}
                                            href={evidence.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-emerald-600 hover:underline mr-1.5"
                                          >
                                            [{label}]
                                          </a>
                                        );
                                      }
                                      return <span key={id} className="mr-1.5">[{String(label)}]</span>;
                                    })}
                                  </div>
                                )}
                              </li>
                            );
                          }
                        )}
                      </ul>
                    ) : (
                      <p className="text-gray-400 text-xs font-mono italic">Populated when the payload has queries, saved links, notes, or results; lists chronological events with source_ids from evidence_index.</p>
                    )}
                  </CardContent>
                </Card>
                <Card className="bg-white border-emerald-200">
                  <CardContent className="pt-4">
                    <h3 className="text-emerald-700 font-semibold mb-2">
                      Key Entities
                    </h3>
                    {Array.isArray(bj.key_entities) && bj.key_entities.length > 0 ? (
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
                    ) : (
                      <p className="text-gray-400 text-xs font-mono italic">Populated when the payload has queries, saved links, notes, or results; lists people, organizations, and other entities with source_refs from evidence_index.</p>
                    )}
                  </CardContent>
                </Card>
                <Card className="bg-white border-emerald-200">
                  <CardContent className="pt-4">
                    <h3 className="text-emerald-700 font-semibold mb-2">
                      Contradictions / Tensions
                    </h3>
                    {Array.isArray(bj.contradictions_tensions) &&
                  bj.contradictions_tensions.length > 0 ? (
                        <ul className="space-y-4">
                          {(bj.contradictions_tensions as Array<Record<string, unknown>>).map(
                            (c, i) => {
                              const hasStructured =
                                typeof c.statement_a === 'string' && typeof c.statement_b === 'string';
                              if (hasStructured) {
                                const aRefs = Array.isArray(c.statement_a_refs)
                                  ? (c.statement_a_refs as string[]).join(', ')
                                  : '';
                                const bRefs = Array.isArray(c.statement_b_refs)
                                  ? (c.statement_b_refs as string[]).join(', ')
                                  : '';
                                const tasks = Array.isArray(c.resolution_tasks)
                                  ? (c.resolution_tasks as string[])
                                  : [];
                                return (
                                  <li key={i} className="border border-emerald-100 rounded p-3 text-sm">
                                    <div className="font-medium text-gray-800 mb-1">
                                      {String(c.issue ?? '')}
                                    </div>
                                    {c.issue_type != null && String(c.issue_type).trim() !== '' && (
                                      <span className="inline-block text-xs font-mono px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 mb-2">
                                        {String(c.issue_type)}
                                      </span>
                                    )}
                                    <div className="mt-2">
                                      <p className="text-xs text-emerald-700 font-semibold mb-0.5">
                                        Statement A
                                      </p>
                                      <p className="text-gray-700 text-xs">
                                        {String(c.statement_a ?? '')}
                                        {aRefs ? (
                                          <span className="text-gray-500 ml-1">[{aRefs}]</span>
                                        ) : null}
                                      </p>
                                    </div>
                                    <div className="mt-2">
                                      <p className="text-xs text-emerald-700 font-semibold mb-0.5">
                                        Statement B
                                      </p>
                                      <p className="text-gray-700 text-xs">
                                        {String(c.statement_b ?? '')}
                                        {bRefs ? (
                                          <span className="text-gray-500 ml-1">[{bRefs}]</span>
                                        ) : null}
                                      </p>
                                    </div>
                                    {c.why_it_matters != null && String(c.why_it_matters).trim() !== '' && (
                                      <p className="text-gray-800 text-xs mt-2 border-l-2 border-amber-200 pl-2">
                                        {String(c.why_it_matters)}
                                      </p>
                                    )}
                                    {tasks.length > 0 && (
                                      <ul className="mt-2 space-y-0.5 text-xs text-gray-600">
                                        <span className="font-semibold text-gray-700">
                                          Resolution tasks:
                                        </span>
                                        {tasks.map((t, j) => (
                                          <li key={j} className="list-disc list-inside">
                                            {String(t)}
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </li>
                                );
                              }
                              return (
                                <li key={i}>
                                  <span className="font-medium text-gray-800">
                                    {String(c.issue ?? '')}
                                  </span>
                                  <p className="text-gray-600 text-xs mt-0.5">
                                    {String(c.details ?? '')}
                                  </p>
                                  {Array.isArray(c.source_refs) && (c.source_refs as string[]).length > 0 && (
                                    <p className="text-gray-500 text-xs mt-0.5 font-mono">
                                      [{((c.source_refs as string[]).join(', '))}]
                                    </p>
                                  )}
                                </li>
                              );
                            }
                          )}
                        </ul>
                    ) : (
                      <p className="text-gray-400 text-xs font-mono italic">Populated when the evidence shows conflicting claims, different dates, or tensions between sources.</p>
                    )}
                  </CardContent>
                </Card>
                <Card className="bg-white border-emerald-200">
                  <CardContent className="pt-4">
                    <h3 className="text-emerald-700 font-semibold mb-2">
                      Verification Tasks
                    </h3>
                    {Array.isArray(bj.verification_tasks) && bj.verification_tasks.length > 0 ? (
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
                    ) : (
                      <p className="text-gray-400 text-xs font-mono italic">Populated when the brief includes at least one falsification test and other verification tasks (gaps, unverified claims, evidence-gathering).</p>
                    )}
                  </CardContent>
                </Card>
                <Card className="bg-white border-emerald-200">
                  <CardContent className="pt-4">
                    <h3 className="text-emerald-700 font-semibold mb-2">
                      Evidence Strength (Matrix)
                    </h3>
                    {Array.isArray(bj.evidence_strength) && bj.evidence_strength.length > 0 ? (
                      <ul className="space-y-3">
                        {(bj.evidence_strength as Array<Record<string, unknown>>).map(
                          (es, i) => {
                            const evidenceIndex = (bj.evidence_index ?? {}) as Record<string, { source_tier?: string }>;
                            const refs = Array.isArray(es.supporting_refs) ? (es.supporting_refs as string[]) : [];
                            const primaryCount = Number(es.primary_sources_count ?? 0);
                            const secondaryCount = Number(es.secondary_sources_count ?? 0);
                            return (
                              <li key={i} className="border border-emerald-100 rounded p-2 text-sm">
                                <div className="font-medium text-gray-900">
                                  {String(es.theme ?? '')}
                                </div>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span
                                    className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                                      es.strength_rating === 'high'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : es.strength_rating === 'medium'
                                          ? 'bg-amber-100 text-amber-800'
                                          : 'bg-gray-100 text-gray-700'
                                    }`}
                                  >
                                    {String(es.strength_rating ?? '').toUpperCase()}
                                  </span>
                                  <span className="text-gray-500 text-xs font-mono">
                                    {Number(es.results_count ?? 0)} results · {Number(es.saved_links_count ?? 0)} saved links · {Number(es.wayback_count ?? 0)} wayback · {Number(es.note_count ?? 0)} notes
                                  </span>
                                  {(primaryCount > 0 || secondaryCount > 0) && (
                                    <span className="text-xs font-mono text-gray-600">
                                      {primaryCount > 0 && <span className="inline-block px-1 py-0.5 rounded bg-emerald-100 text-emerald-800 mr-1">{primaryCount}P</span>}
                                      {secondaryCount > 0 && <span className="inline-block px-1 py-0.5 rounded bg-amber-100 text-amber-800">{secondaryCount}S</span>}
                                    </span>
                                  )}
                                </div>
                                {refs.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-1 mt-1.5 text-xs font-mono text-gray-600">
                                    <span className="text-gray-500">Refs:</span>
                                    {refs.map((id) => {
                                      const tier = evidenceIndex[id]?.source_tier;
                                      return (
                                        <span key={id} className="inline-flex items-center gap-0.5">
                                          {tier === 'primary' && <span className="px-1 py-0.5 rounded bg-emerald-100 text-emerald-800" title="Primary source">P</span>}
                                          {tier === 'secondary' && <span className="px-1 py-0.5 rounded bg-amber-100 text-amber-800" title="Secondary source">S</span>}
                                          <span>{id}</span>
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                                {es.corroboration_estimate != null && String(es.corroboration_estimate).trim() !== '' ? (
                                  <p className="text-gray-600 text-xs mt-1">
                                    {String(es.corroboration_estimate)}
                                  </p>
                                ) : null}
                              </li>
                            );
                          }
                        )}
                      </ul>
                    ) : (
                      <p className="text-gray-400 text-xs font-mono italic">Populated when the case has multiple thematic lines (narrative, entities, timeline).</p>
                    )}
                  </CardContent>
                </Card>
                <Card className="bg-white border-emerald-200">
                  <CardContent className="pt-4">
                    <h3 className="text-emerald-700 font-semibold mb-2">
                      Hypotheses
                    </h3>
                    {Array.isArray(bj.hypotheses) && bj.hypotheses.length > 0 ? (
                      <ul className="space-y-4">
                        {(bj.hypotheses as Array<Record<string, unknown>>).map((h, i) => (
                          <li key={i} className="border border-emerald-100 rounded p-3 text-sm">
                            <p className="font-medium text-gray-900 mb-1">{String(h.statement ?? '')}</p>
                            <span
                              className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                                h.likelihood === 'high'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : h.likelihood === 'medium'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {String(h.likelihood ?? '').toUpperCase()}
                            </span>
                            <div className="mt-2 text-xs">
                              <p className="text-emerald-700 font-mono mb-0.5">Evidence for: [{Array.isArray(h.evidence_for) ? (h.evidence_for as string[]).join(', ') : ''}]</p>
                              <p className="text-amber-700 font-mono mb-0.5">Evidence against: [{Array.isArray(h.evidence_against) ? (h.evidence_against as string[]).join(', ') : ''}]</p>
                              {Array.isArray(h.falsification_tests) && (h.falsification_tests as string[]).length > 0 && (
                                <ul className="mt-1 space-y-0.5 list-disc list-inside text-gray-600">
                                  {(h.falsification_tests as string[]).map((t, j) => (
                                    <li key={j}>{String(t)}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-400 text-xs font-mono italic">Populated when the case supports 2–5 competing explanations.</p>
                    )}
                  </CardContent>
                </Card>
                <Card className="bg-white border-emerald-200">
                  <CardContent className="pt-4">
                    <h3 className="text-emerald-700 font-semibold mb-2">
                      Critical Gaps (Missing Evidence)
                    </h3>
                    {Array.isArray(bj.critical_gaps) && bj.critical_gaps.length > 0 ? (
                      <ul className="space-y-4">
                        {(bj.critical_gaps as Array<Record<string, unknown>>).map((g, i) => (
                          <li key={i} className="border border-emerald-100 rounded p-3 text-sm">
                            <p className="font-medium text-gray-900 mb-1">
                              Missing: {String(g.missing_item ?? '')}
                            </p>
                            <p className="text-gray-600 text-xs mb-1">
                              Why it matters: {String(g.why_it_matters ?? '')}
                            </p>
                            <p className="text-emerald-700 text-xs mb-1">
                              Fastest way to verify: {String(g.fastest_way_to_verify ?? '')}
                            </p>
                            {Array.isArray(g.suggested_queries) && (g.suggested_queries as string[]).length > 0 && (
                              <p className="text-amber-700 font-mono text-xs mt-1">
                                Suggested queries:{' '}
                                {(g.suggested_queries as string[]).map((q, j) => (
                                  <span key={j}>
                                    {j > 0 ? ' · ' : ''}{q}
                                  </span>
                                ))}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-400 text-xs font-mono italic">Populated when the case has clear missing evidence that would change the analysis.</p>
                    )}
                  </CardContent>
                </Card>
                <Card className="bg-white border-emerald-200">
                  <CardContent className="pt-4">
                    <h3 className="text-emerald-700 font-semibold mb-2">
                      Adversarial Collapse Tests
                    </h3>
                    {Array.isArray(bj.collapse_tests) && bj.collapse_tests.length > 0 ? (
                      <ul className="space-y-4">
                        {(bj.collapse_tests as Array<Record<string, unknown>>).map((t, i) => (
                          <li key={i} className="border border-emerald-100 rounded p-3 text-sm">
                            <p className="font-medium text-gray-900 mb-2">
                              Claim/Hypothesis: {String(t.claim_or_hypothesis ?? '')}
                            </p>
                            {Array.isArray(t.critical_assumptions) && (t.critical_assumptions as string[]).length > 0 && (
                              <p className="text-gray-600 text-xs mb-1">
                                <span className="font-medium">Critical assumptions:</span>
                                <ul className="list-disc pl-4 mt-0.5">
                                  {(t.critical_assumptions as string[]).map((a, j) => (
                                    <li key={j}>{a}</li>
                                  ))}
                                </ul>
                              </p>
                            )}
                            {Array.isArray(t.single_points_of_failure) && (t.single_points_of_failure as string[]).length > 0 && (
                              <p className="text-gray-600 text-xs mb-1">
                                <span className="font-medium">Single points of failure:</span>
                                <ul className="list-disc pl-4 mt-0.5">
                                  {(t.single_points_of_failure as string[]).map((s, j) => (
                                    <li key={j}>{s}</li>
                                  ))}
                                </ul>
                              </p>
                            )}
                            {Array.isArray(t.what_would_falsify) && (t.what_would_falsify as string[]).length > 0 && (
                              <p className="text-gray-600 text-xs mb-1">
                                <span className="font-medium">What would falsify:</span>
                                <ul className="list-disc pl-4 mt-0.5">
                                  {(t.what_would_falsify as string[]).map((w, j) => (
                                    <li key={j}>{w}</li>
                                  ))}
                                </ul>
                              </p>
                            )}
                            <p className="text-emerald-700 text-xs mt-1">
                              Highest leverage next step: {String(t.highest_leverage_next_step ?? '')}
                            </p>
                            {Array.isArray(t.supporting_refs) && (t.supporting_refs as string[]).length > 0 && (
                              <p className="text-amber-700 font-mono text-xs mt-1">
                                Refs: {(t.supporting_refs as string[]).join(', ')}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-400 text-xs font-mono italic">Populated when the case contains central claims or hypotheses that rely on specific assumptions.</p>
                    )}
                  </CardContent>
                </Card>
                <Card className="bg-white border-emerald-200">
                  <CardContent className="pt-4">
                    <h3 className="text-emerald-700 font-semibold mb-2">
                      Incentive Matrix
                    </h3>
                    {Array.isArray(bj.incentive_matrix) && bj.incentive_matrix.length > 0 ? (
                      <ul className="space-y-4">
                        {(bj.incentive_matrix as Array<Record<string, unknown>>).map((m, i) => (
                          <li key={i} className="border border-emerald-100 rounded p-3 text-sm">
                            <p className="font-medium text-gray-900 mb-2">
                              {String(m.actor ?? '')} — {String(m.role ?? '')}
                            </p>
                            {Array.isArray(m.narrative_a_incentives) && (m.narrative_a_incentives as string[]).length > 0 && (
                              <p className="text-gray-600 text-xs mb-1">
                                <span className="font-medium">Narrative A incentives:</span>
                                <ul className="list-disc pl-4 mt-0.5">
                                  {(m.narrative_a_incentives as string[]).map((a, j) => (
                                    <li key={j}>{a}</li>
                                  ))}
                                </ul>
                              </p>
                            )}
                            {Array.isArray(m.narrative_b_incentives) && (m.narrative_b_incentives as string[]).length > 0 && (
                              <p className="text-gray-600 text-xs mb-1">
                                <span className="font-medium">Narrative B incentives:</span>
                                <ul className="list-disc pl-4 mt-0.5">
                                  {(m.narrative_b_incentives as string[]).map((b, j) => (
                                    <li key={j}>{b}</li>
                                  ))}
                                </ul>
                              </p>
                            )}
                            {Array.isArray(m.exposure_if_false) && (m.exposure_if_false as string[]).length > 0 && (
                              <p className="text-gray-600 text-xs mb-1">
                                <span className="font-medium">Exposure if false:</span>
                                <ul className="list-disc pl-4 mt-0.5">
                                  {(m.exposure_if_false as string[]).map((e, j) => (
                                    <li key={j}>{e}</li>
                                  ))}
                                </ul>
                              </p>
                            )}
                            {Array.isArray(m.supporting_refs) && (m.supporting_refs as string[]).length > 0 && (
                              <p className="text-amber-700 font-mono text-xs mt-1">
                                Refs: {(m.supporting_refs as string[]).join(', ')}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-400 text-xs font-mono italic">Populated when the case contains competing narratives with identifiable strategic incentives.</p>
                    )}
                  </CardContent>
                </Card>
                {/* Evidence & brief quality — one block for all server-computed sections */}
                <Card className="bg-white border-emerald-200">
                  <CardContent className="pt-4">
                    <h3 className="text-emerald-700 font-semibold mb-4">Evidence & brief quality</h3>
                    <div className="space-y-4">
                      {typeof bj.source_credibility_summary === 'string' && bj.source_credibility_summary.trim() !== '' && (
                        <div>
                          <h4 className="text-emerald-600 font-medium text-xs mb-1">Source credibility</h4>
                          <p className="text-gray-700 text-xs">{bj.source_credibility_summary}</p>
                        </div>
                      )}
                      {bj.evidence_summary_panel != null && typeof bj.evidence_summary_panel === 'object' && (
                        <div>
                          <h4 className="text-emerald-600 font-medium text-xs mb-1">Evidence summary</h4>
                          {(bj.evidence_summary_panel as { intro?: string }).intro && (
                            <p className="text-gray-700 text-xs mb-1">{(bj.evidence_summary_panel as { intro?: string }).intro}</p>
                          )}
                          <p className="text-xs text-gray-600 mb-0.5">
                            Totals: {(bj.evidence_summary_panel as { totals: { results: number; saved_links: number; notes: number; wayback_results: number } }).totals?.results ?? 0} results, {(bj.evidence_summary_panel as { totals: { saved_links: number } }).totals?.saved_links ?? 0} saved links, {(bj.evidence_summary_panel as { totals: { notes: number } }).totals?.notes ?? 0} notes, {(bj.evidence_summary_panel as { totals: { wayback_results: number } }).totals?.wayback_results ?? 0} wayback.
                          </p>
                          {Array.isArray((bj.evidence_summary_panel as Record<string, unknown>).top_sources) && ((bj.evidence_summary_panel as { top_sources: { label: string; count: number }[] }).top_sources).length > 0 && (
                            <p className="text-xs text-gray-500 mb-0.5">
                              Top sources: {((bj.evidence_summary_panel as { top_sources: { label: string; count: number }[] }).top_sources).slice(0, 5).map((s) => `${s.label} (${s.count})`).join(', ')}
                            </p>
                          )}
                          {Array.isArray((bj.evidence_summary_panel as Record<string, unknown>).coverage_notes) && ((bj.evidence_summary_panel as { coverage_notes: string[] }).coverage_notes).length > 0 && (
                            <p className="text-xs text-gray-500">{((bj.evidence_summary_panel as { coverage_notes: string[] }).coverage_notes).join(' ')}</p>
                          )}
                        </div>
                      )}
                      {bj.entity_summary_panel != null && typeof bj.entity_summary_panel === 'object' && (Array.isArray((bj.entity_summary_panel as Record<string, unknown>).top_entities) ? (bj.entity_summary_panel as { top_entities: unknown[] }).top_entities.length > 0 : false) && (
                        <div>
                          <h4 className="text-emerald-600 font-medium text-xs mb-1">Entity summary</h4>
                          {(bj.entity_summary_panel as { intro?: string }).intro && (
                            <p className="text-gray-700 text-xs mb-1">{(bj.entity_summary_panel as { intro?: string }).intro}</p>
                          )}
                          <ul className="text-xs text-gray-600 space-y-0.5 mb-1">
                            {((bj.entity_summary_panel as { top_entities: { name: string; type: string; mention_count: number }[] }).top_entities).map((e, i) => (
                              <li key={i}>{e.name} ({e.type}) — {e.mention_count}</li>
                            ))}
                          </ul>
                          {Array.isArray((bj.entity_summary_panel as Record<string, unknown>).notable_connections) && ((bj.entity_summary_panel as { notable_connections: string[] }).notable_connections).length > 0 && (
                            <ul className="text-xs text-gray-500 list-disc pl-4">
                              {((bj.entity_summary_panel as { notable_connections: string[] }).notable_connections).map((c, i) => (
                                <li key={i}>{c}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                      {bj.integrity_score != null && typeof bj.integrity_score === 'object' && (
                        <div>
                          <h4 className="text-emerald-600 font-medium text-xs mb-1">Integrity score</h4>
                          <p className="text-gray-900 text-xs font-medium">
                            Score: {Number((bj.integrity_score as Record<string, unknown>).score_0_100) ?? 0}/100 — Grade: {String((bj.integrity_score as Record<string, unknown>).grade ?? '—')}
                          </p>
                          {Array.isArray((bj.integrity_score as Record<string, unknown>).drivers) && ((bj.integrity_score as Record<string, unknown>).drivers as string[]).length > 0 && (
                            <ul className="text-gray-600 text-xs list-disc pl-4 mt-0.5">
                              {((bj.integrity_score as Record<string, unknown>).drivers as string[]).map((d, j) => (
                                <li key={j}>{d}</li>
                              ))}
                            </ul>
                          )}
                          {Array.isArray((bj.integrity_score as Record<string, unknown>).weak_points) && ((bj.integrity_score as Record<string, unknown>).weak_points as string[]).length > 0 && (
                            <ul className="text-gray-600 text-xs list-disc pl-4 mt-0.5">
                              {((bj.integrity_score as Record<string, unknown>).weak_points as string[]).map((w, j) => (
                                <li key={j}>{w}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                      {bj.evidence_network != null && typeof bj.evidence_network === 'object' && (
                        <div>
                          <h4 className="text-emerald-600 font-medium text-xs mb-1">Evidence network</h4>
                          {Array.isArray((bj.evidence_network as Record<string, unknown>).central_nodes) && ((bj.evidence_network as Record<string, unknown>).central_nodes as Array<Record<string, unknown>>).length > 0 && (
                            <ul className="text-gray-600 text-xs list-disc pl-4">
                              {((bj.evidence_network as Record<string, unknown>).central_nodes as Array<Record<string, unknown>>).map((n, j) => (
                                <li key={j}>{String(n.id ?? '')} — {Number(n.mention_count ?? 0)} refs{typeof n.type === 'string' ? ` (${n.type})` : ''}</li>
                              ))}
                            </ul>
                          )}
                          {Array.isArray((bj.evidence_network as Record<string, unknown>).isolated_nodes) && ((bj.evidence_network as Record<string, unknown>).isolated_nodes as Array<Record<string, unknown>>).length > 0 && (
                            <ul className="text-gray-600 text-xs list-disc pl-4 mt-0.5">
                              {((bj.evidence_network as Record<string, unknown>).isolated_nodes as Array<Record<string, unknown>>).map((n, j) => (
                                <li key={j}>{String(n.id ?? '')}{typeof n.type === 'string' ? ` (${n.type})` : ''}</li>
                              ))}
                            </ul>
                          )}
                          {Array.isArray((bj.evidence_network as Record<string, unknown>).single_point_failures) && ((bj.evidence_network as Record<string, unknown>).single_point_failures as Array<Record<string, unknown>>).length > 0 && (
                            <ul className="text-gray-600 text-xs list-disc pl-4 mt-0.5">
                              {((bj.evidence_network as Record<string, unknown>).single_point_failures as Array<Record<string, unknown>>).map((s, j) => (
                                <li key={j}>{String(s.claim_area ?? '')} → depends on {Array.isArray(s.depends_on_ids) ? (s.depends_on_ids as string[]).join(', ') : ''}</li>
                              ))}
                            </ul>
                          )}
                          {(!Array.isArray((bj.evidence_network as Record<string, unknown>).central_nodes) || ((bj.evidence_network as Record<string, unknown>).central_nodes as unknown[]).length === 0) &&
                           (!Array.isArray((bj.evidence_network as Record<string, unknown>).isolated_nodes) || ((bj.evidence_network as Record<string, unknown>).isolated_nodes as unknown[]).length === 0) &&
                           (!Array.isArray((bj.evidence_network as Record<string, unknown>).single_point_failures) || ((bj.evidence_network as Record<string, unknown>).single_point_failures as unknown[]).length === 0) && (
                            <p className="text-gray-400 text-xs italic">No central/isolated nodes or single-point failures.</p>
                          )}
                        </div>
                      )}
                      {Array.isArray(bj.coherence_alerts) && bj.coherence_alerts.length > 0 && (
                        <div>
                          <h4 className="text-emerald-600 font-medium text-xs mb-1">Coherence alerts</h4>
                          <ul className="space-y-2">
                            {(bj.coherence_alerts as Array<Record<string, unknown>>).map((a, i) => (
                              <li
                                key={i}
                                className={`border rounded p-2 text-xs ${
                                  String(a.severity) === 'high' ? 'border-red-200 bg-red-50/50' : String(a.severity) === 'medium' ? 'border-amber-200 bg-amber-50/50' : 'border-gray-200 bg-gray-50/50'
                                }`}
                              >
                                <span className="font-mono font-medium uppercase text-gray-600">{String(a.severity)}</span>
                                <p className="font-medium text-gray-900 mt-0.5">{String(a.alert ?? '')}</p>
                                <p className="text-gray-600 mt-0.5">{String(a.why_it_matters ?? '')}</p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-white border-emerald-200">
                  <CardContent className="pt-4">
                    <h3 className="text-emerald-700 font-semibold mb-2">
                      Saved link notes (evidence)
                    </h3>
                    <p className="text-gray-500 text-xs font-mono mb-3">
                      Per-link notes from the Saved tab for this case. Used when this brief was generated.
                    </p>
                    {viewSavedLinksEvidence.length > 0 ? (
                      <ul className="space-y-3">
                        {viewSavedLinksEvidence.map((link) => (
                          <li key={link.id} className="border border-emerald-100 rounded p-3 text-sm">
                            <div className="font-mono text-xs text-emerald-700 mb-1">
                              {link.source_tier === 'primary' && (
                                <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold mr-1.5">P</span>
                              )}
                              {link.source_tier === 'secondary' && (
                                <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold mr-1.5">S</span>
                              )}
                              {link.source} · {link.title || link.url}
                            </div>
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-600 hover:underline break-all text-xs block mb-2"
                            >
                              {link.url}
                            </a>
                            {link.notes.length > 0 ? (
                              <ul className="space-y-1.5 mt-2">
                                {link.notes.map((n, i) => (
                                  <li key={n.id} className="text-gray-700 whitespace-pre-wrap border-l-2 border-amber-200 pl-2">
                                    <span className="text-amber-700 font-mono text-xs">Note {i + 1}</span>
                                    <p className="mt-0.5">{n.content}</p>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-gray-400 text-xs font-mono">No notes</p>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500 text-xs font-mono">No saved links for this case. Save links from the Saved tab (for this case) to see them here.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <Sheet open={caseCodeOpen} onOpenChange={setCaseCodeOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl border-emerald-200 bg-white">
          <SheetHeader>
            <SheetTitle className="text-emerald-700 font-mono">Case code</SheetTitle>
            <SheetDescription className="text-gray-600 font-mono text-sm">
              How to build your case and fill the forensic brief — what to add, how to use it, why it matters.
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-6rem)] mt-4 pr-4">
            <div className="space-y-6 font-mono text-sm pb-4">
              <Card className="bg-emerald-50 border-emerald-200">
                <CardContent className="pt-4">
                  <h3 className="text-emerald-700 font-semibold mb-2">Results tab — how it feeds the brief</h3>
                  <p className="text-gray-600 text-xs font-medium mb-1">Archive</p>
                  <p className="text-gray-700 text-xs mb-2">Paste URL, get Wayback captures. Bookmark (save) to add to Saved. Brief uses saved links as evidence → timeline, entities, source credibility.</p>
                  <p className="text-gray-600 text-xs font-medium mb-1">Queries</p>
                  <p className="text-gray-700 text-xs mb-2">Discovery search results. Bookmark to save. Same: feeds brief evidence.</p>
                  <p className="text-gray-600 text-xs font-medium mb-1">Notes</p>
                  <p className="text-gray-700 text-xs mb-2">Query-scoped. Brief gets notes_by_query → timeline, entities, gaps. Add facts and context the AI can synthesize.</p>
                  <p className="text-gray-600 text-xs font-medium mb-1">Official Sources</p>
                  <p className="text-gray-700 text-xs mb-2">Find official URLs (e.g. .gov). Bookmark to save. Counts as official in credibility; strengthens the brief.</p>
                  <p className="text-gray-600 text-xs font-medium mb-1">Saved</p>
                  <p className="text-gray-700 text-xs mb-2">All bookmarked links for this case. Brief builds evidence_index from these (and results, notes).</p>
                  <p className="text-gray-600 text-xs font-medium mb-1">P and S buttons</p>
                  <p className="text-gray-700 text-xs mb-2">On each saved link: P = primary source, S = secondary. Brief uses source_tier for credibility summary and weighting.</p>
                  <p className="text-gray-600 text-xs font-medium mb-1">Extract key facts</p>
                  <p className="text-gray-700 text-xs mb-2">Button on saved link: pulls key claims/entities/dates from the page. Use as reference; per-link notes are what the brief explicitly uses.</p>
                  <p className="text-gray-600 text-xs font-medium mb-1">Notes under each saved link</p>
                  <p className="text-gray-700 text-xs">Add URLs or paste text from that link. Brief receives these as evidence; write facts, quotes, or context that should appear in timeline, entities, or contradictions.</p>
                </CardContent>
              </Card>
              <Card className="bg-emerald-50 border-emerald-200">
                <CardContent className="pt-4">
                  <h3 className="text-emerald-700 font-semibold mb-2">Top entities</h3>
                  <p className="text-gray-600 text-xs font-medium mb-1">What it is</p>
                  <p className="text-gray-700 text-xs mb-2">Rebuild extracts people, orgs, etc. from notes, results, and saved links for this case.</p>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" aria-hidden />How to use it for the brief</p>
                  <p className="text-gray-700 text-xs mb-2">Surfaces who/what matters across evidence. Brief key_entities can align; use Open mentions to trace which evidence backs each entity.</p>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" aria-hidden />Why it matters</p>
                  <p className="text-gray-700 text-xs">More and better evidence → better entity list → stronger brief.</p>
                </CardContent>
              </Card>
              <Card className="bg-emerald-50 border-emerald-200">
                <CardContent className="pt-4">
                  <h3 className="text-emerald-700 font-semibold mb-2">Next moves</h3>
                  <p className="text-gray-600 text-xs font-medium mb-1">What it is</p>
                  <p className="text-gray-700 text-xs mb-2">Case tasks. Import from brief to turn verification tasks into trackable next steps.</p>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" aria-hidden />How to use it to build the case</p>
                  <p className="text-gray-700 text-xs mb-2">Build brief → get verification tasks → Import tasks from brief → do them (find evidence, close gaps) → add evidence and regenerate brief. Cycle until the case is solid.</p>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" aria-hidden />Why it matters</p>
                  <p className="text-gray-700 text-xs">Turns brief output into concrete work; doing those tasks improves the next brief.</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-emerald-200">
                <CardContent className="pt-4">
                  <h3 className="text-emerald-700 font-semibold mb-2">Case objective</h3>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" aria-hidden />What to add</p>
                  <p className="text-gray-700 text-xs mb-2">Set a clear objective when creating or editing the case (e.g. what you are trying to find out or decide). Optional but recommended.</p>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" aria-hidden />How to use it</p>
                  <p className="text-gray-700 text-xs mb-2">The brief is oriented around this objective: overview, timeline, entities, and tasks all flow toward it.</p>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" aria-hidden />Why it matters</p>
                  <p className="text-gray-700 text-xs">One clear direction keeps the brief cohesive and actionable.</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-emerald-200">
                <CardContent className="pt-4">
                  <h3 className="text-emerald-700 font-semibold mb-2">Executive Overview</h3>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" aria-hidden />What to add</p>
                  <p className="text-gray-700 text-xs mb-2">The AI writes this last, synthesizing timeline and entities. You give evidence (queries, saved links, notes) and optionally a case objective.</p>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" aria-hidden />How to use it</p>
                  <p className="text-gray-700 text-xs mb-2">Read it first for the one-page story; it is tied to your case objective when set.</p>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" aria-hidden />Why it matters</p>
                  <p className="text-gray-700 text-xs">Single narrative that orients the reader.</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-emerald-200">
                <CardContent className="pt-4">
                  <h3 className="text-emerald-700 font-semibold mb-2">Working Timeline</h3>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" aria-hidden />What to add</p>
                  <p className="text-gray-700 text-xs mb-2">Events with time window, event description, confidence (high/medium/low), basis (public/note/confidential/unverified), and source refs. Add evidence; the AI turns it into timeline entries.</p>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" aria-hidden />How to use it</p>
                  <p className="text-gray-700 text-xs mb-2">Check that key events are there and confidence matches the evidence; mark Verified in the UI when you have confirmed.</p>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" aria-hidden />Why it matters</p>
                  <p className="text-gray-700 text-xs">Chronology is the backbone; weak or unsupported events get flagged in coherence alerts.</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-emerald-200">
                <CardContent className="pt-4">
                  <h3 className="text-emerald-700 font-semibold mb-2">Key Entities</h3>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" aria-hidden />What to add</p>
                  <p className="text-gray-700 text-xs mb-2">People, orgs, domains, locations, handles. The AI extracts them from evidence and links source_refs.</p>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" aria-hidden />How to use it</p>
                  <p className="text-gray-700 text-xs mb-2">See who and what matters; use entity mentions to trace evidence.</p>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" aria-hidden />Why it matters</p>
                  <p className="text-gray-700 text-xs">Shows who the brief is about and what evidence supports each.</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-emerald-200">
                <CardContent className="pt-4">
                  <h3 className="text-emerald-700 font-semibold mb-2">Contradictions & Tensions</h3>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" aria-hidden />What to add</p>
                  <p className="text-gray-700 text-xs mb-2">Issue, two sides (statement A/B) and refs, and optional resolution tasks. The AI fills this when evidence conflicts.</p>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" aria-hidden />How to use it</p>
                  <p className="text-gray-700 text-xs mb-2">Use it to spot conflicts; add or follow resolution tasks so they do not stay open.</p>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" aria-hidden />Why it matters</p>
                  <p className="text-gray-700 text-xs">Unresolved contradictions without tasks trigger coherence alerts; resolving them strengthens the case.</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-emerald-200">
                <CardContent className="pt-4">
                  <h3 className="text-emerald-700 font-semibold mb-2">Verification Tasks</h3>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" aria-hidden />What to add</p>
                  <p className="text-gray-700 text-xs mb-2">Concrete tasks (and suggested queries). At least one should be a falsification test: If X were found, it would contradict Y. The AI suggests these from gaps and hypotheses.</p>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" aria-hidden />How to use it</p>
                  <p className="text-gray-700 text-xs mb-2">Turn them into Next Moves tasks; do the falsification tests first.</p>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" aria-hidden />Why it matters</p>
                  <p className="text-gray-700 text-xs">Turns we do not know into next steps and makes the brief testable.</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-emerald-200">
                <CardContent className="pt-4">
                  <h3 className="text-emerald-700 font-semibold mb-2">Evidence Strength</h3>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" aria-hidden />What to add</p>
                  <p className="text-gray-700 text-xs mb-2">Theme, counts (results, saved links, wayback, notes), corroboration estimate, strength rating. The AI fills this when there are multiple themes.</p>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" aria-hidden />How to use it</p>
                  <p className="text-gray-700 text-xs mb-2">See which themes are well supported vs thin.</p>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" aria-hidden />Why it matters</p>
                  <p className="text-gray-700 text-xs">Shows where the case is strong or needs more evidence.</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-emerald-200">
                <CardContent className="pt-4">
                  <h3 className="text-emerald-700 font-semibold mb-2">Hypotheses</h3>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" aria-hidden />What to add</p>
                  <p className="text-gray-700 text-xs mb-2">Statement, likelihood, evidence for/against, falsification tests. The AI adds these when the case supports testable interpretations.</p>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" aria-hidden />How to use it</p>
                  <p className="text-gray-700 text-xs mb-2">Use them to frame what you are testing; align verification tasks with them.</p>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" aria-hidden />Why it matters</p>
                  <p className="text-gray-700 text-xs">Makes the reasoning explicit and falsifiable.</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-emerald-200">
                <CardContent className="pt-4">
                  <h3 className="text-emerald-700 font-semibold mb-2">Critical Gaps</h3>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" aria-hidden />What to add</p>
                  <p className="text-gray-700 text-xs mb-2">Missing item, why it matters, fastest way to verify, suggested queries. The AI fills from evidence gaps.</p>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" aria-hidden />How to use it</p>
                  <p className="text-gray-700 text-xs mb-2">Prioritize closing these via verification tasks or new evidence.</p>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" aria-hidden />Why it matters</p>
                  <p className="text-gray-700 text-xs">Surfaces what is missing so the brief is not overconfident.</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-emerald-200">
                <CardContent className="pt-4">
                  <h3 className="text-emerald-700 font-semibold mb-2">Source Credibility Summary</h3>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" aria-hidden />What to add</p>
                  <p className="text-gray-700 text-xs mb-2">Computed from evidence_index (official / news / social / internal / unverified). No user input.</p>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" aria-hidden />How to use it</p>
                  <p className="text-gray-700 text-xs mb-2">Quick read on whether the case leans on strong or weak sources.</p>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" aria-hidden />Why it matters</p>
                  <p className="text-gray-700 text-xs">High confidence on weak sources triggers coherence alerts.</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-emerald-200">
                <CardContent className="pt-4">
                  <h3 className="text-emerald-700 font-semibold mb-2">Integrity Score</h3>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" aria-hidden />What to add</p>
                  <p className="text-gray-700 text-xs mb-2">Computed from structure (drivers, weak points). No user input.</p>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" aria-hidden />How to use it</p>
                  <p className="text-gray-700 text-xs mb-2">Use the grade and weak points to see where the brief is structurally weak.</p>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" aria-hidden />Why it matters</p>
                  <p className="text-gray-700 text-xs">One number for how solid the brief is.</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-emerald-200">
                <CardContent className="pt-4">
                  <h3 className="text-emerald-700 font-semibold mb-2">Evidence Network</h3>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" aria-hidden />What to add</p>
                  <p className="text-gray-700 text-xs mb-2">Central nodes (most cited), isolated nodes (cited once), single-point failures (one ref for a claim). Computed from timeline, entities, and contradictions.</p>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" aria-hidden />How to use it</p>
                  <p className="text-gray-700 text-xs mb-2">Strengthen or drop single-point failures; add evidence for important isolated nodes.</p>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" aria-hidden />Why it matters</p>
                  <p className="text-gray-700 text-xs">Shows over-reliance on one source and where the case is fragile.</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-emerald-200">
                <CardContent className="pt-4">
                  <h3 className="text-emerald-700 font-semibold mb-2">Coherence Alerts</h3>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" aria-hidden />What to add</p>
                  <p className="text-gray-700 text-xs mb-2">Auto checks (e.g. verified with 0–1 refs, high confidence on social/unverified, contradiction with no resolution tasks).</p>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" aria-hidden />How to use it</p>
                  <p className="text-gray-700 text-xs mb-2">Fix the listed issues to raise integrity and credibility.</p>
                  <p className="text-gray-600 text-xs font-medium mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" aria-hidden />Why it matters</p>
                  <p className="text-gray-700 text-xs">Catches inconsistencies before you rely on the brief.</p>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <Dialog open={!!noteBrief} onOpenChange={(open) => !open && closeNoteDialog()}>
        <DialogContent className="sm:max-w-md border-emerald-200">
          <DialogHeader>
            <DialogTitle className="text-emerald-700 font-mono">
              Note for Brief v{noteBrief?.version_number}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Add or edit a note for this brief
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Textarea
              placeholder="Quick note about this brief..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="min-h-[100px] font-mono text-sm border-emerald-200 resize-none"
              disabled={savingNote}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="font-mono border-emerald-200"
                onClick={closeNoteDialog}
                disabled={savingNote}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-emerald-600 hover:bg-emerald-700 font-mono"
                onClick={handleSaveNote}
                disabled={savingNote}
              >
                {savingNote ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={compareDialogOpen} onOpenChange={setCompareDialogOpen}>
        <DialogContent className="sm:max-w-md border-emerald-200">
          <DialogHeader>
            <DialogTitle className="text-emerald-700 font-mono">
              Compare Versions
            </DialogTitle>
            <DialogDescription className="sr-only">
              Select two versions to see differences
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-mono text-emerald-700">Left version (older)</Label>
              <Select value={compareLeftId} onValueChange={setCompareLeftId}>
                <SelectTrigger className="mt-1 border-emerald-200 font-mono">
                  <SelectValue placeholder="Select version" />
                </SelectTrigger>
                <SelectContent>
                  {sortedBriefs.map((b) => (
                    <SelectItem key={b.id} value={b.id} className="font-mono">
                      v{b.version_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-mono text-emerald-700">Right version (newer)</Label>
              <Select value={compareRightId} onValueChange={setCompareRightId}>
                <SelectTrigger className="mt-1 border-emerald-200 font-mono">
                  <SelectValue placeholder="Select version" />
                </SelectTrigger>
                <SelectContent>
                  {sortedBriefs.map((b) => (
                    <SelectItem key={b.id} value={b.id} className="font-mono">
                      v{b.version_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {compareLeftId && compareRightId && compareLeftId === compareRightId && (
              <p className="text-amber-700 text-xs font-mono">Select two different versions.</p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="font-mono border-emerald-200"
                onClick={() => setCompareDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-emerald-600 hover:bg-emerald-700 font-mono"
                onClick={handleShowDiff}
                disabled={diffLoading || !compareLeftId || !compareRightId || compareLeftId === compareRightId}
              >
                {diffLoading ? 'Loading...' : 'Show Diff'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={diffSheetOpen} onOpenChange={setDiffSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl border-emerald-200 bg-white">
          <SheetHeader>
            <SheetTitle className="text-emerald-700 font-mono">
              Version Diff: v{diffLeftVersion ?? '?'} vs v{diffRightVersion ?? '?'}
            </SheetTitle>
            <SheetDescription className="sr-only">
              Structural differences between the two versions
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-6rem)] mt-4 pr-4">
            {diffEntries.length === 0 ? (
              <p className="text-gray-500 font-mono text-sm italic">No structural differences detected.</p>
            ) : (
              <Card className="bg-white border-emerald-200 mt-2">
                <CardContent className="pt-4">
                  <ul className="space-y-2">
                    {diffEntries.map((entry, idx) => (
                      <li key={idx} className="text-sm">
                        <span
                          className={`text-xs font-mono px-1.5 py-0.5 rounded mr-1.5 ${
                            entry.kind === 'added'
                              ? 'bg-emerald-100 text-emerald-800'
                              : entry.kind === 'removed'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {entry.kind === 'added' ? 'Added' : entry.kind === 'removed' ? 'Removed' : 'Modified'}
                        </span>
                        {entry.section && (
                          <span className="text-gray-500 text-xs mr-1">{entry.section}</span>
                        )}
                        <span className="text-gray-800">{entry.label ?? ''}</span>
                        {entry.detail && (
                          <p className="text-gray-500 text-xs mt-0.5">{entry.detail}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
