/**
 * Phase 7.1 — Validator test (legacy + structured contradictions).
 * Run: node --experimental-strip-types scripts/test-phase-7-1-validator.mjs
 * Or: npx tsx scripts/test-phase-7-1-validator.mjs  (if you rename to .ts and use validateBriefJson from schema)
 *
 * This script builds minimal briefs and verifies they pass validation when run through
 * validateBriefJson. Since Node cannot require the TS schema directly, run the validator
 * in the app (e.g. generate a brief) or use tsx to run a .ts version that imports from '@/lib/ai/brief-schema'.
 *
 * Below: example payloads for manual verification and for use in a .ts test.
 */

// Minimal evidence_index for refs
const EVIDENCE_INDEX = {
  r1: { type: 'result', description: 'Result 1', url: 'https://example.com/1' },
  r2: { type: 'result', description: 'Result 2', url: 'https://example.com/2' },
  s1: { type: 'saved', description: 'Saved link', url: null },
};

/** Legacy contradictions_tensions item (old briefs) */
export const LEGACY_CONTRADICTION = {
  issue: 'Conflicting dates for event',
  details: 'Source A says March 2020; source B says Q2 2020.',
  source_refs: ['r1', 'r2'],
};

/** Structured contradictions_tensions item (Phase 7.1) */
export const STRUCTURED_CONTRADICTION = {
  issue: 'Date discrepancy in reported event timing',
  issue_type: 'date',
  statement_a: 'Source A states the event occurred on 2020-03-15.',
  statement_a_refs: ['r1', 's1'],
  statement_b: 'Source B indicates the event occurred in Q2 2020 (April–June).',
  statement_b_refs: ['r2'],
  why_it_matters:
    'This does not add up because the timeline cannot accommodate both dates without an additional missing event or misreporting.',
  resolution_tasks: [
    'Locate primary record for the event date (court docket / filing / official notice).',
    'Check archived versions to confirm the published claim.',
  ],
};

/** Full minimal brief with LEGACY contradiction (for backward-compat check) */
export const LEGACY_BRIEF = {
  executive_overview: 'Test overview.',
  evidence_index: EVIDENCE_INDEX,
  working_timeline: [
    {
      time_window: '2020',
      event: 'Test event',
      confidence: 'medium',
      basis: 'public',
      source_ids: ['r1'],
    },
  ],
  key_entities: [{ name: 'Entity', type: 'person', source_refs: ['r1'] }],
  contradictions_tensions: [LEGACY_CONTRADICTION],
  verification_tasks: [{ task: 'Verify', priority: 'high', suggested_queries: [] }],
};

/** Full minimal brief with STRUCTURED contradiction */
export const STRUCTURED_BRIEF = {
  ...LEGACY_BRIEF,
  contradictions_tensions: [STRUCTURED_CONTRADICTION],
};

console.log('Phase 7.1 validator test data (use with validateBriefJson in app or tsx):');
console.log(JSON.stringify({ LEGACY_BRIEF, STRUCTURED_BRIEF }, null, 2));
