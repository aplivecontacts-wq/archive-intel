/**
 * Brief JSON schema validation for Phase 5.2.
 * Validates structure before saving to case_briefs.
 */

const CONFIDENCE_VALUES = new Set(['high', 'medium', 'low']);
const BASIS_VALUES = new Set(['public', 'note', 'confidential', 'unverified']);
const ENTITY_TYPES = new Set([
  'person',
  'org',
  'domain',
  'location',
  'handle',
  'other',
]);
const PRIORITY_VALUES = new Set(['high', 'medium', 'low']);

const ISSUE_TYPES = new Set(['date', 'count', 'identity', 'location', 'claim', 'other']);

export interface BriefWorkingTimelineItem {
  time_window: string;
  event: string;
  confidence: 'high' | 'medium' | 'low';
  basis: 'public' | 'note' | 'confidential' | 'unverified';
  source_ids: string[];
  source_refs?: string[];
  /** User-controlled; AI must not set. Default false in UI when omitted. */
  verified?: boolean;
}

export interface BriefKeyEntity {
  name: string;
  type: 'person' | 'org' | 'domain' | 'location' | 'handle' | 'other';
  source_refs: string[];
}

/** Legacy shape: issue + details + source_refs. New shape: issue + issue_type + statement_a/B + refs + why_it_matters + resolution_tasks. */
export interface BriefContradictionsTensions {
  issue: string;
  /** Legacy */
  details?: string;
  /** Legacy */
  source_refs?: string[];
  /** Structured conflict */
  issue_type?: 'date' | 'count' | 'identity' | 'location' | 'claim' | 'other';
  statement_a?: string;
  statement_a_refs?: string[];
  statement_b?: string;
  statement_b_refs?: string[];
  why_it_matters?: string;
  resolution_tasks?: string[];
}

export interface BriefVerificationTask {
  task: string;
  priority: 'high' | 'medium' | 'low';
  suggested_queries: string[];
}

export interface EvidenceStrengthItem {
  theme: string;
  results_count: number;
  saved_links_count: number;
  wayback_count: number;
  note_count: number;
  corroboration_estimate: string;
  strength_rating: 'high' | 'medium' | 'low';
}

export type EvidenceIndex = Record<
  string,
  { type?: string; description?: string; url?: string }
>;

export interface BriefHypothesis {
  statement: string;
  likelihood: 'high' | 'medium' | 'low';
  evidence_for: string[];
  evidence_against: string[];
  falsification_tests: string[];
}

export interface BriefCriticalGap {
  missing_item: string;
  why_it_matters: string;
  fastest_way_to_verify: string;
  suggested_queries: string[];
}

export interface BriefChangeEntry {
  section: string;
  kind: 'added' | 'removed' | 'modified';
  label: string;
  detail?: string;
}

export interface BriefJson {
  executive_overview: string;
  working_timeline: BriefWorkingTimelineItem[];
  evidence_index: EvidenceIndex;
  key_entities: BriefKeyEntity[];
  contradictions_tensions: BriefContradictionsTensions[];
  verification_tasks: BriefVerificationTask[];
  evidence_strength?: EvidenceStrengthItem[];
  hypotheses?: BriefHypothesis[];
  critical_gaps?: BriefCriticalGap[];
  changes_since_last_version?: BriefChangeEntry[];
  /** Phase 10.1: optional heuristic summary of source credibility from evidence_index only */
  source_credibility_summary?: string;
}

