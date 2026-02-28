'use client';

import { useState, useEffect, useCallback, useMemo, useRef, type ChangeEvent } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ExternalLink, Clock, Search, FileText, Loader2, Copy, Building2, Info, LinkIcon, Bookmark, Paperclip, Upload, Trash2, StickyNote, PenLine } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { isValidUrl, canonicalizeUrl } from '@/lib/url-utils';
import { generateMockSearchQueries, detectInputType, sanitizeSnippetForGoogle, type QueryWithCategory } from '@/lib/query-utils';
import { groupQueries, CATEGORY_ORDER, CATEGORY_LABELS } from '@/lib/groupQueries';
import { getObservedEmailInsights } from '@/lib/email-patterns';
import { OfficialSources } from '@/components/official-sources';
import { ArchiveLookup } from '@/components/archive-lookup';

interface Result {
  id: string;
  query_id: string;
  source: 'wayback' | 'search' | 'note';
  title: string;
  url: string | null;
  captured_at: string | null;
  snippet: string | null;
  confidence: number;
  created_at: string;
  category?: string | null;
}

interface Note {
  id: string;
  query_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface SavedLinkNoteRow {
  id: string;
  content: string;
  created_at: string;
}

interface ExtractedFactsShape {
  key_claims?: string[];
  key_entities?: string[];
  key_dates?: string[];
  summary?: string;
}

interface SavedLinkRow {
  id: string;
  user_id: string;
  source: 'archive' | 'query' | 'official';
  url: string;
  title: string | null;
  snippet: string | null;
  captured_at: string | null;
  query_id: string | null;
  case_id: string | null;
  link_notes?: string | null;
  source_tier?: 'primary' | 'secondary' | null;
  official_source?: boolean;
  last_contact_at?: string | null;
  risk_level?: string | null;
  extracted_facts?: ExtractedFactsShape | null;
  extracted_at?: string | null;
  extraction_error?: string | null;
  ai_summary?: string | null;
  ai_key_facts?: string[] | null;
  created_at: string;
  notes?: SavedLinkNoteRow[];
}

interface NoteAttachment {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  url: string | null;
}

interface ResultsTabsProps {
  queryId: string;
  queryStatus: 'running' | 'complete';
  rawInput?: string;
  caseId?: string;
}

function SavedLinkCard({
  saved: s,
  onRemove,
  onNoteSaved,
  onSourceTierChange,
  onSourceMetaChange,
  caseId,
  onExtract,
}: {
  saved: SavedLinkRow;
  onRemove: () => Promise<void>;
  onNoteSaved: () => Promise<void>;
  onSourceTierChange?: (savedLinkId: string, source_tier: 'primary' | 'secondary' | null) => Promise<void>;
  onSourceMetaChange?: (savedLinkId: string, patch: { last_contact_at?: string | null; risk_level?: string | null; official_source?: boolean }) => Promise<void>;
  caseId?: string | null;
  onExtract?: (savedLinkId: string) => Promise<void>;
}) {
  const [showNotes, setShowNotes] = useState(false);
  const [showKeyClaims, setShowKeyClaims] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingTier, setUpdatingTier] = useState(false);
  const [updatingMeta, setUpdatingMeta] = useState(false);
  const [showLinkAttachments, setShowLinkAttachments] = useState(false);
  const [linkAttachments, setLinkAttachments] = useState<{ id: string; file_name: string; mime_type: string; size_bytes: number; url?: string | null; created_at: string }[]>([]);
  const [linkAttachmentsLoading, setLinkAttachmentsLoading] = useState(false);
  const [linkAttachmentUploading, setLinkAttachmentUploading] = useState(false);
  const [linkAttachmentDeletingId, setLinkAttachmentDeletingId] = useState<string | null>(null);
  const linkAttachmentInputRef = useRef<HTMLInputElement | null>(null);
  const [extracting, setExtracting] = useState(false);

  const notes = s.notes ?? [];
  const tier = s.source_tier ?? null;

  const handleSetSourceTier = useCallback(
    async (value: 'primary' | 'secondary' | null) => {
      if (!onSourceTierChange) return;
      const next = tier === value ? null : value;
      setUpdatingTier(true);
      try {
        await onSourceTierChange(s.id, next);
      } finally {
        setUpdatingTier(false);
      }
    },
    [onSourceTierChange, s.id, tier]
  );

