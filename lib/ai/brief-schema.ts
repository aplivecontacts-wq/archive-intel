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
  /** Optional: from saved_links source_tier (primary/secondary) for weighting. */
  primary_sources_count?: number;
  secondary_sources_count?: number;
  /** Evidence index IDs that support this theme. Must exist in evidence_index. Used to derive P/S counts. */
  supporting_refs?: string[];
}

export type EvidenceIndex = Record<
  string,
  { type?: string; description?: string; url?: string; source_tier?: 'primary' | 'secondary' | null; official_source?: boolean }
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

/** Phase 11.1: optional adversarial collapse testing — "what would break this?" */
export interface BriefCollapseTest {
  claim_or_hypothesis: string;
  critical_assumptions: string[];
  single_points_of_failure: string[];
  what_would_falsify: string[];
  highest_leverage_next_step: string;
  supporting_refs: string[];
}

/** Phase 11.2: optional incentive matrix — who benefits if narrative A vs B? */
export interface BriefIncentiveMatrixEntry {
  actor: string;
  role: string;
  narrative_a_incentives: string[];
  narrative_b_incentives: string[];
  exposure_if_false: string[];
  supporting_refs: string[];
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
  /** Phase 11.1: optional adversarial collapse tests — what would break this */
  collapse_tests?: BriefCollapseTest[];
  /** Phase 11.2: optional incentive matrix — who benefits if narrative A vs B */
  incentive_matrix?: BriefIncentiveMatrixEntry[];
  /** Phase 11.3: deterministic structural integrity score (computed post-validation, no AI) */
  integrity_score?: BriefIntegrityScore;
  /** Phase 11.4: deterministic evidence network — central/isolated nodes, single-point failures */
  evidence_network?: BriefEvidenceNetwork;
  /** Phase 11.5: deterministic coherence alerts — internal consistency scan */
  coherence_alerts?: BriefCoherenceAlert[];
  /** Phase 4 (Cohesion): optional entity summary panel (from case_entities) */
  entity_summary_panel?: {
    intro?: string;
    top_entities: { name: string; type: string; mention_count: number }[];
    notable_connections: string[];
  };
  /** Phase 4 (Cohesion): optional evidence summary panel (from counts + evidence_index) */
  evidence_summary_panel?: {
    intro?: string;
    totals: { results: number; saved_links: number; notes: number; wayback_results: number };
    top_sources: { label: string; count: number }[];
    coverage_notes: string[];
  };
}

export interface BriefCoherenceAlert {
  severity: 'high' | 'medium' | 'low';
  alert: string;
  why_it_matters: string;
  affected_sections: string[];
  related_evidence_ids: string[];
}

export interface BriefEvidenceNetworkNode {
  id: string;
  mention_count: number;
  type: string;
  url?: string;
}

export interface BriefSinglePointFailure {
  claim_area: string;
  depends_on_ids: string[];
}

export interface BriefEvidenceNetwork {
  central_nodes: BriefEvidenceNetworkNode[];
  isolated_nodes: BriefEvidenceNetworkNode[];
  single_point_failures: BriefSinglePointFailure[];
}

