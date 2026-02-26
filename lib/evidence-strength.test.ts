/**
 * Tests for evidence-strength: derive P/S counts from supporting_refs + evidence_index.source_tier.
 */
import { describe, it, expect } from 'vitest';
import { deriveEvidenceStrengthCounts } from './evidence-strength';
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

describe('deriveEvidenceStrengthCounts', () => {
  it('no-ops when evidence_strength is missing or empty', () => {
    const brief = minimalBrief();
    deriveEvidenceStrengthCounts(brief);
    expect(brief.evidence_strength).toBeUndefined();

    const brief2 = minimalBrief({ evidence_strength: [] });
    deriveEvidenceStrengthCounts(brief2);
    expect(brief2.evidence_strength).toEqual([]);
  });

  it('sets P/S to 0 when supporting_refs is missing or empty', () => {
    const brief = minimalBrief({
      evidence_index: { s1: {} },
      evidence_strength: [
        {
          theme: 'T1',
          results_count: 0,
          saved_links_count: 0,
          wayback_count: 0,
          note_count: 0,
          corroboration_estimate: 'none',
          strength_rating: 'low',
        },
      ],
    });
    deriveEvidenceStrengthCounts(brief);
    expect(brief.evidence_strength![0]).toMatchObject({
      primary_sources_count: 0,
      secondary_sources_count: 0,
    });
  });

  it('counts primary and secondary from supporting_refs + evidence_index', () => {
    const brief = minimalBrief({
      evidence_index: {
        s1: { source_tier: 'primary' },
        s2: { source_tier: 'secondary' },
        r1: { source_tier: 'primary' },
      },
      evidence_strength: [
        {
          theme: 'Theme A',
          results_count: 1,
          saved_links_count: 2,
          wayback_count: 0,
          note_count: 0,
          corroboration_estimate: 'mixed',
          strength_rating: 'medium',
          supporting_refs: ['s1', 's2', 'r1'],
        },
      ],
    });
    deriveEvidenceStrengthCounts(brief);
    expect(brief.evidence_strength![0]).toMatchObject({
      primary_sources_count: 2,
      secondary_sources_count: 1,
    });
  });

  it('ignores refs not in evidence_index', () => {
    const brief = minimalBrief({
      evidence_index: { s1: { source_tier: 'primary' } },
      evidence_strength: [
        {
          theme: 'T',
          results_count: 0,
          saved_links_count: 0,
          wayback_count: 0,
          note_count: 0,
          corroboration_estimate: 'low',
          strength_rating: 'low',
          supporting_refs: ['s1', 'ghost'],
        },
      ],
    });
    deriveEvidenceStrengthCounts(brief);
    expect(brief.evidence_strength![0]).toMatchObject({
      primary_sources_count: 1,
      secondary_sources_count: 0,
    });
  });

  it('overwrites AI-provided P/S counts', () => {
    const brief = minimalBrief({
      evidence_index: {
        s1: { source_tier: 'primary' },
        s2: { source_tier: 'secondary' },
      },
      evidence_strength: [
        {
          theme: 'T',
          results_count: 0,
          saved_links_count: 0,
          wayback_count: 0,
          note_count: 0,
          corroboration_estimate: 'low',
          strength_rating: 'low',
          primary_sources_count: 99,
          secondary_sources_count: 99,
          supporting_refs: ['s1', 's2'],
        },
      ],
    });
    deriveEvidenceStrengthCounts(brief);
    expect(brief.evidence_strength![0]).toMatchObject({
      primary_sources_count: 1,
      secondary_sources_count: 1,
    });
  });

  it('handles multiple themes with different refs', () => {
    const brief = minimalBrief({
      evidence_index: {
        s1: { source_tier: 'primary' },
        s2: { source_tier: 'secondary' },
        r1: {},
      },
      evidence_strength: [
        {
          theme: 'Theme 1',
          results_count: 0,
          saved_links_count: 0,
          wayback_count: 0,
          note_count: 0,
          corroboration_estimate: 'a',
          strength_rating: 'high',
          supporting_refs: ['s1'],
        },
        {
          theme: 'Theme 2',
          results_count: 0,
          saved_links_count: 0,
          wayback_count: 0,
          note_count: 0,
          corroboration_estimate: 'b',
          strength_rating: 'low',
          supporting_refs: ['s2', 'r1'],
        },
      ],
    });
    deriveEvidenceStrengthCounts(brief);
    expect(brief.evidence_strength![0]).toMatchObject({
      primary_sources_count: 1,
      secondary_sources_count: 0,
    });
    expect(brief.evidence_strength![1]).toMatchObject({
      primary_sources_count: 0,
      secondary_sources_count: 1,
    });
  });
});