  const handleAddNote = useCallback(async () => {
    const trimmed = newNoteContent.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const res = await fetch('/api/saved/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saved_link_id: s.id, content: trimmed }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const msg = (errBody && typeof errBody.error === 'string') ? errBody.error : 'Failed to add note';
        if (process.env.NODE_ENV === 'development') console.error('[ResultsTabs] saved link add note failed', res.status, errBody);
        throw new Error(msg);
      }
      setNewNoteContent('');
      toast.success('Note added');
      await onNoteSaved();
    } catch (e) {
      if (process.env.NODE_ENV === 'development' && e instanceof Error) console.error('[ResultsTabs] saved link add note error', e.message);
      toast.error(e instanceof Error ? e.message : 'Failed to add note');
    } finally {
      setSaving(false);
    }
  }, [s.id, newNoteContent, onNoteSaved]);

  const handleDeleteNote = useCallback(async (noteId: string) => {
    setDeletingId(noteId);
    try {
      const res = await fetch(`/api/saved/notes?id=${encodeURIComponent(noteId)}`, { method: 'DELETE' });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        if (process.env.NODE_ENV === 'development') console.error('[ResultsTabs] saved link delete note failed', res.status, errBody);
        throw new Error('Failed to delete note');
      }
      toast.success('Note removed');
      await onNoteSaved();
    } catch (e) {
      if (process.env.NODE_ENV === 'development' && e instanceof Error) console.error('[ResultsTabs] saved link delete note error', e.message);
      toast.error(e instanceof Error ? e.message : 'Failed to delete note');
    } finally {
      setDeletingId(null);
    }
  }, [onNoteSaved]);

  useEffect(() => {
    if (!showLinkAttachments || !s.id) return;
    setLinkAttachmentsLoading(true);
    fetch(`/api/saved-links/${s.id}/attachments`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load'))))
      .then((data) => setLinkAttachments(data.attachments ?? []))
      .catch(() => setLinkAttachments([]))
      .finally(() => setLinkAttachmentsLoading(false));
  }, [showLinkAttachments, s.id]);

  return (
    <Card className="bg-white border-emerald-200 hover:border-emerald-300 transition-all">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 font-mono uppercase mb-1">{s.source}</p>
            <h3 className="text-gray-900 font-medium font-mono text-sm truncate">{s.title || s.url}</h3>
            {s.captured_at && (
              <p className="text-xs text-gray-500 mt-1 font-mono">
                Captured {formatDistanceToNow(new Date(s.captured_at), { addSuffix: true })}
              </p>
            )}
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-emerald-600 hover:text-emerald-700 underline break-all font-mono block mt-1"
            >
              {s.url}
            </a>
            {(s.ai_summary || (s.ai_key_facts && s.ai_key_facts.length > 0) || (s.extracted_facts && (s.extracted_facts.summary || (s.extracted_facts.key_claims && s.extracted_facts.key_claims.length > 0)))) && (
              <div className="mt-2 pt-2 border-t border-gray-100 text-xs">
                {s.ai_summary && (
                  <p className="text-gray-600 mb-1 line-clamp-3 font-medium">{s.ai_summary}</p>
                )}
                {!s.ai_summary && s.extracted_facts?.summary && (
                  <p className="text-gray-600 mb-1 line-clamp-2">{s.extracted_facts.summary}</p>
                )}
                {s.ai_key_facts && s.ai_key_facts.length > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowKeyClaims((v) => !v)}
                      className="font-mono text-emerald-700 hover:underline"
                    >
                      {showKeyClaims ? 'Hide' : 'Key facts'} ({s.ai_key_facts.length})
                    </button>
                    {showKeyClaims && (
                      <ul className="list-disc pl-4 mt-1 text-gray-600 space-y-0.5">
                        {s.ai_key_facts.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {!(s.ai_key_facts && s.ai_key_facts.length > 0) && s.extracted_facts?.key_claims && s.extracted_facts.key_claims.length > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowKeyClaims((v) => !v)}
                      className="font-mono text-emerald-700 hover:underline"
                    >
                      {showKeyClaims ? 'Hide' : 'Key claims'} ({s.extracted_facts.key_claims.length})
                    </button>
                    {showKeyClaims && (
                      <ul className="list-disc pl-4 mt-1 text-gray-600 space-y-0.5">
                        {s.extracted_facts.key_claims.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {onSourceTierChange && (
              <>
                <button
                  type="button"
                  onClick={() => handleSetSourceTier('primary')}
                  disabled={updatingTier}
                  className={`min-w-[28px] h-7 rounded font-mono text-xs font-semibold hover:bg-gray-100 ${
                    tier === 'primary' ? 'bg-red-100 text-red-800 ring-1 ring-red-300' : 'text-gray-500'
                  }`}
                  title="Primary source"
                >
                  P
                </button>
                <button
                  type="button"
                  onClick={() => handleSetSourceTier('secondary')}
                  disabled={updatingTier}
                  className={`min-w-[28px] h-7 rounded font-mono text-xs font-semibold hover:bg-gray-100 ${
                    tier === 'secondary' ? 'bg-blue-100 text-blue-800 ring-1 ring-blue-300' : 'text-gray-500'
                  }`}
                  title="Secondary source"
                >
                  S
                </button>
              </>
            )}
            {caseId && onExtract && (
              <button
                type="button"
                onClick={async () => {
                  setExtracting(true);
                  try {
                    await onExtract(s.id);
                  } finally {
                    setExtracting(false);
                  }
                }}
                disabled={extracting}
                className="p-1 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-50"
                title="Extract key facts"
              >
                {extracting ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowNotes((v) => !v)}
              className={`p-1 rounded hover:bg-gray-100 ${showNotes || notes.length > 0 ? 'text-amber-600' : 'text-gray-400'}`}
              title="Notes"
            >
              <StickyNote className={`h-5 w-5 ${notes.length > 0 ? 'fill-amber-200' : ''}`} />
            </button>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 hover:text-emerald-700 p-1"
              title="Open"
            >
              <ExternalLink className="h-5 w-5" />
            </a>
            <button
              type="button"
              onClick={onRemove}
              className="p-1 rounded hover:bg-gray-100 text-emerald-600"
              title="Remove from saved"
            >
              <Bookmark className="h-5 w-5 fill-emerald-600" />
            </button>
          </div>
        </div>
        {onSourceMetaChange && (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-mono">
            <label className="flex items-center gap-1.5 text-gray-500" title="Mark as official source (e.g. leaked doc, court filing) for credibility">
              <input
                type="checkbox"
                checked={s.official_source === true}
                onChange={async (e) => {
                  const v = e.target.checked;
                  setUpdatingMeta(true);
                  try {
                    await onSourceMetaChange(s.id, { official_source: v });
                    await onNoteSaved();
                  } finally {
                    setUpdatingMeta(false);
                  }
                }}
                disabled={updatingMeta}
                className="rounded border-gray-300"
              />
              Official source
            </label>
            <label className="flex items-center gap-1.5 text-gray-500">
              Last contact
              <input
                type="date"
                value={(s.last_contact_at ?? '').toString().slice(0, 10)}
                onChange={async (e) => {
                  const v = e.target.value || null;
                  setUpdatingMeta(true);
                  try {
                    await onSourceMetaChange(s.id, { last_contact_at: v });
                    await onNoteSaved();
                  } finally {
                    setUpdatingMeta(false);
                  }
                }}
                disabled={updatingMeta}
                className="rounded border border-gray-200 px-1.5 py-0.5 text-gray-700"
              />
            </label>
            <label className="flex items-center gap-1.5 text-gray-500">
              Risk
              <select
                value={s.risk_level ?? ''}
                onChange={async (e) => {
                  const v = e.target.value || null;
                  setUpdatingMeta(true);
                  try {
                    await onSourceMetaChange(s.id, { risk_level: v });
                    await onNoteSaved();
                  } finally {
                    setUpdatingMeta(false);
                  }
                }}
                disabled={updatingMeta}
                className="rounded border border-gray-200 px-1.5 py-0.5 text-gray-700"
              >
                <option value="">—</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="whistleblower">Whistleblower</option>
              </select>
            </label>
          </div>
        )}
        <div className="mt-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={() => setShowLinkAttachments((v) => !v)}
            className="text-xs font-mono text-emerald-700 hover:underline flex items-center gap-1"
          >
            <Paperclip className="h-3.5 w-3.5" />
            Attachments {showLinkAttachments ? '' : `(${linkAttachments.length > 0 ? linkAttachments.length : '…'})`}
          </button>
          {showLinkAttachments && (
            <div className="mt-2 space-y-2">
              {linkAttachmentsLoading ? (
                <p className="text-xs text-gray-500 font-mono flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Loading…</p>
              ) : (
                <>
                  {linkAttachments.length === 0 && !linkAttachmentUploading && (
                    <p className="text-xs text-gray-500 font-mono">No attachments. Add a PDF or image below.</p>
                  )}
                  {linkAttachments.map((att) => (
                    <div key={att.id} className="flex items-center justify-between gap-2 text-xs font-mono bg-gray-50 rounded px-2 py-1.5">
                      <a
                        href={att.url ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-700 hover:underline truncate flex-1 min-w-0"
                      >
                        {att.file_name} ({(att.size_bytes / 1024).toFixed(1)} KB)
                      </a>
                      <button
                        type="button"
                        onClick={async () => {
                          setLinkAttachmentDeletingId(att.id);
                          try {
                            const res = await fetch(`/api/saved-links/${s.id}/attachments?id=${encodeURIComponent(att.id)}`, { method: 'DELETE' });
                            if (!res.ok) throw new Error('Delete failed');
                            setLinkAttachments((prev) => prev.filter((a) => a.id !== att.id));
                            toast.success('Attachment removed');
                          } catch {
                            toast.error('Failed to remove attachment');
                          } finally {
                            setLinkAttachmentDeletingId(null);
                          }
                        }}
                        disabled={linkAttachmentDeletingId === att.id}
                        className="p-1 rounded hover:bg-red-50 text-red-600 disabled:opacity-50"
                        title="Remove attachment"
                      >
                        {linkAttachmentDeletingId === att.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      ref={linkAttachmentInputRef}
                      type="file"
                      accept="application/pdf,image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setLinkAttachmentUploading(true);
                        try {
                          const fd = new FormData();
                          fd.append('file', file);
                          const res = await fetch(`/api/saved-links/${s.id}/attachments`, { method: 'POST', body: fd });
                          const data = await res.json().catch(() => ({}));
                          if (!res.ok) throw new Error(data?.error || 'Upload failed');
                          setLinkAttachments((prev) => [...prev, { id: data.attachment.id, file_name: data.attachment.file_name, mime_type: data.attachment.mime_type, size_bytes: data.attachment.size_bytes, url: data.attachment.url, created_at: data.attachment.created_at }]);
                          toast.success('Attachment added');
                          if (linkAttachmentInputRef.current) linkAttachmentInputRef.current.value = '';
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Upload failed');
                        } finally {
                          setLinkAttachmentUploading(false);
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="font-mono text-xs border-emerald-200 text-emerald-700"
                      disabled={linkAttachmentUploading}
                      onClick={() => linkAttachmentInputRef.current?.click()}
                    >
                      {linkAttachmentUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                      Add PDF or image
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        {showNotes && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <label className="text-xs font-mono text-gray-500 uppercase block mb-1">Notes (e.g. URLs or text from this link)</label>
            <Textarea
              value={newNoteContent}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNewNoteContent(e.target.value)}
              placeholder="Paste URLs or notes…"
              className="min-h-[72px] text-sm font-mono resize-y mb-2"
            />
            <div className="flex justify-end mb-3">
              <Button
                type="button"
                size="sm"
                onClick={handleAddNote}
                disabled={saving || !newNoteContent.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'ADD.NOTE'}
              </Button>
            </div>
            {notes.length > 0 ? (
              <div className="space-y-2">
                {notes.map((n, index) => (
                  <Card key={n.id} className="bg-white border-emerald-200">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-emerald-700 font-mono font-semibold mb-1">NOTE {index + 1}</p>
                          <span className="text-sm text-gray-900 whitespace-pre-wrap break-words block">{linkifyText(n.content)}</span>
                          <p className="text-xs text-gray-500 font-mono mt-2">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true }).toUpperCase()}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(n.id)}
                          disabled={deletingId === n.id}
                          className="p-1 rounded hover:bg-gray-100 text-red-600 disabled:opacity-50"
                          title="Delete note"
                        >
                          {deletingId === n.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 font-mono">NO.NOTES.YET</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Detect if a string is a URL (for linkify parts; avoids global-regex state). */
const isUrlPart = (s: string) => /^https?:\/\//.test(s);

const linkifyText = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, index) => {
    if (isUrlPart(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-600 hover:text-emerald-700 underline cursor-pointer"
        >
          {part}
        </a>
      );
    }
    return <span key={index}>{part}</span>;
  });
};


export function ResultsTabs({ queryId, queryStatus, rawInput, caseId }: ResultsTabsProps) {
  const [results, setResults] = useState<Result[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteContent, setNoteContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [showDateJump, setShowDateJump] = useState(false);
  const [jumpDate, setJumpDate] = useState('');
  const [closestCapture, setClosestCapture] = useState<Result | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [savedLinks, setSavedLinks] = useState<SavedLinkRow[]>([]);
  const [attachments, setAttachments] = useState<NoteAttachment[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [manualTitle, setManualTitle] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [manualSnippet, setManualSnippet] = useState('');
  const [manualFile, setManualFile] = useState<File | null>(null);
  const manualFileInputRef = useRef<HTMLInputElement | null>(null);
  const [manualSaving, setManualSaving] = useState(false);

  const fetchSaved = useCallback(async () => {
    try {
      const res = await fetch('/api/saved');
      const text = await res.text();
      if (res.ok) {
        try {
          const data = text ? JSON.parse(text) : {};
          setSavedLinks(data.saved || []);
        } catch {
          setSavedLinks([]);
        }
      }
    } catch {
      setSavedLinks([]);
    }
  }, []);

  // Fetch saved links on mount and when selected query changes so bookmark state is scoped per query.
  useEffect(() => {
    fetchSaved();
  }, [queryId, fetchSaved]);

  // Saved tab and badge: current-query items plus archive items for current case (query_id null, case_id match or legacy null).
  const scopedSavedLinks = useMemo(
    () =>
      savedLinks.filter(
        (s) =>
          (s.query_id != null && s.query_id === queryId) ||
          (s.query_id === null && (s.case_id === caseId || s.case_id == null))
      ),
    [savedLinks, queryId, caseId]
  );

  // Bookmark state is scoped to the CURRENT query only. Legacy rows with query_id null never show in timeline.
  const isSaved = useCallback(
    (url: string, source: 'archive' | 'query' | 'official') =>
      savedLinks.some(
        (s) =>
          s.url === url &&
          s.source === source &&
          s.query_id != null &&
          s.query_id === queryId
      ),
    [savedLinks, queryId]
  );

  const toggleSaved = useCallback(
    async (payload: { source: 'archive' | 'query' | 'official'; url: string; title?: string; snippet?: string; captured_at?: string | null }) => {
      const { source, url, title, snippet, captured_at } = payload;
      const saved = isSaved(url, source);
      try {
        if (saved) {
          const params = new URLSearchParams({ url, source, query_id: queryId });
          const res = await fetch(`/api/saved?${params.toString()}`, { method: 'DELETE' });
          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            if (process.env.NODE_ENV === 'development') console.error('[ResultsTabs] save DELETE failed', res.status, errBody);
            throw new Error('Failed to remove');
          }
          toast.success('Removed from saved');
        } else {
          const res = await fetch('/api/saved', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              source,
              url,
              title: title ?? null,
              snippet: snippet ?? null,
              captured_at: captured_at ?? null,
              query_id: queryId,
              case_id: caseId ?? null,
            }),
          });
          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            if (process.env.NODE_ENV === 'development') console.error('[ResultsTabs] save POST failed', res.status, errBody);
            throw new Error('Failed to save');
          }
          toast.success('Saved');
          // Refetch after a few seconds so auto-extracted key facts appear without leaving the tab
          setTimeout(() => fetchSaved(), 5000);
        }
        await fetchSaved();
      } catch (e) {
        if (process.env.NODE_ENV === 'development' && e instanceof Error) console.error('[ResultsTabs] save error', e.message);
        toast.error(saved ? 'Failed to remove' : 'Failed to save');
      }
    },
    [isSaved, fetchSaved, queryId, caseId]
  );

  // Archive bookmarks: only show as saved for current query + case (no bleed to other queries).
  const isArchiveSaved = useCallback(
    (url: string) =>
      savedLinks.some(
        (s) =>
          s.url === url &&
          s.source === 'archive' &&
          (s.query_id === queryId || s.query_id == null) &&
          (s.case_id === caseId || s.case_id == null)
      ),
    [savedLinks, queryId, caseId]
  );

  const toggleArchiveSave = useCallback(
    async (url: string, title?: string) => {
      const saved = isArchiveSaved(url);
      try {
        if (saved) {
          const params = new URLSearchParams({ url, source: 'archive' });
          if (caseId) params.set('case_id', caseId);
          const res = await fetch(`/api/saved?${params.toString()}`, { method: 'DELETE' });
          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            if (process.env.NODE_ENV === 'development') console.error('[ResultsTabs] archive DELETE failed', res.status, errBody);
            throw new Error('Failed to remove');
          }
          toast.success('Removed from saved');
        } else {
          const res = await fetch('/api/saved', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              source: 'archive',
              url,
              title: title ?? null,
              query_id: queryId,
              case_id: caseId ?? null,
            }),
          });
          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            if (process.env.NODE_ENV === 'development') console.error('[ResultsTabs] archive POST failed', res.status, errBody);
            throw new Error('Failed to save');
          }
          toast.success('Saved');
          setTimeout(() => fetchSaved(), 5000);
        }
        await fetchSaved();
      } catch (e) {
        if (process.env.NODE_ENV === 'development' && e instanceof Error) console.error('[ResultsTabs] archive save error', e.message);
        toast.error(saved ? 'Failed to remove' : 'Failed to save');
      }
    },
    [isArchiveSaved, fetchSaved, caseId, queryId]
  );

  const toggleGroup = (cat: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const fetchResults = useCallback(async () => {
    try {
      const url = `/api/results?queryId=${queryId}`;
      if (process.env.NODE_ENV === 'development') console.log('[ResultsTabs] fetch URL:', url);
      const response = await fetch(url);
      const text = await response.text();
      let data: { results?: Result[] } | null = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        if (!response.ok) data = null;
      }
      if (process.env.NODE_ENV === 'development') console.log('[ResultsTabs] raw API response:', data);
      const resultsList: Result[] = (response.ok && data && Array.isArray(data.results)) ? data.results : [];
      setResults(resultsList);
    } catch (error) {
      console.error('Failed to fetch results:', error);
    } finally {
      setLoading(false);
    }
  }, [queryId]);

  const fetchAttachments = useCallback(async () => {
    try {
      const response = await fetch(`/api/attachments?queryId=${encodeURIComponent(queryId)}`);
      if (!response.ok) {
        setAttachments([]);
        return;
      }
      const text = await response.text();
      try {
        const data = text ? JSON.parse(text) : {};
        setAttachments(data.attachments || []);
      } catch {
        setAttachments([]);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[ResultsTabs] attachments fetch error', error);
      }
      setAttachments([]);
    }
  }, [queryId]);

  const fetchNotes = useCallback(async () => {
    try {
      const response = await fetch(`/api/notes?queryId=${queryId}`);
      const text = await response.text();
      if (response.ok) {
        try {
          const data = text ? JSON.parse(text) : {};
          setNotes(data.notes || []);
        } catch {
          setNotes([]);
        }
      } else {
        setNotes([]);
      }
    } catch (error) {
      console.error('Failed to fetch notes:', error);
      setNotes([]);
    }
  }, [queryId]);

  useEffect(() => {
    setNotes([]);
    setNoteContent('');
    setAttachments([]);
    fetchResults();
    fetchNotes();
    fetchAttachments();

    if (queryStatus === 'running') {
      const interval = setInterval(fetchResults, 2000);
      return () => clearInterval(interval);
    }
  }, [queryId, queryStatus, fetchResults, fetchNotes, fetchAttachments]);

  const handleSaveNote = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queryId, content: noteContent }),
      });

      if (!response.ok) throw new Error('Failed to save note');
      setNoteContent('');
      await fetchNotes();
      toast.success('Note saved successfully');
    } catch (error) {
      toast.error('Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const response = await fetch(`/api/notes?id=${encodeURIComponent(noteId)}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete note');
      await fetchNotes();
      toast.success('Note deleted');
    } catch (error) {
      toast.error('Failed to delete note');
    }
  };

  const handleUploadAttachment = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.append('queryId', queryId);
      formData.append('file', file);

      const response = await fetch('/api/attachments', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        if (process.env.NODE_ENV === 'development') {
          console.error('[ResultsTabs] attachment upload failed', response.status, errBody);
        }
        throw new Error('Failed to upload file');
      }

      toast.success('File added');
      await fetchAttachments();
    } catch (error) {
      toast.error('Failed to add file');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUploadingAttachment(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    setDeletingAttachmentId(attachmentId);
    try {
      const response = await fetch(`/api/attachments?id=${encodeURIComponent(attachmentId)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        if (process.env.NODE_ENV === 'development') {
          console.error('[ResultsTabs] attachment delete failed', response.status, errBody);
        }
        throw new Error('Failed to delete file');
      }

      toast.success('File deleted');
      await fetchAttachments();
    } catch (error) {
      toast.error('Failed to delete file');
    } finally {
      setDeletingAttachmentId(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const archiveResults = results.filter((r) => r.source === 'wayback');
  const searchResultsFromApi = results.filter((r) => r.source === 'search');
  // Manual entries are saved_links with placeholder url; they appear in the Saved tab with full buttons.
  const manualEntryCount = useMemo(
    () => scopedSavedLinks.filter((s) => typeof s.url === 'string' && s.url.startsWith('#manual-')).length,
    [scopedSavedLinks]
  );
  const discoveryQueries: QueryWithCategory[] =
    rawInput && rawInput.trim()
      ? generateMockSearchQueries(rawInput.trim(), detectInputType(rawInput))
      : [];
  const isUrlInput = rawInput && isValidUrl(rawInput);
  const canonicalUrl = isUrlInput ? canonicalizeUrl(rawInput) : null;

  const availableYears = Array.from(
    new Set(
      archiveResults
        .filter(r => r.captured_at)
        .map(r => new Date(r.captured_at!).getFullYear())
    )
  ).sort((a, b) => b - a);

  const filteredArchiveResults = selectedYear
    ? archiveResults.filter(r =>
        r.captured_at && new Date(r.captured_at).getFullYear() === selectedYear
      )
    : archiveResults;

  const handleCopyAllLinks = () => {
    const links = filteredArchiveResults
      .filter(r => r.url)
      .map(r => r.url)
      .join('\n');

    navigator.clipboard.writeText(links);
    toast.success(
      selectedYear
        ? `${filteredArchiveResults.length} ${selectedYear} capture links copied`
        : 'All capture links copied to clipboard'
    );
  };

  const handleYearClick = (year: number) => {
    setSelectedYear(selectedYear === year ? null : year);
    setClosestCapture(null);
  };

  const handleDateJump = () => {
    if (!jumpDate || archiveResults.length === 0) return;

    try {
      const targetDate = new Date(jumpDate);
      if (isNaN(targetDate.getTime())) {
        toast.error('Invalid date format. Use YYYY-MM-DD');
        return;
      }

      const capturesWithDates = archiveResults
        .filter(r => r.captured_at)
        .map(r => ({
          result: r,
          date: new Date(r.captured_at!)
        }))
        .filter(c => c.date <= targetDate)
        .sort((a, b) => b.date.getTime() - a.date.getTime());

      if (capturesWithDates.length > 0) {
        const closest = capturesWithDates[0].result;
        setClosestCapture(closest);
        setSelectedYear(null);

        setTimeout(() => {
          const element = document.getElementById(`capture-${closest.id}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      } else {
        toast.error('No capture available near this date');
        setClosestCapture(null);
      }
    } catch (error) {
      toast.error('Invalid date format. Use YYYY-MM-DD');
    }
  };

  if (loading && queryStatus === 'running') {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-emerald-700 font-mono text-sm">PROCESSING.QUERY...</p>
        </div>
      </div>
    );
  }

  return (
    <Tabs defaultValue="archive" className="w-full min-w-0">
      <TabsList className="w-full h-auto flex flex-wrap justify-start gap-1 bg-gray-100 border-emerald-200 font-mono p-1">
        <TabsTrigger value="archive" className="h-8 px-2 text-[11px] sm:text-sm sm:h-9 sm:px-3 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">
          <Clock className="hidden sm:inline h-4 w-4 mr-2" />
          ARCHIVE ({archiveResults.length})
        </TabsTrigger>
        <TabsTrigger value="queries" className="h-8 px-2 text-[11px] sm:text-sm sm:h-9 sm:px-3 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">
          <Search className="hidden sm:inline h-4 w-4 mr-2" />
          QUERIES ({discoveryQueries.length})
        </TabsTrigger>
        <TabsTrigger value="notes" className="h-8 px-2 text-[11px] sm:text-sm sm:h-9 sm:px-3 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">
          <FileText className="hidden sm:inline h-4 w-4 mr-2" />
          NOTES ({notes.length})
        </TabsTrigger>
        <TabsTrigger value="official" className="h-8 px-2 text-[11px] sm:text-sm sm:h-9 sm:px-3 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">
          <Building2 className="hidden sm:inline h-4 w-4 mr-2" />
          OFFICIAL SOURCES
        </TabsTrigger>
        <TabsTrigger value="saved" className="h-8 px-2 text-[11px] sm:text-sm sm:h-9 sm:px-3 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">
          <Bookmark className="hidden sm:inline h-4 w-4 mr-2" />
          SAVED ({scopedSavedLinks.length})
        </TabsTrigger>
        <TabsTrigger value="manual" className="h-8 px-2 text-[11px] sm:text-sm sm:h-9 sm:px-3 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">
          <PenLine className="hidden sm:inline h-4 w-4 mr-2" />
          MANUAL ENTRY ({manualEntryCount})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="archive" className="space-y-3 mt-4">
        <ArchiveLookup
          activeTopic={queryId}
          isArchiveSaved={isArchiveSaved}
          onToggleArchiveSave={toggleArchiveSave}
        />
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-700" />
          <AlertTitle className="text-blue-900 font-mono font-bold text-sm">HOW THE WAYBACK MACHINE WORKS</AlertTitle>
          <AlertDescription className="text-blue-900 text-xs space-y-2 mt-2">
            <p className="font-semibold">The Wayback Machine does NOT search by topic, name, or keywords.</p>
            <p>It only checks whether a SPECIFIC URL was saved in the past.</p>

            <div className="mt-3 space-y-1">
              <p className="font-semibold">What works best:</p>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                <li>Full URLs (https://example.com/page)</li>
                <li>Homepages (https://example.com)</li>
                <li>Press / News pages (/press, /news, /media)</li>
                <li>Specific articles or documents</li>
              </ul>
            </div>

            <div className="mt-3 space-y-1">
              <p className="font-semibold">What will NOT work:</p>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                <li>Names of people</li>
                <li>Company names by themselves</li>
                <li>Topics or phrases</li>
                <li>Questions or sentences</li>
              </ul>
            </div>

            <p className="mt-3 italic">
              <strong>Tip:</strong> Use Official Sources or Third-Party Search to FIND relevant URLs first. Then paste those URLs here to check if they were archived.
            </p>
          </AlertDescription>
        </Alert>

        {canonicalUrl && (
          <Card className="bg-emerald-50 border-emerald-200 shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-xs text-emerald-700 font-mono font-semibold mb-1">NORMALIZED URL:</p>
                  <p className="text-sm text-gray-700 font-mono break-all">{canonicalUrl}</p>
                </div>
                {archiveResults.length > 0 && (
                  <Button
                    onClick={handleCopyAllLinks}
                    size="sm"
                    variant="outline"
                    className="flex-shrink-0 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    COPY ALL
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {archiveResults.length > 0 && availableYears.length > 0 && (
          <Card className="bg-white border-emerald-200 shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div>
                <p className="text-xs text-gray-600 font-mono font-semibold mb-2">FILTER BY YEAR:</p>
                <div className="flex flex-wrap gap-2">
                  {availableYears.map((year) => (
                    <button
                      key={year}
                      onClick={() => handleYearClick(year)}
                      className={`px-3 py-1 rounded font-mono text-sm transition-all ${
                        selectedYear === year
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                      }`}
                    >
                      {year}
                    </button>
                  ))}
                  {selectedYear && (
                    <button
                      onClick={() => setSelectedYear(null)}
                      className="px-3 py-1 rounded font-mono text-sm bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-300"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-200 pt-3">
                <button
                  onClick={() => setShowDateJump(!showDateJump)}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-mono font-semibold flex items-center gap-1"
                >
                  {showDateJump ? '▼' : '▶'} PINPOINT A DATE
                </button>

                {showDateJump && (
                  <div className="mt-3 space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="YYYY-MM-DD (e.g., 2006-01-24)"
                        value={jumpDate}
                        onChange={(e) => setJumpDate(e.target.value)}
                        className="flex-1 px-3 py-2 text-sm font-mono border border-emerald-200 rounded focus:outline-none focus:border-emerald-500"
                      />
                      <Button
                        onClick={handleDateJump}
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono"
                      >
                        JUMP
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 italic">
                      Wayback only saves pages on certain days. If a date has no capture, try the closest earlier version.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {filteredArchiveResults.length === 0 && archiveResults.length > 0 ? (
          <Card className="bg-white border-emerald-200 shadow-sm">
            <CardContent className="text-center py-8">
              <p className="text-emerald-600/50 font-mono text-sm">NO CAPTURES FOR {selectedYear}</p>
              <p className="text-gray-600 text-sm mt-2">Try a different year or clear the filter.</p>
            </CardContent>
          </Card>
        ) : archiveResults.length === 0 ? (
          <>
            <Card className="bg-white border-emerald-200 shadow-sm">
              <CardContent className="text-center py-8">
                {!isUrlInput ? (
                  <div className="space-y-2">
                    <p className="text-emerald-600/50 font-mono text-sm">ARCHIVE.LOOKUP.REQUIRES.FULL.URL</p>
                    <p className="text-gray-600 text-sm">Archive lookup requires a full URL (including https://)</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-emerald-600/50 font-mono text-sm">NO.WAYBACK.CAPTURES.FOUND</p>
                    <p className="text-gray-600 text-sm">No archived copies were found for this exact URL.</p>
                    <p className="text-gray-600 text-sm">This does NOT mean the content never existed.</p>
                    <p className="text-gray-600 text-sm">Try a homepage, press page, or a related article URL.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {rawInput && (
              <Card className="bg-amber-50 border-amber-200 shadow-sm">
                <CardContent className="p-4">
                  <h3 className="text-amber-900 font-mono font-bold text-sm mb-3 flex items-center gap-2">
                    <LinkIcon className="h-4 w-4" />
                    SUGGESTIONS TO FIND ARCHIVED PAGES
                  </h3>

                  <div className="space-y-3">
                    <p className="text-amber-900 text-xs leading-relaxed">
                      Pages like press releases, news, and reports are archived more often than regular pages because they are frequently linked by journalists, government reports, and documents.
                    </p>

                    <div>
                      <p className="text-amber-900 text-xs font-semibold mb-2">
                        Archive-friendly page paths to try:
                      </p>
                      <div className="bg-white/50 rounded p-3 font-mono text-xs text-amber-900 space-y-1">
                        <div>/news</div>
                        <div>/press</div>
                        <div>/press-releases</div>
                        <div>/media</div>
                        <div>/blog</div>
                        <div>/about</div>
                        <div>/about-us</div>
                        <div>/reports</div>
                        <div>/investigations</div>
                        <div>/statements</div>
                        <div>/publications</div>
                        <div>/documents</div>
                        <div>/archive</div>
                      </div>
                    </div>

                    <div>
                      <p className="text-amber-900 text-xs font-semibold mb-2">
                        Examples:
                      </p>
                      <div className="bg-white/50 rounded p-3 font-mono text-xs text-amber-900 space-y-1">
                        <div>https://example.com/press</div>
                        <div>https://example.org/reports</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          filteredArchiveResults.map((result) => {
            const isHighlighted = closestCapture?.id === result.id;
            return (
              <Card
                key={result.id}
                id={`capture-${result.id}`}
                className={`transition-all ${
                  isHighlighted
                    ? 'bg-yellow-50 border-yellow-400 border-2 shadow-lg'
                    : 'bg-white border-emerald-200 hover:border-emerald-300 hover:shadow-md'
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-gray-900 font-medium font-mono text-sm">{result.title}</h3>
                        {result.confidence === 1.0 && (
                          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 text-xs border border-emerald-200 font-mono">
                            CLOSEST
                          </Badge>
                        )}
                        {isHighlighted && (
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-xs border border-yellow-400 font-mono">
                            PINPOINTED
                          </Badge>
                        )}
                      </div>
                      {result.captured_at && (
                        <p className="text-xs text-gray-500 mb-2 font-mono">
                          Captured {formatDistanceToNow(new Date(result.captured_at), { addSuffix: true })}
                        </p>
                      )}
                      {result.url && (
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-emerald-600 hover:text-emerald-700 underline break-all font-mono block mb-2"
                        >
                          {result.url}
                        </a>
                      )}
                      {result.snippet && (
                        <p className="text-sm text-gray-700">{linkifyText(result.snippet)}</p>
                      )}
                    </div>
                    {result.url && (
                      <div className="flex flex-col gap-2 flex-shrink-0 items-center">
                        <div className="flex items-center gap-1">
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-600 hover:text-emerald-700"
                            title="Open in new tab"
                          >
                            <ExternalLink className="h-5 w-5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => toggleSaved({ source: 'archive', url: result.url!, title: result.title ?? undefined, snippet: result.snippet ?? undefined, captured_at: result.captured_at })}
                            className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-emerald-600"
                            title={isSaved(result.url, 'archive') ? 'Remove from saved' : 'Save link'}
                          >
                            <Bookmark
                              className={`h-5 w-5 ${isSaved(result.url, 'archive') ? 'fill-emerald-600 text-emerald-600' : ''}`}
                            />
                          </button>
                        </div>
                        {isHighlighted && (
                          <Button
                            size="sm"
                            asChild
                            className="bg-yellow-600 hover:bg-yellow-700 text-white font-mono text-xs px-2 py-1 h-auto"
                          >
                            <a
                              href={result.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              OPEN
                            </a>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </TabsContent>

      <TabsContent value="queries" className="space-y-3 mt-4">
        {discoveryQueries.length === 0 ? (
          <Card className="bg-white border-emerald-200 shadow-sm">
            <CardContent className="text-center py-12 text-emerald-600/50 font-mono text-sm">
              NO.SEARCH.QUERIES
            </CardContent>
          </Card>
        ) : (
          <>
            <Alert className="bg-blue-50 border-blue-200">
              <Info className="h-4 w-4 text-blue-700" />
              <AlertTitle className="text-blue-900 font-mono font-bold text-sm">DISCOVERY QUERIES</AlertTitle>
              <AlertDescription className="text-blue-900 text-xs space-y-1 mt-2">
                <p className="font-semibold">These queries are designed to maximize the chance of finding surviving traces of deleted or altered content across the web.</p>
                <p className="mt-2">Each query targets specific patterns of how information persists over time: structural pages that are frequently archived, documents that outlive web pages, third-party citations, time-anchored content, and government/oversight records.</p>
              </AlertDescription>
            </Alert>

            <div className="space-y-6 pt-2">
              {(() => {
                const grouped = groupQueries(discoveryQueries);
                return CATEGORY_ORDER.map((cat) => {
                  const items = grouped[cat];
                if (!items || items.length === 0) return null;

                const isExpanded = expandedGroups.has(cat);
                const itemsToShow = items.length > 4 && !isExpanded ? items.slice(0, 4) : items;
                const showToggle = items.length > 4;

                return (
                  <div key={cat} className="space-y-2">
                    <h3 className="text-emerald-700 font-mono font-bold text-xs uppercase tracking-wide sticky top-0 bg-white/95 py-1">
                      {CATEGORY_LABELS[cat]}
                    </h3>
                    <div className="space-y-2">
                      {itemsToShow.map((result, idx) => {
                        const snippetForGoogle = result.snippet ? sanitizeSnippetForGoogle(result.snippet) : '';
                        const snippetToSave = (snippetForGoogle || result.snippet) ?? undefined;
                        const googleSearchUrl = snippetForGoogle
                          ? `https://www.google.com/search?q=${encodeURIComponent(snippetForGoogle)}`
                          : null;

                        const handleCopyQuery = () => {
                          if (snippetForGoogle) {
                            navigator.clipboard.writeText(snippetForGoogle);
                            toast.success('Query copied to clipboard');
                          }
                        };

                        return (
                          <Card key={`discovery-${cat}-${idx}-${result.title}`} className="bg-white border-emerald-200 hover:border-emerald-300 hover:shadow-md transition-all">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h3 className="text-gray-900 font-medium font-mono text-sm">{result.title}</h3>
                                    <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 text-xs border border-emerald-200 font-mono">
                                      {(result.confidence * 100).toFixed(0)}% SIGNAL
                                    </Badge>
                                  </div>
                                  {result.snippet && (
                                    <div className="relative group">
                                      <code className="block text-sm text-emerald-700 bg-gray-50 p-3 rounded mt-2 font-mono border border-emerald-200 cursor-pointer select-all"
                                        onClick={handleCopyQuery}
                                        title="Click to copy"
                                      >
                                        {snippetForGoogle || result.snippet}
                                      </code>
                                      <Button
                                        onClick={handleCopyQuery}
                                        size="sm"
                                        variant="ghost"
                                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0"
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                {googleSearchUrl && (
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <a
                                      href={googleSearchUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-emerald-600 hover:text-emerald-700"
                                      title="Search on Google"
                                    >
                                      <ExternalLink className="h-5 w-5" />
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => toggleSaved({ source: 'query', url: googleSearchUrl, title: result.title ?? undefined, snippet: snippetToSave })}
                                      className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-emerald-600"
                                      title={isSaved(googleSearchUrl, 'query') ? 'Remove from saved' : 'Save link'}
                                    >
                                      <Bookmark
                                        className={`h-5 w-5 ${isSaved(googleSearchUrl, 'query') ? 'fill-emerald-600 text-emerald-600' : ''}`}
                                      />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                    {showToggle && (
                      <button
                        type="button"
                        onClick={() => toggleGroup(cat)}
                        className="text-emerald-600 hover:text-emerald-700 text-xs font-mono mt-1"
                      >
                        {isExpanded ? 'Show less' : `Show ${items.length - 4} more`}
                      </button>
                    )}
                  </div>
                );
              });
              })()}
            </div>

            {(() => {
              const insights = getObservedEmailInsights(results);
              if (insights.length === 0) return null;

              return (
                <Card className="bg-white border-emerald-200 shadow-sm mt-4">
                  <CardContent className="p-4 space-y-4">
                    <h3 className="text-emerald-700 font-mono font-bold text-xs uppercase tracking-wide">
                      Observed Email Patterns
                    </h3>
                    {insights.map((insight) => (
                      <div key={insight.domain} className="space-y-2 text-sm font-mono border-b border-emerald-100 pb-3 last:border-0 last:pb-0">
                        <p className="font-semibold text-gray-800">{insight.domain}</p>
                        {insight.roleEmails.length > 0 && (
                          <p className="text-xs text-gray-600">
                            Role emails found: {insight.roleEmails.slice(0, 5).join(', ')}
                          </p>
                        )}
                        {insight.namePatternSignals.length > 0 && (
                          <p className="text-xs text-gray-600">
                            Name pattern signals:{' '}
                            {insight.namePatternSignals
                              .map((s) => `${s.pattern} (${s.confidence}, ${s.count})`)
                              .join('; ')}
                          </p>
                        )}
                        <p className="text-xs text-gray-500">
                          Examples: {insight.examples.slice(0, 3).join(', ')}
                        </p>
                      </div>
                    ))}
                    <p className="text-xs text-gray-500 pt-2 border-t border-emerald-100">
                      Patterns are inferred from publicly published emails found in results.
                    </p>
                  </CardContent>
                </Card>
              );
            })()}
          </>
        )}
      </TabsContent>

      <TabsContent value="notes" className="mt-4">
        <Card className="bg-white border-emerald-200 shadow-sm">
          <CardContent className="p-4 space-y-4">
            <Textarea
              placeholder="Write a new note..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              className="min-h-[120px] bg-white border-emerald-200 text-gray-900 placeholder:text-gray-400 font-mono focus:border-emerald-500"
            />
            <div className="flex items-center justify-between gap-2 border border-emerald-200 rounded-md p-3 bg-emerald-50/40">
              <div className="flex items-center gap-2 text-xs text-emerald-800 font-mono">
                <Paperclip className="h-4 w-4" />
                PDF and image attachments for this query
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  onChange={handleUploadAttachment}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={uploadingAttachment}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-100 font-mono"
                >
                  {uploadingAttachment ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      UPLOADING...
                    </>
                  ) : (
                    <>
                      <Upload className="h-3 w-3 mr-1" />
                      ADD FILE
                    </>
                  )}
                </Button>
              </div>
            </div>

            {attachments.length > 0 && (
              <div className="space-y-2">
                {attachments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 border border-emerald-200 rounded-md p-3">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-900 font-mono truncate">{a.file_name}</p>
                      <p className="text-xs text-gray-500 font-mono">
                        {a.mime_type} - {formatBytes(a.size_bytes)} - {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {a.url && (
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-600 hover:text-emerald-700 p-1"
                          title="Open file"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteAttachment(a.id)}
                        disabled={deletingAttachmentId === a.id}
                        className="p-1 rounded hover:bg-gray-100 text-red-600 disabled:opacity-50"
                        title="Delete file"
                      >
                        {deletingAttachmentId === a.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end items-center">
              <Button
                onClick={handleSaveNote}
                disabled={saving || noteContent.trim().length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white ml-auto font-mono"
              >
                {saving ? 'SAVING...' : 'ADD.NOTE'}
              </Button>
            </div>

            {notes.length > 0 ? (
              <div className="space-y-2 pt-1">
                {notes.map((n, index) => (
                  <Card key={n.id} className="bg-white border-emerald-200">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-emerald-700 font-mono font-semibold mb-1">
                            NOTE {index + 1}
                          </p>
                          <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                            {n.content}
                          </p>
                          <p className="text-xs text-gray-500 font-mono mt-2">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true }).toUpperCase()}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(n.id)}
                          className="p-1 rounded hover:bg-gray-100 text-red-600"
                          title="Delete note"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 font-mono">NO.NOTES.YET</p>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="official" className="mt-4">
        <OfficialSources
          rawInput={rawInput || ''}
          onSaveLink={(payload) => toggleSaved({ ...payload, source: 'official' })}
          isSaved={(url) => isSaved(url, 'official')}
        />
      </TabsContent>

      <TabsContent value="saved" className="space-y-3 mt-4">
        {scopedSavedLinks.length === 0 ? (
          <Card className="bg-white border-emerald-200 shadow-sm">
            <CardContent className="text-center py-12">
              <p className="text-emerald-600/50 font-mono text-sm">NO.SAVED.LINKS</p>
              <p className="text-gray-500 text-xs mt-2">Use the bookmark icon on Archive, Queries, or Official Sources to save links here.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {scopedSavedLinks.map((s) => (
              <SavedLinkCard
                key={s.id}
                saved={s}
                onRemove={async () => {
                  try {
                    const res = await fetch(`/api/saved?id=${encodeURIComponent(s.id)}`, { method: 'DELETE' });
                    if (!res.ok) {
                      const errBody = await res.json().catch(() => ({}));
                      if (process.env.NODE_ENV === 'development') console.error('[ResultsTabs] saved item DELETE failed', res.status, errBody);
                      throw new Error('Failed to remove');
                    }
                    toast.success('Removed from saved');
                    await fetchSaved();
                  } catch (e) {
                    if (process.env.NODE_ENV === 'development' && e instanceof Error) console.error('[ResultsTabs] saved item delete error', e.message);
                    toast.error('Failed to remove');
                  }
                }}
                onNoteSaved={fetchSaved}
                onSourceTierChange={async (savedLinkId, source_tier) => {
                  try {
                    const res = await fetch('/api/saved', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ id: savedLinkId, source_tier }),
                    });
                    if (!res.ok) {
                      const errBody = await res.json().catch(() => ({}));
                      if (process.env.NODE_ENV === 'development') console.error('[ResultsTabs] PATCH source_tier failed', res.status, errBody);
                      throw new Error((errBody && typeof errBody.error === 'string') ? errBody.error : 'Failed to update');
                    }
                    toast.success(source_tier ? `Marked as ${source_tier} source` : 'Source tier cleared');
                    await fetchSaved();
                  } catch (e) {
                    if (process.env.NODE_ENV === 'development' && e instanceof Error) console.error('[ResultsTabs] source_tier error', e.message);
                    toast.error(e instanceof Error ? e.message : 'Failed to update');
                  }
                }}
                onSourceMetaChange={async (savedLinkId, patch) => {
                  try {
                    const res = await fetch('/api/saved', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ id: savedLinkId, ...patch }),
                    });
                    if (!res.ok) {
                      const errBody = await res.json().catch(() => ({}));
                      if (process.env.NODE_ENV === 'development') console.error('[ResultsTabs] PATCH source meta failed', res.status, errBody);
                      throw new Error((errBody && typeof errBody.error === 'string') ? errBody.error : 'Failed to update');
                    }
                    await fetchSaved();
                  } catch (e) {
                    if (process.env.NODE_ENV === 'development' && e instanceof Error) console.error('[ResultsTabs] source meta error', e.message);
                    toast.error(e instanceof Error ? e.message : 'Failed to update');
                  }
                }}
                caseId={caseId}
                onExtract={
                  caseId
                    ? async (savedLinkId) => {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 50_000);
                        try {
                          const res = await fetch(`/api/cases/${caseId}/saved-links/${savedLinkId}/extract`, {
                            method: 'POST',
                            signal: controller.signal,
                          });
                          clearTimeout(timeoutId);
                          const data = await res.json().catch(() => ({}));
                          if (data.ok) {
                            let analyzeOk = false;
                            let analyzeError: string | null = null;
                            try {
                              const ac = new AbortController();
                              const at = setTimeout(() => ac.abort(), 35_000);
                              const aRes = await fetch(`/api/cases/${caseId}/saved-links/${savedLinkId}/analyze`, {
                                method: 'POST',
                                signal: ac.signal,
                              });
                              clearTimeout(at);
                              const aData = await aRes.json().catch(() => ({}));
                              if (aRes.ok && aData.ok) {
                                analyzeOk = true;
                              } else if (!aRes.ok && typeof aData?.error === 'string') {
                                analyzeError = aData.error;
                              }
                            } catch {
                              // fall back to extract-only success
                            }
                            await fetchSaved();
                            if (analyzeOk) {
                              toast.success('Summary and key facts updated');
                            } else if (analyzeError) {
                              toast.error(analyzeError);
                            } else {
                              toast.success('Key facts extracted');
                            }
                          } else {
                            toast.error(data.error ?? 'Extraction failed');
                          }
                        } catch (e) {
                          clearTimeout(timeoutId);
                          if (e instanceof Error && e.name === 'AbortError') {
                            toast.error('Request timed out. The site may be slow or rate-limiting. Try again later.');
                          } else {
                            if (process.env.NODE_ENV === 'development' && e instanceof Error) console.error('[ResultsTabs] extract error', e.message);
                            toast.error('Extraction failed');
                          }
                        }
                      }
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="manual" className="space-y-3 mt-4">
        <Card className="bg-white border-emerald-200 shadow-sm">
          <CardContent className="p-4 space-y-4">
            <p className="text-emerald-700 font-mono text-sm font-semibold">Add an entry to this query</p>
            <p className="text-gray-600 text-xs font-mono">
              Add an entry to this query. It will appear in the Saved tab with the same buttons (notes, source tier, extract, remove).
            </p>
            <div className="space-y-2">
              <Label htmlFor="manual-entry-title" className="text-emerald-700 font-mono text-sm">Title</Label>
              <Input
                id="manual-entry-title"
                placeholder="Short title for this entry"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                className="border-emerald-200 font-mono"
                disabled={manualSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-entry-url" className="text-emerald-700 font-mono text-sm">URL (optional)</Label>
              <Input
                id="manual-entry-url"
                placeholder="https://..."
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                className="border-emerald-200 font-mono"
                disabled={manualSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-entry-snippet" className="text-emerald-700 font-mono text-sm">Snippet / notes (optional)</Label>
              <Textarea
                id="manual-entry-snippet"
                placeholder="Summary or quote"
                value={manualSnippet}
                onChange={(e) => setManualSnippet(e.target.value)}
                className="border-emerald-200 font-mono min-h-[80px]"
                disabled={manualSaving}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-emerald-700 font-mono text-sm">Attach PDF or image (optional)</Label>
              <input
                ref={manualFileInputRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => setManualFile(e.target.files?.[0] ?? null)}
              />
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="font-mono border-emerald-200 text-emerald-700"
                  disabled={manualSaving}
                  onClick={() => manualFileInputRef.current?.click()}
                >
                  {manualFile ? manualFile.name : 'Choose file'}
                </Button>
                {manualFile && (
                  <span className="text-xs text-gray-500 font-mono">
                    {(manualFile.size / 1024).toFixed(1)} KB
                  </span>
                )}
              </div>
            </div>
            <Button
              type="button"
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-mono"
              disabled={manualSaving || !manualTitle.trim()}
              onClick={async () => {
                setManualSaving(true);
                try {
                  const url = manualUrl.trim() || `#manual-${crypto.randomUUID()}`;
                  const res = await fetch('/api/saved', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      source: 'query',
                      url,
                      title: manualTitle.trim() || null,
                      snippet: manualSnippet.trim() || null,
                      query_id: queryId,
                      case_id: caseId ?? null,
                    }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || 'Failed to add entry');
                  const newId = data.saved?.id;
                  if (manualFile && newId) {
                    const fd = new FormData();
                    fd.append('file', manualFile);
                    const upRes = await fetch(`/api/saved-links/${newId}/attachments`, {
                      method: 'POST',
                      body: fd,
                    });
                    if (!upRes.ok) {
                      const errData = await upRes.json().catch(() => ({}));
                      toast.error(errData?.error || 'Entry added but attachment failed');
                    }
                  }
                  toast.success(manualFile && newId ? 'Entry and attachment added' : 'Entry added — see Saved tab');
                  setManualTitle('');
                  setManualUrl('');
                  setManualSnippet('');
                  setManualFile(null);
                  if (manualFileInputRef.current) manualFileInputRef.current.value = '';
                  fetchSaved();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Failed to add entry');
                } finally {
                  setManualSaving(false);
                }
              }}
            >
              {manualSaving ? 'Adding...' : 'Add entry'}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
