import { NextRequest, NextResponse } from 'next/server';

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
    });

    clearTimeout(timeout);

    const raw = await response.json();

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

    const closest = raw?.archived_snapshots?.closest || null;
    const found = !!closest;

    const result = {
      ok: true,
      inputUrl,
      requestedTimestamp,
      found,
      closest: found
        ? {
            timestamp: closest.timestamp || null,
            url: closest.url || null,
            status: closest.status || null,
          }
        : null,
      raw,
    };

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
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
