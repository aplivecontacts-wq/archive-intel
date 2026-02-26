/**
 * POST /api/cases/[caseId]/saved-links/[savedLinkId]/analyze
 * Fetches page (or uses extracted_text), sends to LLM, stores ai_summary, ai_key_facts, ai_entities. Records token usage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseServer } from '@/lib/supabase-server';
import { generateStructuredJson } from '@/lib/ai/openai';
import { recordTokenUsage } from '@/lib/usage';

export const dynamic = 'force-dynamic';

const MAX_PAGE_CHARS = 16_000;
const FETCH_TIMEOUT_MS = 12_000;
const MIN_NOTES_LENGTH = 150;
const ARCHIVE_USER_AGENT = 'ArchiveIntel-App/1.0 (https://github.com/archiveintel)';

/** When true, we should use notes (and URLs in notes) instead of the saved page for analysis. */
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
const MAX_URL_COUNT_IN_TEXT = 25;

function isSearchUrl(url: string): boolean {
  try {
    const u = url.trim().toLowerCase();
    return SEARCH_URL_PATTERNS.some((re) => re.test(u));
  } catch {
    return false;
  }
}

function isLinkHeavyContent(text: string): boolean {
  try {
    const sample = text.slice(0, 12_000);
    const urlLike = sample.match(/https?:\/\/[^\s<>"']+/gi);
    return !!(urlLike && urlLike.length >= MAX_URL_COUNT_IN_TEXT);
  } catch {
    return false;
  }
}

/** Extract URLs from text (e.g. notes). Returns clean URLs, trailing punctuation removed. */
function extractUrlsFromText(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"']+/gi) || [];
  const seen = new Set<string>();
  return matches
    .map((u) => u.replace(/[.,;:!?)]+$/, '').trim())
    .filter((u) => u.length > 10 && !seen.has(u) && (seen.add(u), true));
}

function stripHtml(html: string): string {
  let s = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
  s = s.replace(/<[^>]+>/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

type AnalyzeResult = {
  summary: string;
  key_facts: string[];
  entities: { name: string; type: string; context: string }[];
};

const SYSTEM_PROMPT = `You are given the main text of one web page. Your job is to read it and return only valid JSON.

First state the main idea in one short line (headline style). Then add 2-4 sentences that summarize the key points. Be concise; skip navigation, boilerplate, and filler.

Output exactly: summary (string: one-line main idea or headline first, then 2-4 short sentences; no long paragraphs), key_facts (array of 5-12 concrete facts; each a short string, quote or paraphrase), entities (array of { name, type, context } where type is one of: person, org, location, domain, other and context is one short line).
Be factual. Base everything on the page content. Do not invent or speculate. No other keys, no commentary. Return ONLY valid JSON.`;

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

    const { data: caseRow, error: caseErr } = await (supabaseServer as any)
      .from('cases')
      .select('id, user_id')
      .eq('id', caseId)
      .maybeSingle();

    if (caseErr || !caseRow) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }
    if (caseRow.user_id != null && caseRow.user_id !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { data: link, error: linkErr } = await (supabaseServer as any)
      .from('saved_links')
      .select('id, url, user_id, case_id, extracted_text')
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

    const url = (link.url || '').trim();
    if (!url.startsWith('http')) {
      return NextResponse.json({ error: 'Invalid or missing URL' }, { status: 400 });
    }

    let pageText = (link.extracted_text || '').trim();
    const looksLikeSearchPage = isSearchUrl(url) || (pageText.length >= 500 && isLinkHeavyContent(pageText));

    if (looksLikeSearchPage) {
      const { data: notesRows } = await (supabaseServer as any)
        .from('saved_link_notes')
        .select('content')
        .eq('saved_link_id', savedLinkId)
        .order('created_at', { ascending: true });
      const noteContents: string[] = Array.isArray(notesRows)
        ? notesRows.map((r: { content?: string | null }) => (r?.content != null ? String(r.content).trim() : '')).filter(Boolean)
        : [];
      const notesBody = noteContents.join('\n\n').trim();
      const urlsFromNotes = extractUrlsFromText(notesBody).filter((u) => !isSearchUrl(u));
      const hasEnoughNotes = notesBody.length >= MIN_NOTES_LENGTH || urlsFromNotes.length > 0;
      if (!hasEnoughNotes) {
        return NextResponse.json(
          {
            error:
              'This looks like a search results page. Add the specific article URLs or paste content in the Notes section for this saved link, then run Extract key facts again.',
          },
          { status: 400 }
        );
      }
      const firstArticleUrl = urlsFromNotes[0];
      if (firstArticleUrl) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
          const res = await fetch(firstArticleUrl, {
            signal: controller.signal,
            cache: 'no-store',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
          });
          clearTimeout(timeout);
          if (res.ok) {
            const html = await res.text();
            const fetched = stripHtml(html).trim();
            if (fetched.length >= 100) pageText = fetched;
          }
        } catch (e) {
          if (process.env.NODE_ENV === 'development') console.error('[analyze] fetch note URL', firstArticleUrl, e);
        }
      }
      if (pageText === (link.extracted_text || '').trim() || pageText.length < 100) {
        pageText = notesBody.length > MAX_PAGE_CHARS ? notesBody.slice(0, MAX_PAGE_CHARS) : notesBody;
      }
    } else if (pageText.length < 500) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        const res = await fetch(url, {
          signal: controller.signal,
          cache: 'no-store',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });
        clearTimeout(timeout);
        if (res.ok) {
          const html = await res.text();
          pageText = stripHtml(html);
        }
        if (pageText.length < 500 && (res.status === 429 || res.status === 503)) {
          const availUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
          const availRes = await fetch(availUrl, { cache: 'no-store' as RequestCache, headers: { 'User-Agent': ARCHIVE_USER_AGENT } });
          if (availRes.ok) {
            const data = (await availRes.json()) as { archived_snapshots?: { closest?: { url?: string } } };
            const snapshot = data?.archived_snapshots?.closest?.url;
            if (typeof snapshot === 'string') {
              const snapRes = await fetch(snapshot, { cache: 'no-store' as RequestCache, headers: { 'User-Agent': ARCHIVE_USER_AGENT } });
              if (snapRes.ok) pageText = stripHtml(await snapRes.text());
            }
          }
        }
      } catch (e) {
        if (process.env.NODE_ENV === 'development') console.error('[analyze] fetch', e);
      }
    }

    const truncated = pageText.length > MAX_PAGE_CHARS ? pageText.slice(0, MAX_PAGE_CHARS) : pageText;
    if (truncated.length < 100) {
      return NextResponse.json(
        { error: 'Could not get enough page content. Try "Extract key facts" first or use a different URL.' },
        { status: 400 }
      );
    }

    const result = await generateStructuredJson<AnalyzeResult>(SYSTEM_PROMPT, truncated);
    const { data } = result;
    if (!data || typeof data.summary !== 'string' || !Array.isArray(data.key_facts) || !Array.isArray(data.entities)) {
      return NextResponse.json({ error: 'AI returned invalid shape' }, { status: 500 });
    }

    if (result.usage && userId) {
      await recordTokenUsage(supabaseServer as any, userId, result.usage);
    }

    const ai_key_facts = data.key_facts.filter((f): f is string => typeof f === 'string').slice(0, 12);
    const ai_entities = (data.entities || [])
      .filter((e): e is { name: string; type: string; context: string } => e && typeof e.name === 'string' && typeof e.type === 'string')
      .map((e) => ({ name: String(e.name), type: String(e.type), context: typeof e.context === 'string' ? e.context : '' }))
      .slice(0, 30);

    const { error: updateErr } = await (supabaseServer as any)
      .from('saved_links')
      .update({
        ai_summary: data.summary.slice(0, 2000),
        ai_key_facts,
        ai_entities,
        ai_analyzed_at: new Date().toISOString(),
      })
      .eq('id', savedLinkId)
      .eq('user_id', userId);

    if (updateErr) {
      if (process.env.NODE_ENV === 'development') console.error('[analyze] update', updateErr);
      return NextResponse.json({ error: 'Failed to save analysis' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      savedLinkId,
      summary: data.summary,
      key_facts: ai_key_facts,
      entities: ai_entities,
      ai_analyzed_at: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Analyze failed';
    if (process.env.NODE_ENV === 'development') console.error('[analyze]', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