export interface BriefIntegrityScore {
  score_0_100: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  drivers: string[];
  weak_points: string[];
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
    const rawBasis = String(t.basis ?? '').toLowerCase();
    if (!BASIS_VALUES.has(rawBasis)) {
      // Coerce AI slip-ups (e.g. "published", "official") to valid value so brief doesn't fail
      const fallback =
        rawBasis === 'published' || rawBasis === 'official' ? 'public' : 'unverified';
      (t as { basis: string }).basis = fallback;
    } else {
      (t as { basis: string }).basis = rawBasis as 'public' | 'note' | 'confidential' | 'unverified';
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
      if (e.primary_sources_count !== undefined && typeof e.primary_sources_count !== 'number') {
        throw new Error(`evidence_strength[${i}].primary_sources_count must be a number`);
      }
      if (e.secondary_sources_count !== undefined && typeof e.secondary_sources_count !== 'number') {
        throw new Error(`evidence_strength[${i}].secondary_sources_count must be a number`);
      }
      const supportingRefs = e.supporting_refs;
      if (supportingRefs === undefined || supportingRefs === null) {
        (item as Record<string, unknown>).supporting_refs = [];
      } else if (!Array.isArray(supportingRefs)) {
        throw new Error(`evidence_strength[${i}].supporting_refs must be an array`);
      } else {
        for (let j = 0; j < supportingRefs.length; j++) {
          const ref = supportingRefs[j];
          if (typeof ref !== 'string') {
            throw new Error(`evidence_strength[${i}].supporting_refs[${j}] must be a string`);
          }
          if (!evidenceIds.has(ref)) {
            throw new Error(`evidence_strength[${i}].supporting_refs[${j}] must reference an evidence_index id`);
          }
        }
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

  const collapseTests = obj.collapse_tests;
  if (collapseTests !== undefined) {
    if (!Array.isArray(collapseTests)) {
      throw new Error('collapse_tests must be an array');
    }
    for (let i = 0; i < collapseTests.length; i++) {
      const item = collapseTests[i];
      if (!item || typeof item !== 'object') {
        throw new Error(`collapse_tests[${i}] must be an object`);
      }
      const c = item as Record<string, unknown>;
      if (typeof c.claim_or_hypothesis !== 'string') {
        throw new Error(`collapse_tests[${i}].claim_or_hypothesis must be a string`);
      }
      const ca = c.critical_assumptions;
      if (!Array.isArray(ca)) {
        throw new Error(`collapse_tests[${i}].critical_assumptions must be an array`);
      }
      for (let j = 0; j < ca.length; j++) {
        if (typeof ca[j] !== 'string') {
          throw new Error(`collapse_tests[${i}].critical_assumptions[${j}] must be a string`);
        }
      }
      const spof = c.single_points_of_failure;
      if (!Array.isArray(spof)) {
        throw new Error(`collapse_tests[${i}].single_points_of_failure must be an array`);
      }
      for (let j = 0; j < spof.length; j++) {
        if (typeof spof[j] !== 'string') {
          throw new Error(`collapse_tests[${i}].single_points_of_failure[${j}] must be a string`);
        }
      }
      const wwf = c.what_would_falsify;
      if (!Array.isArray(wwf)) {
        throw new Error(`collapse_tests[${i}].what_would_falsify must be an array`);
      }
      for (let j = 0; j < wwf.length; j++) {
        if (typeof wwf[j] !== 'string') {
          throw new Error(`collapse_tests[${i}].what_would_falsify[${j}] must be a string`);
        }
      }
      if (typeof c.highest_leverage_next_step !== 'string') {
        throw new Error(`collapse_tests[${i}].highest_leverage_next_step must be a string`);
      }
      const refs = c.supporting_refs;
      if (!Array.isArray(refs)) {
        throw new Error(`collapse_tests[${i}].supporting_refs must be an array`);
      }
      for (let j = 0; j < refs.length; j++) {
        if (typeof refs[j] !== 'string' || !evidenceIds.has(refs[j] as string)) {
          throw new Error(
            `collapse_tests[${i}].supporting_refs[${j}] must reference an evidence_index id`
          );
        }
      }
    }
  }

  const im = obj.incentive_matrix;
  if (im !== undefined) {
    if (!Array.isArray(im)) {
      throw new Error('incentive_matrix must be an array');
    }
    for (let i = 0; i < im.length; i++) {
      const item = im[i];
      if (!item || typeof item !== 'object') {
        throw new Error(`incentive_matrix[${i}] must be an object`);
      }
      const m = item as Record<string, unknown>;
      if (typeof m.actor !== 'string') {
        throw new Error(`incentive_matrix[${i}].actor must be a string`);
      }
      if (typeof m.role !== 'string') {
        throw new Error(`incentive_matrix[${i}].role must be a string`);
      }
      const na = m.narrative_a_incentives;
      if (!Array.isArray(na)) {
        throw new Error(`incentive_matrix[${i}].narrative_a_incentives must be an array`);
      }
      for (let j = 0; j < na.length; j++) {
        if (typeof na[j] !== 'string') {
          throw new Error(`incentive_matrix[${i}].narrative_a_incentives[${j}] must be a string`);
        }
      }
      const nb = m.narrative_b_incentives;
      if (!Array.isArray(nb)) {
        throw new Error(`incentive_matrix[${i}].narrative_b_incentives must be an array`);
      }
      for (let j = 0; j < nb.length; j++) {
        if (typeof nb[j] !== 'string') {
          throw new Error(`incentive_matrix[${i}].narrative_b_incentives[${j}] must be a string`);
        }
      }
      const eif = m.exposure_if_false;
      if (!Array.isArray(eif)) {
        throw new Error(`incentive_matrix[${i}].exposure_if_false must be an array`);
      }
      for (let j = 0; j < eif.length; j++) {
        if (typeof eif[j] !== 'string') {
          throw new Error(`incentive_matrix[${i}].exposure_if_false[${j}] must be a string`);
        }
      }
      const refs = m.supporting_refs;
      if (!Array.isArray(refs)) {
        throw new Error(`incentive_matrix[${i}].supporting_refs must be an array`);
      }
      for (let j = 0; j < refs.length; j++) {
        if (typeof refs[j] !== 'string' || !evidenceIds.has(refs[j] as string)) {
          throw new Error(
            `incentive_matrix[${i}].supporting_refs[${j}] must reference an evidence_index id`
          );
        }
      }
    }
  }

  const scs = obj.source_credibility_summary;
  if (scs !== undefined && scs !== null && typeof scs !== 'string') {
    obj.source_credibility_summary = String(scs);
  }

  const isc = obj.integrity_score;
  if (isc !== undefined) {
    if (isc === null || typeof isc !== 'object' || Array.isArray(isc)) {
      throw new Error('integrity_score must be an object');
    }
    const is = isc as Record<string, unknown>;
    const score = is.score_0_100;
    if (typeof score !== 'number' || score < 0 || score > 100) {
      throw new Error('integrity_score.score_0_100 must be a number between 0 and 100');
    }
    const grades = new Set(['A', 'B', 'C', 'D', 'F']);
    if (!grades.has(String(is.grade ?? ''))) {
      throw new Error('integrity_score.grade must be one of A, B, C, D, F');
    }
    if (!Array.isArray(is.drivers)) {
      throw new Error('integrity_score.drivers must be an array');
    }
    if (is.drivers.length > 5) {
      throw new Error('integrity_score.drivers must have at most 5 items');
    }
    for (let i = 0; i < is.drivers.length; i++) {
      if (typeof is.drivers[i] !== 'string') {
        throw new Error(`integrity_score.drivers[${i}] must be a string`);
      }
    }
    if (!Array.isArray(is.weak_points)) {
      throw new Error('integrity_score.weak_points must be an array');
    }
    if (is.weak_points.length > 5) {
      throw new Error('integrity_score.weak_points must have at most 5 items');
    }
    for (let i = 0; i < is.weak_points.length; i++) {
      if (typeof is.weak_points[i] !== 'string') {
        throw new Error(`integrity_score.weak_points[${i}] must be a string`);
      }
    }
  }

  const en = obj.evidence_network;
  if (en !== undefined) {
    if (en === null || typeof en !== 'object' || Array.isArray(en)) {
      throw new Error('evidence_network must be an object');
    }
    const net = en as Record<string, unknown>;
    if (!Array.isArray(net.central_nodes)) {
      throw new Error('evidence_network.central_nodes must be an array');
    }
    for (let i = 0; i < (net.central_nodes as unknown[]).length; i++) {
      const n = (net.central_nodes as Record<string, unknown>[])[i];
      if (!n || typeof n !== 'object') throw new Error(`evidence_network.central_nodes[${i}] must be an object`);
      if (typeof n.id !== 'string') throw new Error(`evidence_network.central_nodes[${i}].id must be a string`);
      if (typeof n.mention_count !== 'number' || n.mention_count < 0) throw new Error(`evidence_network.central_nodes[${i}].mention_count must be a non-negative number`);
      if (typeof n.type !== 'string') throw new Error(`evidence_network.central_nodes[${i}].type must be a string`);
    }
    if (!Array.isArray(net.isolated_nodes)) {
      throw new Error('evidence_network.isolated_nodes must be an array');
    }
    for (let i = 0; i < (net.isolated_nodes as unknown[]).length; i++) {
      const n = (net.isolated_nodes as Record<string, unknown>[])[i];
      if (!n || typeof n !== 'object') throw new Error(`evidence_network.isolated_nodes[${i}] must be an object`);
      if (typeof n.id !== 'string') throw new Error(`evidence_network.isolated_nodes[${i}].id must be a string`);
      if (typeof n.mention_count !== 'number' || n.mention_count < 0) throw new Error(`evidence_network.isolated_nodes[${i}].mention_count must be a non-negative number`);
      if (typeof n.type !== 'string') throw new Error(`evidence_network.isolated_nodes[${i}].type must be a string`);
    }
    if (!Array.isArray(net.single_point_failures)) {
      throw new Error('evidence_network.single_point_failures must be an array');
    }
    for (let i = 0; i < (net.single_point_failures as unknown[]).length; i++) {
      const s = (net.single_point_failures as Record<string, unknown>[])[i];
      if (!s || typeof s !== 'object') throw new Error(`evidence_network.single_point_failures[${i}] must be an object`);
      if (typeof s.claim_area !== 'string') throw new Error(`evidence_network.single_point_failures[${i}].claim_area must be a string`);
      if (!Array.isArray(s.depends_on_ids)) throw new Error(`evidence_network.single_point_failures[${i}].depends_on_ids must be an array`);
    }
  }

  const ca = obj.coherence_alerts;
  if (ca !== undefined) {
    if (!Array.isArray(ca)) {
      throw new Error('coherence_alerts must be an array');
    }
    const severities = new Set(['high', 'medium', 'low']);
    for (let i = 0; i < ca.length; i++) {
      const a = (ca as Record<string, unknown>[])[i];
      if (!a || typeof a !== 'object') throw new Error(`coherence_alerts[${i}] must be an object`);
      if (!severities.has(String(a.severity ?? ''))) throw new Error(`coherence_alerts[${i}].severity must be high, medium, or low`);
      if (typeof a.alert !== 'string') throw new Error(`coherence_alerts[${i}].alert must be a string`);
      if (typeof a.why_it_matters !== 'string') throw new Error(`coherence_alerts[${i}].why_it_matters must be a string`);
      if (!Array.isArray(a.affected_sections)) throw new Error(`coherence_alerts[${i}].affected_sections must be an array`);
      if (!Array.isArray(a.related_evidence_ids)) throw new Error(`coherence_alerts[${i}].related_evidence_ids must be an array`);
    }
  }

  const esp = obj.entity_summary_panel;
  if (esp !== undefined && esp !== null) {
    if (typeof esp !== 'object' || Array.isArray(esp)) throw new Error('entity_summary_panel must be an object');
    const p = esp as Record<string, unknown>;
    if (!Array.isArray(p.top_entities)) throw new Error('entity_summary_panel.top_entities must be an array');
    for (let i = 0; i < (p.top_entities as unknown[]).length; i++) {
      const t = (p.top_entities as Record<string, unknown>[])[i];
      if (!t || typeof t !== 'object') throw new Error(`entity_summary_panel.top_entities[${i}] must be an object`);
      if (typeof t.name !== 'string') throw new Error(`entity_summary_panel.top_entities[${i}].name must be a string`);
      if (typeof t.type !== 'string') throw new Error(`entity_summary_panel.top_entities[${i}].type must be a string`);
      if (typeof t.mention_count !== 'number') throw new Error(`entity_summary_panel.top_entities[${i}].mention_count must be a number`);
    }
    if (!Array.isArray(p.notable_connections)) throw new Error('entity_summary_panel.notable_connections must be an array');
    for (let i = 0; i < (p.notable_connections as unknown[]).length; i++) {
      if (typeof (p.notable_connections as unknown[])[i] !== 'string') throw new Error(`entity_summary_panel.notable_connections[${i}] must be a string`);
    }
  }

  const evsp = obj.evidence_summary_panel;
  if (evsp !== undefined && evsp !== null) {
    if (typeof evsp !== 'object' || Array.isArray(evsp)) throw new Error('evidence_summary_panel must be an object');
    const p = evsp as Record<string, unknown>;
    if (!p.totals || typeof p.totals !== 'object' || Array.isArray(p.totals)) throw new Error('evidence_summary_panel.totals must be an object');
    const tot = p.totals as Record<string, unknown>;
    if (typeof tot.results !== 'number') throw new Error('evidence_summary_panel.totals.results must be a number');
    if (typeof tot.saved_links !== 'number') throw new Error('evidence_summary_panel.totals.saved_links must be a number');
    if (typeof tot.notes !== 'number') throw new Error('evidence_summary_panel.totals.notes must be a number');
    if (typeof tot.wayback_results !== 'number') throw new Error('evidence_summary_panel.totals.wayback_results must be a number');
    if (!Array.isArray(p.top_sources)) throw new Error('evidence_summary_panel.top_sources must be an array');
    for (let i = 0; i < (p.top_sources as unknown[]).length; i++) {
      const s = (p.top_sources as Record<string, unknown>[])[i];
      if (!s || typeof s !== 'object') throw new Error(`evidence_summary_panel.top_sources[${i}] must be an object`);
      if (typeof s.label !== 'string') throw new Error(`evidence_summary_panel.top_sources[${i}].label must be a string`);
      if (typeof s.count !== 'number') throw new Error(`evidence_summary_panel.top_sources[${i}].count must be a number`);
    }
    if (!Array.isArray(p.coverage_notes)) throw new Error('evidence_summary_panel.coverage_notes must be an array');
    for (let i = 0; i < (p.coverage_notes as unknown[]).length; i++) {
      if (typeof (p.coverage_notes as unknown[])[i] !== 'string') throw new Error(`evidence_summary_panel.coverage_notes[${i}] must be a string`);
    }
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

/** Single source of truth for source credibility. Used by integrity score, coherence alerts, and summary. */
const NEWS_DOMAINS = [
  'nytimes.com', 'bbc.com', 'reuters.com', 'apnews.com', 'washingtonpost.com',
  'theguardian.com', 'npr.org', 'cnn.com', 'abcnews.go.com', 'cbsnews.com',
  'nbcnews.com', 'pbs.org', 'aljazeera.com', 'axios.com', 'politico.com',
  'bloomberg.com', 'wsj.com', 'ft.com', 'economist.com', 'latimes.com',
  'usatoday.com', 'usnews.com', 'newsweek.com', 'time.com',
  'afp.com', 'ap.org', 'dw.com', 'cbc.ca', 'abc.net.au', 'scmp.com', 'france24.com',
  'theconversation.com', 'nature.com', 'science.org', 'statnews.com',
];
const SOCIAL_DOMAINS = [
  'twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'tiktok.com', 'reddit.com',
  'youtube.com', 'linkedin.com', 'threads.net', 'snapchat.com',
];
/** Official URL patterns: .gov, .gov.xx, .mil, .europa.eu, common official hostnames */
function isOfficialUrl(url: string): boolean {
  const u = url.toLowerCase();
  if (u.endsWith('.gov') || u.includes('.gov/') || u.includes('.gov.')) return true;
  if (u.endsWith('.mil') || u.includes('.mil/') || u.includes('.mil.')) return true;
  if (u.includes('.europa.eu') || u.includes('europa.eu/')) return true;
  if (u.includes('un.org') || u.includes('state.gov') || u.includes('who.int')) return true;
  return false;
}

export type CredibilityCategory = 'official' | 'established_news' | 'social' | 'internal' | 'unverified' | 'other';

export function classifyEvidenceEntry(entry: { type?: string; url?: string; source_tier?: string | null; official_source?: boolean }): CredibilityCategory {
  const e = entry && typeof entry === 'object' ? entry : {};
  if (e.official_source === true) return 'official';
  const type = (e.type ?? '').toLowerCase();
  if (type === 'note' || type === 'confidential') return 'internal';
  const url = (e.url ?? '').toLowerCase();
  if (!url) return 'unverified';
  if (isOfficialUrl(url)) return 'official';
  if (NEWS_DOMAINS.some((d) => url.includes(d))) return 'established_news';
  if (SOCIAL_DOMAINS.some((d) => url.includes(d))) return 'social';
  return 'other';
}

/** Weight 0–1 for credibility score. Primary and analyst-marked official get full weight. */
export function getCredibilityWeight(entry: { type?: string; url?: string; source_tier?: string | null; official_source?: boolean }): number {
  const e = entry && typeof entry === 'object' ? entry : {};
  if (e.official_source === true) return 1.0;
  const tier = e.source_tier;
  if (tier === 'primary') return 1.0;
  if (tier === 'secondary') return 0.8;
  switch (classifyEvidenceEntry(e)) {
    case 'official': return 1.0;
    case 'established_news': return 1.0;
    case 'other': return 0.5;
    case 'social': return 0.35;
    case 'internal': return 0.3;
    default: return 0.2;
  }
}

export function computeSourceCredibilitySummary(evidenceIndex: EvidenceIndex): string {
  const entries = evidenceIndex && typeof evidenceIndex === 'object' && !Array.isArray(evidenceIndex)
    ? Object.values(evidenceIndex)
    : [];
  if (entries.length === 0) return 'No evidence index entries; credibility cannot be assessed.';
  let weightSum = 0;
  let officialCount = 0, primaryCount = 0, secondaryCount = 0;
  for (const entry of entries) {
    const e = entry && typeof entry === 'object' ? entry : {};
    weightSum += getCredibilityWeight(e);
    if (classifyEvidenceEntry(e) === 'official') officialCount++;
    if ((e as { source_tier?: string }).source_tier === 'primary') primaryCount++;
    if ((e as { source_tier?: string }).source_tier === 'secondary') secondaryCount++;
  }
  const avgWeight = weightSum / entries.length;
  const tierNote =
    primaryCount > 0 || secondaryCount > 0
      ? ` (${primaryCount} primary, ${secondaryCount} secondary source${primaryCount + secondaryCount !== 1 ? 's' : ''} marked by analyst)`
      : '';
  if (avgWeight >= 0.85) {
    return 'Evidence draws strongly on official, established news, or analyst-marked primary sources.' + tierNote;
  }
  if (avgWeight >= 0.5) {
    return 'Evidence is mixed: a blend of official, news, analyst-marked, and other sources.' + tierNote;
  }
  if (avgWeight >= 0.3) {
    return 'Significant reliance on social or internal material; consider adding analyst-marked primary or official sources.' + tierNote;
  }
  return 'Limited high-weight sources; adding official or analyst-marked primary/secondary sources would strengthen the brief.' + tierNote;
}
