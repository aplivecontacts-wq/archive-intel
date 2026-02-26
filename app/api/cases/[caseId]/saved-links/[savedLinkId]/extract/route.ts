/**
 * Phase 2 (Cohesion): Manual "Extract key facts" for a saved link.
 * POST /api/cases/[caseId]/saved-links/[savedLinkId]/extract
 * Fetches URL, extracts plain text, heuristic facts; updates saved_links. No OpenAI.
 * On 429 from live site, resolves a snapshot via archive.org using the same canonical URL
 * and availability/CDX logic as the app's wayback route (no archive routes changed).
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseServer } from '@/lib/supabase-server';
import { canonicalizeUrl, isValidUrl } from '@/lib/url-utils';

export const dynamic = 'force-dynamic';

const FETCH_TIMEOUT_MS = 12_000; // per-attempt timeout
const TOTAL_FETCH_DEADLINE_MS = 45_000; // whole fetch phase must finish within this
const MAX_TEXT_BYTES = 50 * 1024; // 50KB
const SUMMARY_CHARS = 400;
const MAX_FETCH_RETRIES = 3; // retry on 429/503 up to 3 times (4 attempts total)
/** When URL or page looks like a search results page, we use the saved link's notes instead of fetching. */
const SEARCH_URL_PATTERNS = [
  /google\.(com|[\w.]+)\/search/i,
  /^https?:\/\/([^/]+\.)?google\.[^/]+(\/|$)/i,
  /bing\.com\/search/i,
  /duckduckgo\.com/i,
  /search\.yahoo\.com/i,
  /yandex\.(com|[\w.]+)\/search/i,
  /baidu\.com\/s/i,
  /^https?:\/\/[^/]*\?.*\b(q|query|search)=/i,
];
const MAX_URL_COUNT_IN_TEXT = 25; // if this many or more URL-like substrings in first 12KB, treat as link-heavy/search page
const RETRY_DELAY_BASE_MS = 2000;
const RETRY_DELAY_MAX_MS = 10_000;
const ARCHIVE_USER_AGENT = 'ArchiveIntel-App/1.0 (https://github.com/archiveintel)';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** True if the URL alone is a known search engine (do not fetch; use notes instead). */
function isSearchEngineUrl(url: string): boolean {
  try {
    const u = url.trim().toLowerCase();
    return SEARCH_URL_PATTERNS.some((re) => re.test(u));
  } catch {
    return false;
  }
}

