/**
 * Phase 1 (Cohesion): Canonical Evidence Store — in-memory only, no DB changes.
 * Unifies results, saved_links, and notes into a single EvidenceItem shape for downstream use.
 */

export type EvidenceSource =
  | 'wayback'
  | 'search'
  | 'note'
  | 'archive'
  | 'query'
  | 'official'
  | 'unknown';

export type EvidenceItem = {
  id: string;
  case_id: string;
  query_id?: string | null;
  kind: 'result' | 'saved_link' | 'note';
  source: EvidenceSource;
  title?: string;
  url?: string;
  snippet?: string;
  captured_at?: string | null;
  created_at?: string | null;
  text_blob?: string | null;
  meta?: Record<string, unknown>;
};

type ResultRow = {
  query_id?: string;
  source?: string;
  title?: string;
  url?: string;
  snippet?: string;
  captured_at?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
};

type SavedLinkRow = {
  id?: string;
  case_id?: string;
  query_id?: string | null;
  source?: string;
  url?: string;
  title?: string | null;
  snippet?: string | null;
  captured_at?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
};

type NoteRow = {
  query_id?: string;
  content?: string;
  created_at?: string | null;
  [key: string]: unknown;
};

function mapResultSource(s: string | undefined): EvidenceSource {
  if (s === 'wayback' || s === 'search' || s === 'note') return s;
  return 'unknown';
}

function mapSavedLinkSource(s: string | undefined): EvidenceSource {
  if (s === 'archive' || s === 'query' || s === 'official') return s;
  return 'unknown';
}

function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return Math.abs(h).toString(36);
}

/**
 * Normalize results rows into EvidenceItem[]. Each row should have query_id (or pass caseId and inject from key when flattening elsewhere).
 */
export function normalizeResults(
  resultsRows: ResultRow[],
  caseId: string
): EvidenceItem[] {
  const out: EvidenceItem[] = [];
  try {
    resultsRows.forEach((r, i) => {
      const queryId = r.query_id ?? null;
      const id = `result:${queryId ?? caseId}:${i}`;
      out.push({
        id,
        case_id: caseId,
        query_id: queryId ?? null,
        kind: 'result',
        source: mapResultSource(r.source),
        title: r.title ?? undefined,
        url: r.url ?? undefined,
        snippet: r.snippet ?? undefined,
        captured_at: r.captured_at ?? null,
        created_at: r.created_at ?? null,
        text_blob: null,
        meta: { confidence: r.confidence },
      });
    });
  } catch {
    return [];
  }
  return out;
}

/**
 * Normalize saved_links rows into EvidenceItem[].
 */
export function normalizeSavedLinks(
  savedLinksRows: SavedLinkRow[],
  caseId: string
): EvidenceItem[] {
  const out: EvidenceItem[] = [];
  try {
    savedLinksRows.forEach((s, i) => {
      const id =
        s.id != null && String(s.id).length > 0
          ? `saved_link:${s.id}`
          : `saved_link:${caseId}:${simpleHash(s.url ?? String(i))}`;
      out.push({
        id,
        case_id: s.case_id ?? caseId,
        query_id: s.query_id ?? null,
        kind: 'saved_link',
        source: mapSavedLinkSource(s.source),
        title: s.title ?? undefined,
        url: s.url ?? undefined,
        snippet: s.snippet ?? undefined,
        captured_at: s.captured_at ?? null,
        created_at: s.created_at ?? null,
        text_blob: null,
        meta: s.source_tier != null ? { source_tier: s.source_tier } : undefined,
      });
    });
  } catch {
    return [];
  }
  return out;
}

/**
 * Normalize notes rows into EvidenceItem[].
 */
export function normalizeNotes(
  notesRows: NoteRow[],
  caseId: string
): EvidenceItem[] {
  const out: EvidenceItem[] = [];
  try {
    notesRows.forEach((n, i) => {
      const queryId = n.query_id ?? null;
      const id = `note:${queryId ?? caseId}:${i}`;
      out.push({
        id,
        case_id: caseId,
        query_id: queryId ?? null,
        kind: 'note',
        source: 'note',
        title: undefined,
        url: undefined,
        snippet: (n.content as string)?.slice(0, 200) ?? undefined,
        captured_at: null,
        created_at: n.created_at ?? null,
        text_blob: null,
        meta: { content_preview: (n.content as string)?.slice(0, 160) },
      });
    });
  } catch {
    return [];
  }
  return out;
}

export type CaseEvidenceInput = {
  results_by_query: Record<string, unknown[]>;
  notes_by_query: Record<string, unknown[]>;
  saved_links: unknown[];
};

export type CaseEvidenceBundle = {
  items: EvidenceItem[];
  indexById: Record<string, EvidenceItem>;
};

/**
 * Build a single bundle from results_by_query, notes_by_query, and saved_links.
 * If any normalization fails, that part is empty; no throw.
 */
export function buildCaseEvidenceBundle(
  caseId: string,
  input: CaseEvidenceInput
): CaseEvidenceBundle {
  const items: EvidenceItem[] = [];
  const indexById: Record<string, EvidenceItem> = {};

  try {
    const resultRows: ResultRow[] = [];
    for (const [qid, arr] of Object.entries(input.results_by_query ?? {})) {
      if (!Array.isArray(arr)) continue;
      for (const r of arr) {
        resultRows.push({ ...(r as Record<string, unknown>), query_id: qid } as ResultRow);
      }
    }
    const fromResults = normalizeResults(resultRows, caseId);
    fromResults.forEach((item) => {
      items.push(item);
      indexById[item.id] = item;
    });
  } catch {
    // leave items/indexById as-is for results
  }

  try {
    const noteRows: NoteRow[] = [];
    for (const [qid, arr] of Object.entries(input.notes_by_query ?? {})) {
      if (!Array.isArray(arr)) continue;
      for (const n of arr) {
        noteRows.push({ ...(n as Record<string, unknown>), query_id: qid } as NoteRow);
      }
    }
    const fromNotes = normalizeNotes(noteRows, caseId);
    fromNotes.forEach((item) => {
      items.push(item);
      indexById[item.id] = item;
    });
  } catch {
    // continue
  }

  try {
    const savedRows = Array.isArray(input.saved_links) ? input.saved_links : [];
    const fromSaved = normalizeSavedLinks(savedRows as SavedLinkRow[], caseId);
    fromSaved.forEach((item) => {
      items.push(item);
      indexById[item.id] = item;
    });
  } catch {
    // continue
  }

  return { items, indexById };
}
