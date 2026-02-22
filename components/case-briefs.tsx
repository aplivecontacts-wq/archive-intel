'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Eye, Download, StickyNote, GitCompare } from 'lucide-react';
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
  created_at: string;
  notes: SavedLinkNoteRow[];
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
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono"
        >
          <FileText className="h-4 w-4 mr-2" />
          {generating ? 'GENERATING...' : 'Build Forensic Brief'}
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
                            const refs = [...new Set((item.source_ids ?? item.source_refs ?? []) as string[])];
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
                          (es, i) => (
                            <li key={i} className="border border-emerald-100 rounded p-2 text-sm">
                              <div className="font-medium text-gray-900">
                                {String(es.theme ?? '')}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
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
                              </div>
                              {es.corroboration_estimate != null && String(es.corroboration_estimate).trim() !== '' ? (
                                <p className="text-gray-600 text-xs mt-1">
                                  {String(es.corroboration_estimate)}
                                </p>
                              ) : null}
                            </li>
                          )
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
