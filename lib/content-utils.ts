/**
 * Strip leading US .gov / federal banner so main content is used for extraction/summary.
 */
export function stripLeadingGovBoilerplate(text: string): string {
  const sample = text.slice(0, 2000);
  const lower = sample.toLowerCase();
  const markers = [
    'share sensitive information only on official, secure websites',
    'share sensitive information only on official, secure website',
    '.gov website belongs to an official government',
  ];
  for (const marker of markers) {
    const idx = lower.indexOf(marker);
    if (idx !== -1) {
      const after = text.slice(idx + marker.length).trim();
      const dropTrailingBanner = after.replace(/^\s*\.?\s*/, '').trim();
      if (dropTrailingBanner.length >= 100) return dropTrailingBanner;
      const nextWord = dropTrailingBanner.slice(0, 80);
      if (!/^(lock|locked|https?:\/\/|skip|menu|close)\b/i.test(nextWord)) return dropTrailingBanner;
    }
  }
  if (/an official website of the united states government/i.test(sample) && sample.length > 400) {
    const afterBanner = text.replace(/^[\s\S]{0,400}?(?=mission\s|objectives\s|the\s+voyager|launched\s|spacecraft\s)/i, '').trim();
    if (afterBanner.length >= 100) return afterBanner;
  }
  return text;
}
