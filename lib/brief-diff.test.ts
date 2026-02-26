/**
 * Tests for brief-diff: changes only exec overview, timeline, entities, contradictions, verification_tasks.
 * Hypotheses, critical_gaps, evidence_strength are NOT included in the diff (simplified panel).
 */
import { describe, it, expect } from 'vitest';
import { computeChangesSinceLastVersion } from './brief-diff';
import type { BriefJson } from '@/lib/ai/brief-schema';

function minimalBrief(overrides: Partial<BriefJson> = {}): BriefJson {
  return {
    executive_overview: '',
    working_timeline: [],
    evidence_index: {},
    key_entities: [],
    contradictions_tensions: [],
    verification_tasks: [],
    ...overrides,
  };
}

describe('computeChangesSinceLastVersion', () => {
  it('returns empty when prev and next are identical', () => {
    const b = minimalBrief({ executive_overview: 'Same' });
    expect(computeChangesSinceLastVersion(b, b)).toEqual([]);
  });

  it('reports executive_overview change', () => {
    const prev = minimalBrief({ executive_overview: 'Old' });
    const next = minimalBrief({ executive_overview: 'New' });
    const out = computeChangesSinceLastVersion(prev, next);
    expect(out).toHaveLength(1);
    expect(out[0].section).toBe('executive_overview');
    expect(out[0].kind).toBe('modified');
  });

  it('reports working_timeline added event', () => {
    const prev = minimalBrief();
    const next = minimalBrief({
      working_timeline: [
        {
          time_window: 'T1',
          event: 'Something happened',
          confidence: 'high',
          basis: 'public',
          source_ids: ['e1'],
        },
      ],
    });
    const out = computeChangesSinceLastVersion(prev, next);
    expect(out.some((c) => c.section === 'working_timeline' && c.kind === 'added')).toBe(true);
  });

  it('reports key_entities added', () => {
    const prev = minimalBrief();
    const next = minimalBrief({
      key_entities: [{ name: 'Alice', type: 'person', source_refs: ['e1'] }],
    });
    const out = computeChangesSinceLastVersion(prev, next);
    expect(out.some((c) => c.section === 'key_entities' && c.kind === 'added')).toBe(true);
  });

  it('reports contradictions_tensions added', () => {
    const prev = minimalBrief();
    const next = minimalBrief({
      contradictions_tensions: [{ issue: 'Date conflict', resolution_tasks: [] }],
    });
    const out = computeChangesSinceLastVersion(prev, next);
    expect(out.some((c) => c.section === 'contradictions_tensions' && c.kind === 'added')).toBe(true);
  });

  it('reports verification_tasks added', () => {
    const prev = minimalBrief();
    const next = minimalBrief({
      verification_tasks: [{ task: 'Verify date', priority: 'high', suggested_queries: [] }],
    });
    const out = computeChangesSinceLastVersion(prev, next);
    expect(out.some((c) => c.section === 'verification_tasks' && c.kind === 'added')).toBe(true);
  });

  it('does NOT report hypotheses changes (excluded from diff)', () => {
    const prev = minimalBrief({ hypotheses: [] });
    const next = minimalBrief({
      hypotheses: [{ statement: 'X did it', likelihood: 'high', evidence_for: [], evidence_against: [], falsification_tests: [] }],
    });
    const out = computeChangesSinceLastVersion(prev, next);
    expect(out.every((c) => c.section !== 'hypotheses')).toBe(true);
  });

  it('does NOT report critical_gaps changes (excluded from diff)', () => {
    const prev = minimalBrief({ critical_gaps: [] });
    const next = minimalBrief({
      critical_gaps: [{ missing_item: 'Witness', why_it_matters: 'Key', fastest_way_to_verify: 'Interview', suggested_queries: [] }],
    });
    const out = computeChangesSinceLastVersion(prev, next);
    expect(out.every((c) => c.section !== 'critical_gaps')).toBe(true);
  });

  it('does NOT report evidence_strength changes (excluded from diff)', () => {
    const prev = minimalBrief({ evidence_strength: [] });
    const next = minimalBrief({
      evidence_strength: [
        { theme: 'Dates', results_count: 1, saved_links_count: 0, wayback_count: 0, note_count: 0, corroboration_estimate: 'low', strength_rating: 'low', supporting_refs: [] },
      ],
    });
    const out = computeChangesSinceLastVersion(prev, next);
    expect(out.every((c) => c.section !== 'evidence_strength')).toBe(true);
  });

  it('every change has section, kind, and label', () => {
    const prev = minimalBrief({ executive_overview: 'A' });
    const next = minimalBrief({
      executive_overview: 'B',
      working_timeline: [
        { time_window: 'T', event: 'E', confidence: 'high', basis: 'public', source_ids: [] },
      ],
    });
    const out = computeChangesSinceLastVersion(prev, next);
    for (const c of out) {
      expect(c).toHaveProperty('section');
      expect(c).toHaveProperty('kind');
      expect(c).toHaveProperty('label');
      expect(['added', 'removed', 'modified']).toContain(c.kind);
    }
  });
});
