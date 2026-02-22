/**
 * Phase 7.1 — Validator test. Run: npx tsx scripts/test-phase-7-1-validator.ts
 * Verifies validateBriefJson accepts legacy and structured contradictions.
 */

import { validateBriefJson } from '../lib/ai/brief-schema';

const EVIDENCE_INDEX = {
  r1: { type: 'result', description: 'Result 1', url: 'https://example.com/1' },
  r2: { type: 'result', description: 'Result 2', url: 'https://example.com/2' },
  s1: { type: 'saved', description: 'Saved link', url: null },
};

const LEGACY_BRIEF = {
  executive_overview: 'Test overview.',
  evidence_index: EVIDENCE_INDEX,
  working_timeline: [
    {
      time_window: '2020',
      event: 'Test event',
      confidence: 'medium' as const,
      basis: 'public' as const,
      source_ids: ['r1'],
    },
  ],
  key_entities: [{ name: 'Entity', type: 'person' as const, source_refs: ['r1'] }],
  contradictions_tensions: [
    {
      issue: 'Conflicting dates',
      details: 'Source A says March; source B says Q2.',
      source_refs: ['r1', 'r2'],
    },
  ],
  verification_tasks: [{ task: 'Verify', priority: 'high' as const, suggested_queries: [] }],
};

const STRUCTURED_BRIEF = {
  ...LEGACY_BRIEF,
  contradictions_tensions: [
    {
      issue: 'Date discrepancy in reported event timing',
      issue_type: 'date' as const,
      statement_a: 'Source A states the event occurred on 2020-03-15.',
      statement_a_refs: ['r1', 's1'],
      statement_b: 'Source B indicates the event occurred in Q2 2020.',
      statement_b_refs: ['r2'],
      why_it_matters:
        'This does not add up because the timeline cannot accommodate both dates.',
      resolution_tasks: ['Locate primary record.', 'Check archived versions.'],
    },
  ],
};

function run() {
  console.log('Phase 7.1 — Validator test\n');

  try {
    const outLegacy = validateBriefJson(LEGACY_BRIEF);
    console.log('OK Legacy brief: validateBriefJson accepts legacy contradictions_tensions');
    if (outLegacy.contradictions_tensions[0]) {
      const c = outLegacy.contradictions_tensions[0];
      console.log('  - issue:', c.issue);
      console.log('  - details:', (c as { details?: string }).details);
      console.log('  - source_refs:', (c as { source_refs?: string[] }).source_refs);
    }
  } catch (e) {
    console.error('FAIL Legacy:', e instanceof Error ? e.message : e);
    process.exit(1);
  }

  try {
    const outStructured = validateBriefJson(STRUCTURED_BRIEF);
    console.log('OK Structured brief: validateBriefJson accepts structured contradictions_tensions');
    const c = outStructured.contradictions_tensions[0];
    if (c) {
      console.log('  - issue:', c.issue);
      console.log('  - issue_type:', c.issue_type);
      console.log('  - statement_a:', c.statement_a);
      console.log('  - statement_a_refs:', c.statement_a_refs);
      console.log('  - statement_b:', c.statement_b);
      console.log('  - statement_b_refs:', c.statement_b_refs);
      console.log('  - why_it_matters:', c.why_it_matters);
      console.log('  - resolution_tasks:', c.resolution_tasks);
    }
  } catch (e) {
    console.error('FAIL Structured:', e instanceof Error ? e.message : e);
    process.exit(1);
  }

  // Reject invalid issue_type
  const badIssueType = {
    ...STRUCTURED_BRIEF,
    contradictions_tensions: [
      {
        ...STRUCTURED_BRIEF.contradictions_tensions[0],
        issue_type: 'invalid_type',
      },
    ],
  };
  try {
    validateBriefJson(badIssueType);
    console.error('FAIL Expected validation error for invalid issue_type');
    process.exit(1);
  } catch {
    console.log('OK Invalid issue_type is rejected');
  }

  // Reject refs not in evidence_index (structured)
  const badRefs = {
    ...STRUCTURED_BRIEF,
    contradictions_tensions: [
      {
        ...STRUCTURED_BRIEF.contradictions_tensions[0],
        statement_a_refs: ['r1', 'nonexistent'],
      },
    ],
  };
  try {
    validateBriefJson(badRefs);
    console.error('FAIL Expected validation error for ref not in evidence_index');
    process.exit(1);
  } catch {
    console.log('OK statement_a_refs must exist in evidence_index');
  }

  console.log('\nAll Phase 7.1 validator checks passed.');
}

run();
