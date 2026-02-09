import { NextRequest, NextResponse } from 'next/server';
import { canonicalizeUrl } from '@/lib/url-utils';

/**
 * GET /api/wayback/cdx
 * Params: url, from (YYYY-MM-DD), to (YYYY-MM-DD)
 * Returns captures in the date range.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const urlParam = searchParams.get('url');
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  if (!urlParam?.trim()) {
    return NextResponse.json({ ok: false, error: 'url is required' }, { status: 400 });
  }
  if (!fromParam?.trim() || !toParam?.trim()) {
    return NextResponse.json({ ok: false, error: 'from and to (YYYY-MM-DD) are required' }, { status: 400 });
  }

  const trimmed = urlParam.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return NextResponse.json({ ok: false, error: 'URL must start with http:// or https://' }, { status: 400 });
  }

  const fromMatch = fromParam.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const toMatch = toParam.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!fromMatch || !toMatch) {
    return NextResponse.json({ ok: false, error: 'from and to must be YYYY-MM-DD' }, { status: 400 });
  }

  const fromTs = fromMatch[1] + fromMatch[2] + fromMatch[3] + '000000';
  const toTs = toMatch[1] + toMatch[2] + toMatch[3] + '235959';

  const canonicalUrl = canonicalizeUrl(trimmed);
  const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(canonicalUrl)}&from=${fromTs}&to=${toTs}&output=json&fl=timestamp,original,statuscode,mimetype&filter=statuscode:200&collapse=digest&limit=100&gzip=false`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const response = await fetch(cdxUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      const body = await response.text();
      return NextResponse.json(
        {
          ok: false,
          error: 'CDX request failed',
          details: `HTTP ${response.status}`,
          body: body.slice(0, 300),
        },
        { status: 500 }
      );
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length < 2) {
      return NextResponse.json({
        ok: true,
        inputUrl: trimmed,
        from: fromParam,
        to: toParam,
        captures: [],
      });
    }

    const headers = data[0];
    const rows = data.slice(1);
    const tsIdx = headers.indexOf('timestamp');
    const origIdx = headers.indexOf('original');
    const statusIdx = headers.indexOf('statuscode');
    const mimeIdx = headers.indexOf('mimetype');
    const canonicalLower = canonicalUrl.toLowerCase();

    const captures = rows
      .filter((row: string[]) => {
        const original = row[origIdx];
        return original && canonicalizeUrl(original).toLowerCase() === canonicalLower;
      })
      .map((row: string[]) => ({
        timestamp: row[tsIdx],
        original: row[origIdx],
        statuscode: row[statusIdx],
        mimetype: row[mimeIdx],
        waybackUrl: `https://web.archive.org/web/${row[tsIdx]}/${row[origIdx]}`,
      }));

    return NextResponse.json({
      ok: true,
      inputUrl: trimmed,
      from: fromParam,
      to: toParam,
      captures,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { ok: false, error: 'CDX request failed', details: msg },
      { status: 500 }
    );
  }
}