export function validateBriefJson(raw: unknown): BriefJson {
  if (raw === null || typeof raw !== 'object') {
    throw new Error('Brief must be a JSON object');
  }
  const obj = raw as Record<string, unknown>;

  const exec = obj.executive_overview;
  if (typeof exec !== 'string') {
    obj.executive_overview = exec == null ? '' : String(exec);
  }

  const evidenceIndex = obj.evidence_index;
  if (evidenceIndex === null || typeof evidenceIndex !== 'object' || Array.isArray(evidenceIndex)) {
    throw new Error('evidence_index must be an object');
  }
  const evidenceIds = new Set(Object.keys(evidenceIndex as Record<string, unknown>));

  const tl = obj.working_timeline;
  if (!Array.isArray(tl)) {
    throw new Error('working_timeline must be an array');
  }
  for (let i = 0; i < tl.length; i++) {
    const item = tl[i];
    if (!item || typeof item !== 'object') {
      throw new Error(`working_timeline[${i}] must be an object`);
    }
    const t = item as Record<string, unknown>;
    if (typeof t.time_window !== 'string') {
      throw new Error(`working_timeline[${i}].time_window must be a string`);
    }
    if (typeof t.event !== 'string') {
      throw new Error(`working_timeline[${i}].event must be a string`);
    }
    if (!CONFIDENCE_VALUES.has(String(t.confidence))) {
      throw new Error(
        `working_timeline[${i}].confidence must be high, medium, or low`
      );
    }
    if (!BASIS_VALUES.has(String(t.basis))) {
      throw new Error(
        `working_timeline[${i}].basis must be public, note, confidential, or unverified`
      );
    }
    const sourceIds = t.source_ids;
    if (!Array.isArray(sourceIds)) {
      throw new Error(`working_timeline[${i}].source_ids must be an array`);
    }
    for (const sid of sourceIds) {
      if (typeof sid !== 'string') {
        throw new Error(`working_timeline[${i}].source_ids must be strings`);
      }
      if (!evidenceIds.has(sid)) {
        throw new Error(
          `working_timeline[${i}].source_ids references missing evidence_index id: ${sid}`
        );
      }
    }
    if (t.verified !== undefined && typeof t.verified !== 'boolean') {
      throw new Error(`working_timeline[${i}].verified must be a boolean`);
    }
  }

  const entities = obj.key_entities;
  if (!Array.isArray(entities)) {
    throw new Error('key_entities must be an array');
  }
  for (let i = 0; i < entities.length; i++) {
    const item = entities[i];
    if (!item || typeof item !== 'object') {
      throw new Error(`key_entities[${i}] must be an object`);
    }
    const e = item as Record<string, unknown>;
    if (typeof e.name !== 'string') {
      throw new Error(`key_entities[${i}].name must be a string`);
    }
    if (!ENTITY_TYPES.has(String(e.type))) {
      throw new Error(
        `key_entities[${i}].type must be person, org, domain, location, handle, or other`
      );
    }
    if (!Array.isArray(e.source_refs)) {
      throw new Error(`key_entities[${i}].source_refs must be an array`);
    }
  }

  const ct = obj.contradictions_tensions;
  if (!Array.isArray(ct)) {
    throw new Error('contradictions_tensions must be an array');
  }
  for (let i = 0; i < ct.length; i++) {
    const item = ct[i];
    if (!item || typeof item !== 'object') {
      throw new Error(`contradictions_tensions[${i}] must be an object`);
    }
    const c = item as Record<string, unknown>;
    if (typeof c.issue !== 'string') {
      throw new Error(`contradictions_tensions[${i}].issue must be a string`);
    }
    const hasStructured = typeof c.statement_a === 'string' && typeof c.statement_b === 'string';
    if (hasStructured) {
      if (!ISSUE_TYPES.has(String(c.issue_type ?? ''))) {
        throw new Error(
          `contradictions_tensions[${i}].issue_type must be one of: date, count, identity, location, claim, other`
        );
      }
      if (typeof c.why_it_matters !== 'string') {
        throw new Error(`contradictions_tensions[${i}].why_it_matters must be a string`);
      }
      const aRefs = c.statement_a_refs;
      if (!Array.isArray(aRefs)) {
        throw new Error(`contradictions_tensions[${i}].statement_a_refs must be an array`);
      }
      for (const ref of aRefs) {
        if (typeof ref !== 'string' || !evidenceIds.has(ref)) {
          throw new Error(
            `contradictions_tensions[${i}].statement_a_refs must reference evidence_index ids`
          );
        }
      }
      const bRefs = c.statement_b_refs;
      if (!Array.isArray(bRefs)) {
        throw new Error(`contradictions_tensions[${i}].statement_b_refs must be an array`);
      }
      for (const ref of bRefs) {
        if (typeof ref !== 'string' || !evidenceIds.has(ref)) {
          throw new Error(
            `contradictions_tensions[${i}].statement_b_refs must reference evidence_index ids`
          );
        }
      }
      const resTasks = c.resolution_tasks;
      if (resTasks !== undefined && !Array.isArray(resTasks)) {
        throw new Error(`contradictions_tensions[${i}].resolution_tasks must be an array`);
      }
      if (Array.isArray(resTasks)) {
        for (let j = 0; j < resTasks.length; j++) {
          if (typeof resTasks[j] !== 'string') {
            throw new Error(`contradictions_tensions[${i}].resolution_tasks[${j}] must be a string`);
          }
        }
      }
    } else {
      if (typeof c.details !== 'string') {
        throw new Error(`contradictions_tensions[${i}].details must be a string`);
      }
      if (!Array.isArray(c.source_refs)) {
        throw new Error(
          `contradictions_tensions[${i}].source_refs must be an array`
        );
      }
      for (const ref of c.source_refs as string[]) {
        if (typeof ref !== 'string') {
          throw new Error(`contradictions_tensions[${i}].source_refs must be strings`);
        }
      }
    }
  }

  const vt = obj.verification_tasks;
  if (!Array.isArray(vt)) {
    throw new Error('verification_tasks must be an array');
  }
  for (let i = 0; i < vt.length; i++) {
    const item = vt[i];
    if (!item || typeof item !== 'object') {
      throw new Error(`verification_tasks[${i}] must be an object`);
    }
    const v = item as Record<string, unknown>;
    if (typeof v.task !== 'string') {
      throw new Error(`verification_tasks[${i}].task must be a string`);
    }
    if (!PRIORITY_VALUES.has(String(v.priority))) {
      throw new Error(
        `verification_tasks[${i}].priority must be high, medium, or low`
      );
    }
    if (!Array.isArray(v.suggested_queries)) {
      throw new Error(
        `verification_tasks[${i}].suggested_queries must be an array`
      );
    }
  }

  const es = obj.evidence_strength;
  if (es !== undefined) {
    if (!Array.isArray(es)) {
      throw new Error('evidence_strength must be an array');
    }
    const STRENGTH_RATINGS = new Set(['high', 'medium', 'low']);
    for (let i = 0; i < es.length; i++) {
      const item = es[i];
      if (!item || typeof item !== 'object') {
        throw new Error(`evidence_strength[${i}] must be an object`);
      }
      const e = item as Record<string, unknown>;
      if (typeof e.theme !== 'string') {
        throw new Error(`evidence_strength[${i}].theme must be a string`);
      }
      if (typeof e.results_count !== 'number') {
        throw new Error(`evidence_strength[${i}].results_count must be a number`);
      }
      if (typeof e.saved_links_count !== 'number') {
        throw new Error(`evidence_strength[${i}].saved_links_count must be a number`);
      }
      if (typeof e.wayback_count !== 'number') {
        throw new Error(`evidence_strength[${i}].wayback_count must be a number`);
      }
      if (typeof e.note_count !== 'number') {
        throw new Error(`evidence_strength[${i}].note_count must be a number`);
      }
      if (typeof e.corroboration_estimate !== 'string') {
        throw new Error(`evidence_strength[${i}].corroboration_estimate must be a string`);
      }
      if (!STRENGTH_RATINGS.has(String(e.strength_rating))) {
        throw new Error(
          `evidence_strength[${i}].strength_rating must be high, medium, or low`
        );
      }
    }
  }

  const hyp = obj.hypotheses;
  if (hyp !== undefined) {
    if (!Array.isArray(hyp)) {
      throw new Error('hypotheses must be an array');
    }
    const LIKELIHOOD = new Set(['high', 'medium', 'low']);
    for (let i = 0; i < hyp.length; i++) {
      const item = hyp[i];
      if (!item || typeof item !== 'object') {
        throw new Error(`hypotheses[${i}] must be an object`);
      }
      const h = item as Record<string, unknown>;
      if (typeof h.statement !== 'string') {
        throw new Error(`hypotheses[${i}].statement must be a string`);
      }
      if (!LIKELIHOOD.has(String(h.likelihood ?? ''))) {
        throw new Error(`hypotheses[${i}].likelihood must be high, medium, or low`);
      }
      const ef = h.evidence_for;
      if (!Array.isArray(ef)) {
        throw new Error(`hypotheses[${i}].evidence_for must be an array`);
      }
      for (const ref of ef) {
        if (typeof ref !== 'string' || !evidenceIds.has(ref)) {
          throw new Error(`hypotheses[${i}].evidence_for ref "${ref}" not in evidence_index`);
        }
      }
      const ea = h.evidence_against;
      if (!Array.isArray(ea)) {
        throw new Error(`hypotheses[${i}].evidence_against must be an array`);
      }
      for (const ref of ea) {
        if (typeof ref !== 'string' || !evidenceIds.has(ref)) {
          throw new Error(`hypotheses[${i}].evidence_against ref "${ref}" not in evidence_index`);
        }
      }
      const ft = h.falsification_tests;
      if (!Array.isArray(ft)) {
        throw new Error(`hypotheses[${i}].falsification_tests must be an array`);
      }
      for (let j = 0; j < ft.length; j++) {
        if (typeof ft[j] !== 'string') {
          throw new Error(`hypotheses[${i}].falsification_tests[${j}] must be a string`);
        }
      }
    }
  }

  const cg = obj.critical_gaps;
  if (cg !== undefined) {
    if (!Array.isArray(cg)) {
      throw new Error('critical_gaps must be an array');
    }
    for (let i = 0; i < cg.length; i++) {
      const item = cg[i];
      if (!item || typeof item !== 'object') {
        throw new Error(`critical_gaps[${i}] must be an object`);
      }
      const g = item as Record<string, unknown>;
      if (typeof g.missing_item !== 'string') {
        throw new Error(`critical_gaps[${i}].missing_item must be a string`);
      }
      if (typeof g.why_it_matters !== 'string') {
        throw new Error(`critical_gaps[${i}].why_it_matters must be a string`);
      }
      if (typeof g.fastest_way_to_verify !== 'string') {
        throw new Error(`critical_gaps[${i}].fastest_way_to_verify must be a string`);
      }
      const sq = g.suggested_queries;
      if (!Array.isArray(sq)) {
        throw new Error(`critical_gaps[${i}].suggested_queries must be an array`);
      }
      for (let j = 0; j < sq.length; j++) {
        if (typeof sq[j] !== 'string') {
          throw new Error(`critical_gaps[${i}].suggested_queries[${j}] must be a string`);
        }
      }
    }
  }

  const scs = obj.source_credibility_summary;
  if (scs !== undefined && scs !== null && typeof scs !== 'string') {
    obj.source_credibility_summary = String(scs);
  }

  const ch = obj.changes_since_last_version;
  if (ch !== undefined) {
    if (!Array.isArray(ch)) {
      throw new Error('changes_since_last_version must be an array');
    }
    const KINDS = new Set(['added', 'removed', 'modified']);
    for (let i = 0; i < ch.length; i++) {
      const item = ch[i];
      if (!item || typeof item !== 'object') {
        throw new Error(`changes_since_last_version[${i}] must be an object`);
      }
      const c = item as Record<string, unknown>;
      if (typeof c.section !== 'string') {
        throw new Error(`changes_since_last_version[${i}].section must be a string`);
      }
      if (!KINDS.has(String(c.kind ?? ''))) {
        throw new Error(`changes_since_last_version[${i}].kind must be added, removed, or modified`);
      }
      if (typeof c.label !== 'string') {
        throw new Error(`changes_since_last_version[${i}].label must be a string`);
      }
      if (c.detail !== undefined && typeof c.detail !== 'string') {
        throw new Error(`changes_since_last_version[${i}].detail must be a string`);
      }
    }
  }

  return obj as unknown as BriefJson;
}

