import { NextRequest, NextResponse } from 'next/server';
import { isValidUrl, canonicalizeUrl } from '@/lib/url-utils';

interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_DURATION = 10 * 60 * 1000;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  if (!isValidUrl(url)) {
    return NextResponse.json({
      error: 'Archive lookup requires a full URL (including https://)'
    }, { status: 400 });
  }

  const canonicalUrl = canonicalizeUrl(url);

  const cached = cache.get(canonicalUrl);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return NextResponse.json(cached.data);
  }

  try {
    const [availabilityData, cdxData] = await Promise.all([
      fetchAvailability(canonicalUrl),
      fetchCDXData(canonicalUrl)
    ]);

    const result = {
      canonicalUrl,
      closestCapture: availabilityData,
      captures: cdxData
    };

    cache.set(canonicalUrl, {
      data: result,
      timestamp: Date.now()
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Wayback API error:', error);
    return NextResponse.json({
      error: 'Failed to fetch Wayback data'
    }, { status: 500 });
  }
}

async function fetchAvailability(url: string) {
  const availabilityUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(availabilityUrl, {
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error('Availability API HTTP error:', response.status);
      return null;
    }

    const data = await response.json();
    return data.archived_snapshots?.closest || null;
  } catch (error) {
    console.error('Availability API error:', error);
    return null;
  }
}

async function fetchCDXData(url: string) {
  const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&fl=timestamp,original,statuscode,mimetype&filter=statuscode:200&collapse=digest&limit=50`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(cdxUrl, {
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error('CDX API HTTP error:', response.status);
      return [];
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      console.log('CDX returned no data');
      return [];
    }

    const headers = data[0];
    const rows = data.slice(1);

    console.log('CDX returned', rows.length, 'raw captures');

    const canonicalUrlLower = url.toLowerCase();

    const captures = rows
      .filter((row: string[]) => {
        const original = row[headers.indexOf('original')];
        return original && canonicalizeUrl(original).toLowerCase() === canonicalUrlLower;
      })
      .map((row: string[]) => ({
        timestamp: row[headers.indexOf('timestamp')],
        original: row[headers.indexOf('original')],
        statuscode: row[headers.indexOf('statuscode')],
        mimetype: row[headers.indexOf('mimetype')],
        waybackUrl: `https://web.archive.org/web/${row[headers.indexOf('timestamp')]}/${row[headers.indexOf('original')]}`
      }))
      .reverse();

    console.log('Filtered to', captures.length, 'matching captures');

    return captures;
  } catch (error) {
    console.error('CDX API error:', error);
    return [];
  }
}
