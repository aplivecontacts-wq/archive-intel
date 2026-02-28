/**
 * Tests for integrity score: tiered credibility (official_source, primary/secondary), evidence depth.
 */
import { describe, it, expect } from 'vitest';
import { computeIntegrityScore } from './integrity-score';
import { getCredibilityWeight, classifyEvidenceEntry } from '@/lib/ai/brief-schema';
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

describe('getCredibilityWeight', () => {
  it('official_source true gives 1.0 regardless of URL', () => {
    expect(getCredibilityWeight({ official_source: true, url: 'https://example.com' })).toBe(1.0);
  });
  it('primary source_tier gives 1.0', () => {
    expect(getCredibilityWeight({ source_tier: 'primary', url: 'https://example.com' })).toBe(1.0);
  });
  it('secondary source_tier gives 0.8', () => {
    expect(getCredibilityWeight({ source_tier: 'secondary', url: 'https://example.com' })).toBe(0.8);
  });
  it('.gov URL gives 1.0', () => {
    expect(getCredibilityWeight({ url: 'https://agency.gov/page' })).toBe(1.0);
  });
  it('other URL gives 0.5', () => {
    expect(getCredibilityWeight({ url: 'https://example.com/doc' })).toBe(0.5);
  });
});

describe('classifyEvidenceEntry with official_source', () => {
  it('official_source true returns official', () => {
    expect(classifyEvidenceEntry({ official_source: true, url: 'https://example.com' })).toBe('official');
  });
});

describe('computeIntegrityScore', () => {
  it('evidence depth: 5 points when evidence_strength has theme with ≥1 supporting_ref', () => {
    const brief = minimalBrief({
      working_timeline: [],
      evidence_index: { s1: { type: 'saved_link', url: 'https://example.com' } },
      evidence_strength: [{ theme: 'T1', results_count: 0, saved_links_count: 1, wayback_count: 0, note_count: 0, corroboration_estimate: 'low', strength_rating: 'medium', supporting_refs: ['s1'] }],
    });
    const out = computeIntegrityScore(brief);
    expect(out.drivers.some((d) => d.includes('Evidence themes'))).toBe(true);
    expect(out.score_0_100).toBeGreaterThanOrEqual(5);
  });

  it('credibility uses tiered weight: official_source entry boosts score', () => {
    const briefNoOfficial = minimalBrief({
      evidence_index: { s1: { type: 'saved_link', url: 'https://example.com' } },
      working_timeline: [{ time_window: 'T1', event: 'E1', confidence: 'high', basis: 'public', source_ids: ['s1'] }],
    });
    const briefWithOfficial = minimalBrief({
      evidence_index: { s1: { type: 'saved_link', url: 'https://example.com', official_source: true } },
      working_timeline: [{ time_window: 'T1', event: 'E1', confidence: 'high', basis: 'public', source_ids: ['s1'] }],
    });
    const outNo = computeIntegrityScore(briefNoOfficial);
    const outYes = computeIntegrityScore(briefWithOfficial);
    expect(outYes.score_0_100).toBeGreaterThan(outNo.score_0_100);
  });
});
