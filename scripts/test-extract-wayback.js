/**
 * Verifies that we can resolve a Wayback snapshot URL using the same APIs
 * the extract route uses (availability + CDX). Run: node scripts/test-extract-wayback.js
 * Usage: node scripts/test-extract-wayback.js [url]
 * Default URL: https://example.com
 */

const USER_AGENT = 'ArchiveIntel-App/1.0 (https://github.com/archiveintel)';
const testUrl = process.argv[2] || 'https://example.com';

async function availabilityClosestUrl(url) {
  const apiUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
  const res = await fetch(apiUrl, { cache: 'no-store', headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) return null;
  const data = await res.json();
  const u = data?.archived_snapshots?.closest?.url;
  return typeof u === 'string' && u ? u : null;
}

async function cdxNewestWaybackUrl(url) {
  const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&fl=timestamp,original,statuscode,mimetype&filter=statuscode:200&collapse=digest&limit=50`;
  const res = await fetch(cdxUrl, { cache: 'no-store', headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length < 2) return null;
  const headers = data[0];
  const rows = data.slice(1);
  const tsIdx = headers.indexOf('timestamp');
  const origIdx = headers.indexOf('original');
  if (tsIdx === -1 || origIdx === -1) return null;
  const canonicalLower = url.toLowerCase();
  function canonicalize(u) {
    try {
      const p = new URL(u.trim());
      p.protocol = 'https:';
      let host = p.hostname.toLowerCase();
      if (host.startsWith('www.')) host = host.slice(4);
      p.hostname = host;
      return `${p.protocol}//${p.hostname}${p.pathname}${p.search}`.replace(/\/$/, '') || `${p.protocol}//${p.hostname}/`;
    } catch {
      return u;
    }
  }
  const captures = rows
    .filter((row) => {
      const original = row[origIdx];
      return original && canonicalize(original).toLowerCase() === canonicalLower;
    })
    .map((row) => `https://web.archive.org/web/${row[tsIdx]}/${row[origIdx]}`)
    .reverse();
  return captures[0] ?? null;
}

async function main() {
  console.log('Testing wayback resolution for:', testUrl);
  const fromAvailability = await availabilityClosestUrl(testUrl);
  if (fromAvailability) {
    console.log('Snapshot (availability):', fromAvailability);
    return;
  }
  const fromCdx = await cdxNewestWaybackUrl(testUrl);
  if (fromCdx) {
    console.log('Snapshot (CDX):', fromCdx);
    return;
  }
  console.log('No snapshot found for this URL.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
