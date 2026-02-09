/**
 * Extract and infer email patterns from publicly found data.
 * NO guessing, NO validation - only pattern classification of existing emails.
 */

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const ROLE_PREFIXES = new Set([
  'support', 'info', 'press', 'media', 'help', 'contact', 'admin', 'sales',
  'billing', 'legal', 'privacy', 'security', 'abuse', 'careers', 'jobs',
]);

export type PatternType =
  | 'role'
  | 'first.last'
  | 'firstlast'
  | 'firstinitiallast'
  | 'first'
  | 'name+number'
  | 'other';

export type Confidence = 'high' | 'medium' | 'low';

export interface DomainInsight {
  domain: string;
  roleEmails: string[];
  namePatternSignals: { pattern: PatternType; count: number; confidence: Confidence }[];
  examples: string[];
}

function classifyLocalPart(local: string): PatternType {
  const lower = local.toLowerCase();
  const firstSegment = lower.split(/[.-]/)[0];
  if (ROLE_PREFIXES.has(firstSegment) || ROLE_PREFIXES.has(lower)) return 'role';
  if (/\d/.test(local)) return 'name+number';
  if (/^[a-z]+\.[a-z]+$/.test(lower) && local.indexOf('.') === local.lastIndexOf('.')) return 'first.last';
  if (/^[a-z]+$/.test(lower)) {
    if (lower.length > 6) return 'firstlast';
    if (lower.length >= 4 && lower.length <= 8) return 'firstinitiallast';
    if (lower.length < 6) return 'first';
  }
  return 'other';
}

function getConfidence(count: number): Confidence {
  if (count >= 3) return 'high';
  if (count >= 2) return 'medium';
  return 'low';
}

export function extractEmailsFromText(text: string | null): string[] {
  if (!text || typeof text !== 'string') return [];
  const matches = text.match(EMAIL_REGEX) || [];
  return matches;
}

export function extractEmailsFromResults(results: { snippet?: string | null; title?: string | null; url?: string | null }[]): string[] {
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const r of results) {
    const texts = [r.snippet, r.title, r.url].filter(Boolean) as string[];
    for (const t of texts) {
      const found = extractEmailsFromText(t);
      for (const e of found) {
        const key = e.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          emails.push(e);
        }
      }
    }
  }
  return emails;
}

export function inferDomainInsights(emails: string[]): DomainInsight[] {
  const byDomain = new Map<string, string[]>();
  for (const e of emails) {
    const idx = e.indexOf('@');
    if (idx < 0) continue;
    const local = e.slice(0, idx);
    const domain = e.slice(idx + 1).toLowerCase();
    if (!byDomain.has(domain)) byDomain.set(domain, []);
    byDomain.get(domain)!.push(e);
  }

  const insights: DomainInsight[] = [];
  for (const [domain, list] of Array.from(byDomain.entries())) {
    const roleEmails: string[] = [];
    const namePatternCounts = new Map<PatternType, string[]>();

    for (const email of list) {
      const local = email.slice(0, email.indexOf('@'));
      const pattern = classifyLocalPart(local);
      if (pattern === 'role') {
        roleEmails.push(email);
      } else if (pattern !== 'other') {
        if (!namePatternCounts.has(pattern)) namePatternCounts.set(pattern, []);
        namePatternCounts.get(pattern)!.push(email);
      }
    }

    const namePatternSignals = Array.from(namePatternCounts.entries())
      .filter(([, emails]) => emails.length >= 1)
      .map(([pattern, emails]) => ({
        pattern,
        count: emails.length,
        confidence: getConfidence(emails.length),
      }))
      .sort((a, b) => b.count - a.count);

    const examples = list.slice(0, 3);

    insights.push({
      domain,
      roleEmails: roleEmails.slice(0, 5),
      namePatternSignals,
      examples,
    });
  }

  return insights.sort((a, b) => {
    const aTotal = a.roleEmails.length + a.namePatternSignals.reduce((s, x) => s + x.count, 0);
    const bTotal = b.roleEmails.length + b.namePatternSignals.reduce((s, x) => s + x.count, 0);
    return bTotal - aTotal;
  });
}

export function getObservedEmailInsights(results: { snippet?: string | null; title?: string | null; url?: string | null }[]): DomainInsight[] {
  const emails = extractEmailsFromResults(results);
  if (emails.length === 0) return [];
  return inferDomainInsights(emails);
}