/** Phase 10.1: deterministic heuristic summary of source credibility from evidence_index only. No AI. */
const NEWS_DOMAINS = [
  'nytimes.com', 'bbc.com', 'reuters.com', 'apnews.com', 'washingtonpost.com',
  'theguardian.com', 'npr.org', 'cnn.com', 'abcnews.go.com', 'cbsnews.com',
  'nbcnews.com', 'pbs.org', 'aljazeera.com', 'axios.com', 'politico.com',
  'bloomberg.com', 'wsj.com', 'ft.com', 'economist.com', 'latimes.com',
  'usatoday.com', 'usnews.com', 'newsweek.com', 'time.com',
];
const SOCIAL_DOMAINS = [
  'twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'tiktok.com', 'reddit.com',
  'youtube.com', 'linkedin.com', 'threads.net', 'snapchat.com',
];

function classifyEvidenceEntry(entry: { type?: string; url?: string }): 'official' | 'established_news' | 'social' | 'internal' | 'unverified' {
  const type = (entry.type ?? '').toLowerCase();
  if (type === 'note' || type === 'confidential') return 'internal';
  const url = (entry.url ?? '').toLowerCase();
  if (!url) return 'unverified';
  if (url.endsWith('.gov') || url.includes('.gov/')) return 'official';
  if (NEWS_DOMAINS.some((d) => url.includes(d))) return 'established_news';
  if (SOCIAL_DOMAINS.some((d) => url.includes(d))) return 'social';
  return 'unverified';
}

