/**
 * Validation tests for evidence_strength.supporting_refs (must reference evidence_index ids).
 */
import { describe, it, expect } from 'vitest';
import { validateBriefJson } from '@/lib/ai/brief-schema';

function minimalBrief(overrides: Record<string, unknown> = {}) {
  return {
    executive_overview: '',
    working_timeline: [],
    evidence_index: { s1: {}, r1: {} },
    key_entities: [],
    contradictions_tensions: [],
    verification_tasks: [],
    ...overrides,
  };
}

describe('validateBriefJson evidence_strength.supporting_refs', () => {
  it('accepts evidence_strength with supporting_refs all in evidence_index', () => {
    const raw = minimalBrief({
      evidence_strength: [
        {
          theme: 'Dates',
          results_count: 1,
          saved_links_count: 0,
          wayback_count: 0,
          note_count: 0,
          corroboration_estimate: 'low',
          strength_rating: 'low',
          supporting_refs: ['s1', 'r1'],
        },
      ],
    });
    const out = validateBriefJson(raw);
    expect(out.evidence_strength).toHaveLength(1);
    expect(out.evidence_strength![0].supporting_refs).toEqual(['s1', 'r1']);
  });

  it('accepts evidence_strength with empty supporting_refs', () => {
    const raw = minimalBrief({
      evidence_strength: [
        {
          theme: 'T',
          results_count: 0,
          saved_links_count: 0,
          wayback_count: 0,
          note_count: 0,
          corroboration_estimate: 'none',
          strength_rating: 'low',
          supporting_refs: [],
        },
      ],
    });
    const out = validateBriefJson(raw);
    expect(out.evidence_strength![0].supporting_refs).toEqual([]);
  });

  it('defaults missing supporting_refs to []', () => {
    const raw = minimalBrief({
      evidence_strength: [
        {
          theme: 'T',
          results_count: 0,
          saved_links_count: 0,
          wayback_count: 0,
          note_count: 0,
          corroboration_estimate: 'none',
          strength_rating: 'low',
        },
      ],
    });
    const out = validateBriefJson(raw);
    expect(out.evidence_strength![0].supporting_refs).toEqual([]);
  });

  it('throws when supporting_refs contains id not in evidence_index', () => {
    const raw = minimalBrief({
      evidence_strength: [
        {
          theme: 'T',
          results_count: 0,
          saved_links_count: 0,
          wayback_count: 0,
          note_count: 0,
          corroboration_estimate: 'none',
          strength_rating: 'low',
          supporting_refs: ['s1', 'ghost'],
        },
      ],
    });
    expect(() => validateBriefJson(raw)).toThrow(/evidence_index id/);
  });

  it('throws when supporting_refs is not an array', () => {
    const raw = minimalBrief({
      evidence_strength: [
        {
          theme: 'T',
          results_count: 0,
          saved_links_count: 0,
          wayback_count: 0,
          note_count: 0,
          corroboration_estimate: 'none',
          strength_rating: 'low',
          supporting_refs: 'not-array',
        },
      ],
    });
    expect(() => validateBriefJson(raw)).toThrow(/supporting_refs must be an array/);
  });
});
