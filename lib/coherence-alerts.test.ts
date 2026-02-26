/**
 * Tests for coherence-alerts: 3 checks only (verified+weak support, high confidence+social/unverified, contradiction+no resolution).
 * Uses shared classifyEvidenceEntry from brief-schema.
 */
import { describe, it, expect } from 'vitest';
import { computeCoherenceAlerts } from './coherence-alerts';
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

describe('computeCoherenceAlerts', () => {
  it('returns empty for empty brief', () => {
    expect(computeCoherenceAlerts(minimalBrief())).toEqual([]);
  });

  it('alerts when verified timeline event has zero or one reference', () => {
    const brief = minimalBrief({
      evidence_index: { e1: { type: 'url', url: 'https://example.com' } },
      working_timeline: [
        {
          time_window: 'T1',
          event: 'Event',
          confidence: 'high',
          basis: 'public',
          source_ids: ['e1'],
          verified: true,
        },
      ],
    });
    const out = computeCoherenceAlerts(brief);
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out.some((a) => a.alert.includes('zero or one reference'))).toBe(true);
    expect(out.some((a) => a.affected_sections?.includes('working_timeline'))).toBe(true);
  });

  it('alerts when high-confidence timeline event relies on social/unverified sources', () => {
    const brief = minimalBrief({
      evidence_index: {
        e1: { type: 'url', url: 'https://twitter.com/user/status/1' },
      },
      working_timeline: [
        {
          time_window: 'T1',
          event: 'Tweet said X',
          confidence: 'high',
          basis: 'public',
          source_ids: ['e1'],
        },
      ],
    });
    const out = computeCoherenceAlerts(brief);
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out.some((a) => a.alert.includes('social or unverified'))).toBe(true);
  });

  it('alerts when contradiction has no resolution tasks', () => {
    const brief = minimalBrief({
      evidence_index: { e1: {} },
      contradictions_tensions: [
        {
          issue: 'Date conflict',
          statement_a_refs: ['e1'],
          statement_b_refs: [],
        },
      ],
    });
    const out = computeCoherenceAlerts(brief);
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out.some((a) => a.alert.includes('no resolution tasks'))).toBe(true);
  });

  it('does not alert when contradiction has resolution tasks', () => {
    const brief = minimalBrief({
      evidence_index: { e1: {} },
      contradictions_tensions: [
        {
          issue: 'Date conflict',
          resolution_tasks: ['Check primary source'],
          statement_a_refs: ['e1'],
        },
      ],
    });
    const out = computeCoherenceAlerts(brief);
    expect(out.some((a) => a.alert.includes('no resolution tasks'))).toBe(false);
  });

  it('each alert has severity, alert, why_it_matters, affected_sections, related_evidence_ids', () => {
    const brief = minimalBrief({
      evidence_index: { e1: {} },
      working_timeline: [
        { time_window: 'T', event: 'E', confidence: 'high', basis: 'public', source_ids: ['e1'], verified: true },
      ],
    });
    const out = computeCoherenceAlerts(brief);
    for (const a of out) {
      expect(a).toHaveProperty('severity');
      expect(a).toHaveProperty('alert');
      expect(a).toHaveProperty('why_it_matters');
      expect(a).toHaveProperty('affected_sections');
      expect(a).toHaveProperty('related_evidence_ids');
      expect(['high', 'medium', 'low']).toContain(a.severity);
    }
  });

  it('returns at most 10 alerts', () => {
    const brief = minimalBrief({
      evidence_index: { e1: {}, e2: {}, e3: {} },
      working_timeline: Array.from({ length: 15 }, (_, i) => ({
        time_window: `T${i}`,
        event: `E${i}`,
        confidence: 'high' as const,
        basis: 'public' as const,
        source_ids: ['e1'],
        verified: true,
      })),
      contradictions_tensions: Array.from({ length: 15 }, (_, i) => ({
        issue: `Conflict ${i}`,
        statement_a_refs: ['e1'],
      })),
    });
    const out = computeCoherenceAlerts(brief);
    expect(out.length).toBeLessThanOrEqual(10);
  });
});