export function computeSourceCredibilitySummary(evidenceIndex: EvidenceIndex): string {
  let official = 0, establishedNews = 0, social = 0, internal = 0, unverified = 0;
  const entries = evidenceIndex && typeof evidenceIndex === 'object' && !Array.isArray(evidenceIndex)
    ? Object.values(evidenceIndex)
    : [];
  for (const entry of entries) {
    const e = entry && typeof entry === 'object' ? entry : {};
    switch (classifyEvidenceEntry(e)) {
      case 'official': official++; break;
      case 'established_news': establishedNews++; break;
      case 'social': social++; break;
      case 'internal': internal++; break;
      default: unverified++; break;
    }
  }
  const total = official + establishedNews + social + internal + unverified;
  if (total === 0) return 'No evidence index entries; credibility cannot be assessed.';
  const strong = official + establishedNews;
  const weak = social + unverified;
  if (internal >= total * 0.5) {
    return 'Primary reliance is on internal notes and confidential material; limited publicly verifiable documentation.';
  }
  if (strong >= total * 0.5) {
    return 'Most evidence is derived from official government records and established news sources.';
  }
  if (weak >= total * 0.5) {
    return 'The brief relies heavily on social media and unverified sources; official corroboration is limited.';
  }
  return 'Evidence is mixed: some official documentation, but significant reliance on unverified or social sources.';
}
