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

export interface BriefWorkingTimelineItem {
  time_window: string;
  event: string;
  confidence: 'high' | 'medium' | 'low';
  basis: 'public' | 'note' | 'confidential' | 'unverified';
  source_ids: string[];
  source_refs?: string[];
}

export interface BriefKeyEntity {
  name: string;
  type: 'person' | 'org' | 'domain' | 'location' | 'handle' | 'other';
  source_refs: string[];
}

export interface BriefContradictionsTensions {
  issue: string;
  details: string;
  source_refs: string[];
}

export interface BriefVerificationTask {
  task: string;
  priority: 'high' | 'medium' | 'low';
  suggested_queries: string[];
}

export type EvidenceIndex = Record<
  string,
  { type?: string; description?: string; url?: string }
>;

export interface BriefJson {
  executive_overview: string;
  working_timeline: BriefWorkingTimelineItem[];
  evidence_index: EvidenceIndex;
  key_entities: BriefKeyEntity[];
  contradictions_tensions: BriefContradictionsTensions[];
  verification_tasks: BriefVerificationTask[];
}

export function validateBriefJson(raw: unknown): BriefJson {
  if (raw === null || typeof raw !== 'object') {
    throw new Error('Brief must be a JSON object');
  }
  const obj = raw as Record<string, unknown>;

  const exec = obj.executive_overview;
  if (typeof exec !== 'string') {
    throw new Error('executive_overview must be a string');
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
    if (typeof c.details !== 'string') {
      throw new Error(`contradictions_tensions[${i}].details must be a string`);
    }
    if (!Array.isArray(c.source_refs)) {
      throw new Error(
        `contradictions_tensions[${i}].source_refs must be an array`
      );
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

  return obj as unknown as BriefJson;
}
