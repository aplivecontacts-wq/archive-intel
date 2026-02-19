import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Normalize URL for Wayback lookup:
 * - Require full http/https
 * - Trim spaces
 * - Strip fragment (#...)
 * - Keep hostname as-is (do not force www)
 * - Encode query params correctly
 */
function normalizeUrlForWayback(input: string): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return { ok: false, error: 'URL must start with http:// or https://' };
  }
  try {
    const parsed = new URL(trimmed);
    parsed.hash = '';
    const normalized = parsed.toString();
    return { ok: true, url: normalized };
  } catch {
    return { ok: false, error: 'Invalid URL format' };
  }
}

/**
 * GET /api/wayback/available
 * Params: url=<targetUrl>, timestamp=<optional, e.g. 20080101>
 * Returns closest snapshot from archive.org/wayback/available
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const urlParam = searchParams.get('url');
  const timestampParam = searchParams.get('timestamp');

  if (!urlParam) {
    return NextResponse.json(
      { ok: false, error: 'url parameter is required' },
      { status: 400 }
    );
  }

  const norm = normalizeUrlForWayback(urlParam);
  if (!norm.ok) {
    return NextResponse.json(
      { ok: false, error: norm.error },
      { status: 400 }
    );
  }
  const inputUrl = norm.url;

  let requestedTimestamp: string | null = null;
  if (timestampParam) {
    const ts = timestampParam.trim();
    if (/^\d{4}$/.test(ts)) {
      requestedTimestamp = ts + '0101';
    } else if (/^\d{8}$/.test(ts)) {
      requestedTimestamp = ts;
    } else {
      return NextResponse.json(
        { ok: false, error: 'timestamp must be YYYY or YYYYMMDD' },
        { status: 400 }
      );
    }
  }

  const archiveUrl = new URL('https://archive.org/wayback/available');
  archiveUrl.searchParams.set('url', inputUrl);
  if (requestedTimestamp) {
    archiveUrl.searchParams.set('timestamp', requestedTimestamp);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(archiveUrl.toString(), {
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        'User-Agent': 'ArchiveIntel-App/1.0 (https://github.com/archiveintel)',
      },
    });

    clearTimeout(timeout);

    let raw: unknown;
    try {
      const text = await response.text();
      if (!text?.trim()) {
        return NextResponse.json(
          { ok: false, error: 'Failed to fetch from Wayback Machine', details: 'Empty response from archive.org' },
          { status: 500 }
        );
      }
      raw = JSON.parse(text);
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : 'Invalid JSON from archive.org';
      return NextResponse.json(
        { ok: false, error: 'Failed to fetch from Wayback Machine', details: msg },
        { status: 500 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Wayback API request failed',
          details: response.status,
          raw,
        },
        { status: 500 }
      );
    }

    const snap = raw && typeof raw === 'object' && 'archived_snapshots' in raw
      ? (raw as { archived_snapshots?: { closest?: Record<string, unknown> } }).archived_snapshots?.closest ?? null
      : null;
    const found = !!snap;

    const result = {
      ok: true,
      inputUrl,
      requestedTimestamp,
      found,
      closest: found && snap
        ? {
            timestamp: (snap.timestamp as string) || null,
            url: (snap.url as string) || null,
            status: (snap.status as string) || null,
          }
        : null,
      raw,
    };

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[wayback/available]', message, error instanceof Error ? error.stack : '');
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to fetch from Wayback Machine',
        details: message,
      },
      { status: 500 }
    );
  }
}