/** True if URL or page content looks like a search results / link-heavy page (not a specific article). */
function isSearchOrNonSpecificPage(url: string, pageText: string): boolean {
  try {
    const u = url.trim().toLowerCase();
    if (SEARCH_URL_PATTERNS.some((re) => re.test(u))) return true;
    const sample = pageText.slice(0, 12_000);
    const urlLike = sample.match(/https?:\/\/[^\s<>"']+/gi);
    if (urlLike && urlLike.length >= MAX_URL_COUNT_IN_TEXT) return true;
  } catch {
    // ignore
  }
  return false;
}

/** True when the fetched "page" is effectively just the link or minimal (no real article content). */
function isPageContentJustLinkOrUseless(url: string, pageText: string): boolean {
  const t = pageText.trim();
  if (t.length < 200) return true;
  const u = url.trim();
  if (t === u || t.startsWith(u) && t.length < u.length + 100) return true;
  if (t.toLowerCase().replace(/\s+/g, ' ').includes(u.toLowerCase().replace(/\s+/g, ' ')) && t.length < 600) return true;
  return false;
}

const archiveFetchOpts = { cache: 'no-store' as RequestCache, headers: { 'User-Agent': ARCHIVE_USER_AGENT } };

/** Same as wayback route: availability API, return closest snapshot url or null. */
async function availabilityClosestUrl(url: string): Promise<string | null> {
  try {
    const apiUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(apiUrl, { ...archiveFetchOpts, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = (await res.json()) as { archived_snapshots?: { closest?: { url?: string } } };
    const u = data?.archived_snapshots?.closest?.url;
    return typeof u === 'string' && u ? u : null;
  } catch {
    return null;
  }
}

/** Same as wayback route: CDX API with same params and filter, return newest wayback URL or null. */
async function cdxNewestWaybackUrl(canonicalUrl: string): Promise<string | null> {
  try {
    const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(canonicalUrl)}&output=json&fl=timestamp,original,statuscode,mimetype&filter=statuscode:200&collapse=digest&limit=50`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const res = await fetch(cdxUrl, { ...archiveFetchOpts, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = (await res.json()) as string[][];
    if (!Array.isArray(data) || data.length < 2) return null;
    const headers = data[0] as string[];
    const rows = data.slice(1) as string[][];
    const tsIdx = headers.indexOf('timestamp');
    const origIdx = headers.indexOf('original');
    if (tsIdx === -1 || origIdx === -1) return null;
    const canonicalLower = canonicalUrl.toLowerCase();
    const captures = rows
      .filter((row: string[]) => {
        const original = row[origIdx];
        return original && canonicalizeUrl(original).toLowerCase() === canonicalLower;
      })
      .map((row: string[]) => `https://web.archive.org/web/${row[tsIdx]}/${row[origIdx]}`)
      .reverse();
    return captures[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve a snapshot URL using the same canonical URL and availability/CDX logic as the wayback route.
 * Tries availability with canonical URL, then with raw URL (strip fragment), then CDX with canonical.
 */
async function resolveWaybackSnapshotUrl(liveUrl: string): Promise<string | null> {
  if (!isValidUrl(liveUrl)) return null;
  const trimmed = liveUrl.trim();
  const canonical = canonicalizeUrl(trimmed);
  // 1) availability with canonical (same as Archive tab)
  let u = await availabilityClosestUrl(canonical);
  if (u) return u;
  // 2) availability with raw URL (no fragment) in case archive has exact form
  try {
    const parsed = new URL(trimmed);
    parsed.hash = '';
    const rawNoHash = parsed.toString();
    if (rawNoHash !== canonical) {
      u = await availabilityClosestUrl(rawNoHash);
      if (u) return u;
    }
  } catch {
    // ignore
  }
  // 3) CDX with canonical (same params/filter as wayback route)
  return cdxNewestWaybackUrl(canonical);
}

type ExtractedFacts = {
  key_claims: string[];
  key_entities: string[];
  key_dates: string[];
  summary: string;
};

function stripHtml(html: string): string {
  let s = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
  s = s.replace(/<[^>]+>/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function extractFactsFromText(text: string): ExtractedFacts {
  const summary = text.slice(0, SUMMARY_CHARS).trim();
  if (!summary && text.length > 0) {
    return { key_claims: [], key_entities: [], key_dates: [], summary: text.slice(0, 200).trim() };
  }

  const sentences = text.split(/\.\s+/).filter((p) => p.length > 20);
  const key_claims = sentences.slice(0, 3).map((p) => (p.endsWith('.') ? p : p + '.'));

  const dateRegex = /\b(19|20)\d{2}(-[01]\d(-[0-3]\d)?)?\b/g;
  const dates = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = dateRegex.exec(text)) !== null && dates.size < 5) dates.add(m[0]);

  const capPhraseRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/g;
  const entities = new Set<string>();
  while ((m = capPhraseRegex.exec(text)) !== null && entities.size < 10) {
    const phrase = m[1].trim();
    if (phrase.length >= 2 && phrase.length <= 40) entities.add(phrase);
  }

  return {
    key_claims,
    key_entities: Array.from(entities).slice(0, 10),
    key_dates: Array.from(dates).slice(0, 5),
    summary: summary || text.slice(0, 200).trim(),
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { caseId: string; savedLinkId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const caseId = params.caseId;
    const savedLinkId = params.savedLinkId;
    if (!caseId || !savedLinkId) {
      return NextResponse.json({ error: 'caseId and savedLinkId required' }, { status: 400 });
    }

    const { data: caseRow, error: caseErr } = await (supabaseServer.from('cases') as any)
      .select('id, user_id')
      .eq('id', caseId)
      .maybeSingle();

    if (caseErr || !caseRow) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }
    if (caseRow.user_id != null && caseRow.user_id !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { data: link, error: linkErr } = await (supabaseServer.from('saved_links') as any)
      .select('id, url, user_id, case_id')
      .eq('id', savedLinkId)
      .maybeSingle();

    if (linkErr || !link) {
      return NextResponse.json({ error: 'Saved link not found' }, { status: 404 });
    }
    if (link.user_id !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    if (link.case_id != null && link.case_id !== caseId) {
      return NextResponse.json({ error: 'Saved link does not belong to this case' }, { status: 403 });
    }

    const url = link.url?.trim();
    if (!url || !url.startsWith('http')) {
      const errMsg = 'Invalid or missing URL';
      await (supabaseServer.from('saved_links') as any)
        .update({
          extraction_error: errMsg,
          extracted_at: new Date().toISOString(),
          extracted_text: null,
          extracted_facts: null,
        })
        .eq('id', savedLinkId)
        .eq('user_id', userId);
      return NextResponse.json({ ok: false, error: errMsg }, { status: 200 });
    }

    // Rule: if the saved link is a search engine URL, do not fetch it. Use notes only.
    if (isSearchEngineUrl(url)) {
      const { data: notesRows } = await (supabaseServer.from('saved_link_notes') as any)
        .select('content')
        .eq('saved_link_id', savedLinkId)
        .order('created_at', { ascending: true });
      const noteContents: string[] = Array.isArray(notesRows)
        ? notesRows.map((r: { content?: string | null }) => (r?.content != null ? String(r.content).trim() : '')).filter(Boolean)
        : [];
      const notesBody = noteContents.join('\n\n').trim();
      const errMsg =
        'This is a search results page. Add the specific article URLs or paste content in the Notes section for this saved link, then run Extract key facts again.';
      if (notesBody.length < 50) {
        await (supabaseServer.from('saved_links') as any)
          .update({
            extraction_error: errMsg,
            extracted_at: new Date().toISOString(),
            extracted_text: null,
            extracted_facts: null,
          })
          .eq('id', savedLinkId)
          .eq('user_id', userId);
        return NextResponse.json({ ok: false, error: errMsg }, { status: 200 });
      }
      const notesTruncated =
        Buffer.byteLength(notesBody, 'utf8') > MAX_TEXT_BYTES
          ? Buffer.from(notesBody, 'utf8').subarray(0, MAX_TEXT_BYTES).toString('utf8')
          : notesBody;
      const extracted_facts = extractFactsFromText(notesTruncated);
      const { error: updateErr } = await (supabaseServer.from('saved_links') as any)
        .update({
          extracted_text: notesTruncated,
          extracted_at: new Date().toISOString(),
          extraction_error: null,
          extracted_facts,
        })
        .eq('id', savedLinkId)
        .eq('user_id', userId);
      if (updateErr) {
        if (process.env.NODE_ENV === 'development') console.error('[extract] search-notes update error', updateErr);
        return NextResponse.json({ ok: false, error: 'Failed to save extraction' }, { status: 200 });
      }
      return NextResponse.json({
        ok: true,
        savedLinkId,
        extracted_at: new Date().toISOString(),
        extracted_facts,
      });
    }

    let rawHtml: string | undefined;
    try {
      const fetchPhaseStart = Date.now();
      let lastErr: Error | null = null;
      for (let attempt = 0; attempt <= MAX_FETCH_RETRIES; attempt++) {
        if (Date.now() - fetchPhaseStart > TOTAL_FETCH_DEADLINE_MS) {
          lastErr = new Error('Extraction timed out (rate limit or slow site). Try again in a few minutes.');
          break;
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        const res = await fetch(url, {
          signal: controller.signal,
          cache: 'no-store',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        });
        clearTimeout(timeout);
        if (res.ok) {
          rawHtml = await res.text();
          lastErr = null;
          break;
        }
        if ((res.status === 429 || res.status === 503) && attempt < MAX_FETCH_RETRIES) {
          const retryAfter = res.headers.get('Retry-After');
          const waitMs = retryAfter
            ? Math.min(Math.max(Number(retryAfter) * 1000, RETRY_DELAY_BASE_MS), RETRY_DELAY_MAX_MS)
            : Math.min(RETRY_DELAY_BASE_MS * Math.pow(2, attempt), RETRY_DELAY_MAX_MS);
          if (process.env.NODE_ENV === 'development') {
            console.warn(`[extract] HTTP ${res.status}, retrying in ${waitMs}ms (attempt ${attempt + 1}/${MAX_FETCH_RETRIES})`);
          }
          await sleep(waitMs);
          continue;
        }
        lastErr = new Error(
          res.status === 429
            ? 'This site is rate-limiting. Try again in a few minutes.'
            : `HTTP ${res.status}`
        );
        break;
      }
      // On 429 from live site, resolve snapshot via archive.org (same logic as wayback route)
      if (lastErr && lastErr.message.includes('rate-limiting') && !url.includes('web.archive.org')) {
        if (process.env.NODE_ENV === 'development') console.log('[extract] 429: resolving snapshot for', url);
        const snapshotUrl = await resolveWaybackSnapshotUrl(url);
        if (snapshotUrl) {
          if (process.env.NODE_ENV === 'development') console.log('[extract] snapshot found, fetching:', snapshotUrl);
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
          try {
            const archiveRes = await fetch(snapshotUrl, {
              signal: controller.signal,
              cache: 'no-store',
              headers: { 'User-Agent': ARCHIVE_USER_AGENT },
            });
            clearTimeout(timeout);
            if (archiveRes.ok) {
              rawHtml = await archiveRes.text();
              lastErr = null;
            } else if (process.env.NODE_ENV === 'development') {
              console.warn('[extract] snapshot fetch failed', archiveRes.status);
            }
          } catch (e) {
            if (process.env.NODE_ENV === 'development') console.warn('[extract] snapshot fetch error', e instanceof Error ? e.message : e);
          }
        } else if (process.env.NODE_ENV === 'development') {
          console.log('[extract] no snapshot found for', url);
        }
        if (lastErr) {
          lastErr = new Error(
            'This site is rate-limiting. No archived copy was found. Try again in a few minutes or add this page from the Archive tab.'
          );
        }
      }
      if (lastErr) throw lastErr;
      if (typeof rawHtml === 'undefined') throw new Error('Fetch failed');
    } catch (fetchErr) {
      const errMsg = fetchErr instanceof Error ? fetchErr.message : 'Fetch failed';
      if (process.env.NODE_ENV === 'development') console.error('[extract] fetch error', errMsg);
      await (supabaseServer.from('saved_links') as any)
        .update({
          extraction_error: errMsg,
          extracted_at: new Date().toISOString(),
          extracted_text: null,
          extracted_facts: null,
        })
        .eq('id', savedLinkId)
        .eq('user_id', userId);
      return NextResponse.json({ ok: false, error: errMsg }, { status: 200 });
    }

    if (typeof rawHtml !== 'string') throw new Error('Fetch failed');
    const extractedText = stripHtml(rawHtml);
    const truncated =
      Buffer.byteLength(extractedText, 'utf8') > MAX_TEXT_BYTES
        ? Buffer.from(extractedText, 'utf8').subarray(0, MAX_TEXT_BYTES).toString('utf8')
        : extractedText;

    let textForFacts = truncated;
    let textToStore = truncated;
    const useNotesForFacts =
      isSearchOrNonSpecificPage(url, truncated) || isPageContentJustLinkOrUseless(url, truncated);
    if (useNotesForFacts) {
      const { data: notesRows } = await (supabaseServer.from('saved_link_notes') as any)
        .select('content')
        .eq('saved_link_id', savedLinkId)
        .order('created_at', { ascending: true });
      const noteContents: string[] =
        Array.isArray(notesRows)
          ? notesRows.map((r: { content?: string | null }) => (r?.content != null ? String(r.content).trim() : '')).filter(Boolean)
          : [];
      const notesBody = noteContents.join('\n\n');
      if (notesBody.length > 0) {
        const notesTruncated =
          Buffer.byteLength(notesBody, 'utf8') > MAX_TEXT_BYTES
            ? Buffer.from(notesBody, 'utf8').subarray(0, MAX_TEXT_BYTES).toString('utf8')
            : notesBody;
        textForFacts = notesTruncated;
        textToStore = notesTruncated;
      }
    }

    const extracted_facts = extractFactsFromText(textForFacts);

    const { error: updateErr } = await (supabaseServer.from('saved_links') as any)
      .update({
        extracted_text: textToStore,
        extracted_at: new Date().toISOString(),
        extraction_error: null,
        extracted_facts,
      })
      .eq('id', savedLinkId)
      .eq('user_id', userId);

    if (updateErr) {
      if (process.env.NODE_ENV === 'development') console.error('[extract] update error', updateErr);
      return NextResponse.json(
        { ok: false, error: 'Failed to save extraction' },
        { status: 200 }
      );
    }

    return NextResponse.json({
      ok: true,
      savedLinkId,
      extracted_at: new Date().toISOString(),
      extracted_facts,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Extract failed';
    if (process.env.NODE_ENV === 'development') console.error('[extract] catch', err);
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  }
}
