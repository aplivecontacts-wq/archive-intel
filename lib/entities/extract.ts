/**
 * Phase 3 (Cohesion): Deterministic entity extraction from text. No AI.
 */

export type EntityType = 'person' | 'org' | 'domain' | 'location' | 'handle' | 'other';

export type ExtractedEntity = { name: string; type: EntityType };

const DOMAIN_REGEX = /\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}\b/gi;
const HANDLE_REGEX = /@([a-zA-Z0-9_]{2,30})\b/g;
const CAP_PHRASE_REGEX = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g;

const MAX_CAP_PHRASE_WORDS = 4;
const MAX_ENTITIES_PER_TYPE = 50;

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

function extractDomains(text: string): ExtractedEntity[] {
  const seen = new Set<string>();
  const out: ExtractedEntity[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(DOMAIN_REGEX.source, 'gi');
  while ((m = re.exec(text)) !== null && out.length < MAX_ENTITIES_PER_TYPE) {
    const name = m[0].toLowerCase();
    if (name.length >= 4 && !seen.has(name)) {
      seen.add(name);
      out.push({ name, type: 'domain' });
    }
  }
  return out;
}

function extractHandles(text: string): ExtractedEntity[] {
  const seen = new Set<string>();
  const out: ExtractedEntity[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(HANDLE_REGEX.source, 'g');
  while ((m = re.exec(text)) !== null && out.length < MAX_ENTITIES_PER_TYPE) {
    const name = '@' + m[1];
    if (!seen.has(name)) {
      seen.add(name);
      out.push({ name, type: 'handle' });
    }
  }
  return out;
}

function extractCapitalizedPhrases(text: string): ExtractedEntity[] {
  const seen = new Set<string>();
  const out: ExtractedEntity[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(CAP_PHRASE_REGEX.source, 'g');
  while ((m = re.exec(text)) !== null && out.length < MAX_ENTITIES_PER_TYPE * 2) {
    const raw = m[1];
    const words = raw.split(/\s+/).filter(Boolean);
    if (words.length < 2 || words.length > MAX_CAP_PHRASE_WORDS) continue;
    const name = normalizeName(raw);
    if (name.length >= 3 && name.length <= 50 && !seen.has(name)) {
      seen.add(name);
      out.push({ name, type: 'other' });
    }
  }
  return out;
}

/**
 * Extract entities from plain text. Deterministic; no AI.
 * - Domains: foo.com / sub.foo.com -> domain
 * - Handles: @word -> handle
 * - Capitalized phrases 2–4 words -> other (naive person/org proxy)
 */
export function extractEntities(text: string): ExtractedEntity[] {
  if (!text || typeof text !== 'string') return [];
  const combined: ExtractedEntity[] = [];
  combined.push(...extractDomains(text));
  combined.push(...extractHandles(text));
  combined.push(...extractCapitalizedPhrases(text));
  return combined;
}
