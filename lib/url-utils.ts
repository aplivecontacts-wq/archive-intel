export function isValidUrl(input: string): boolean {
  const trimmed = input.trim();
  return trimmed.startsWith('http://') || trimmed.startsWith('https://');
}

export function canonicalizeUrl(url: string): string {
  try {
    const trimmed = url.trim();
    const parsed = new URL(trimmed);

    parsed.protocol = 'https:';
    let hostname = parsed.hostname.toLowerCase();
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    }
    parsed.hostname = hostname;

    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];
    trackingParams.forEach(param => {
      parsed.searchParams.delete(param);
    });

    let canonicalUrl = `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`;

    if (parsed.pathname !== '/' && canonicalUrl.endsWith('/')) {
      canonicalUrl = canonicalUrl.slice(0, -1);
    }

    const remainingParams = parsed.searchParams.toString();
    if (remainingParams) {
      canonicalUrl += `?${remainingParams}`;
    }

    if (parsed.hash) {
      canonicalUrl += parsed.hash;
    }

    return canonicalUrl;
  } catch (error) {
    return url;
  }
}

export interface WaybackSnapshot {
  timestamp: string;
  originalUrl: string;
  waybackUrl: string;
  captureDate: Date;
}

export function isWaybackUrl(url: string): boolean {
  try {
    const trimmed = url.trim();
    const parsed = new URL(trimmed);
    return parsed.hostname === 'web.archive.org' && parsed.pathname.startsWith('/web/');
  } catch (error) {
    return false;
  }
}

export function parseWaybackUrl(url: string): WaybackSnapshot | null {
  try {
    const trimmed = url.trim();
    const parsed = new URL(trimmed);

    if (parsed.hostname !== 'web.archive.org') {
      return null;
    }

    const pathMatch = parsed.pathname.match(/^\/web\/(\d{14})\/(.+)$/);
    if (!pathMatch) {
      return null;
    }

    const timestamp = pathMatch[1];
    const originalUrl = pathMatch[2];

    const year = timestamp.slice(0, 4);
    const month = timestamp.slice(4, 6);
    const day = timestamp.slice(6, 8);
    const hour = timestamp.slice(8, 10);
    const minute = timestamp.slice(10, 12);
    const second = timestamp.slice(12, 14);

    const captureDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);

    return {
      timestamp,
      originalUrl,
      waybackUrl: trimmed,
      captureDate
    };
  } catch (error) {
    return null;
  }
}
