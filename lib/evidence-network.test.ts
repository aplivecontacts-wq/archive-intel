/**
 * Tests for evidence-network: refs only from timeline, key_entities, contradictions.
 * Central cap 5, isolated cap 10, single_point_failures cap 10 and only from timeline/contradictions.
 */
import { describe, it, expect } from 'vitest';
import { computeEvidenceNetwork } from './evidence-network';
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

describe('computeEvidenceNetwork', () => {
  it('returns empty central/isolated/spf when evidence_index is empty', () => {
    const out = computeEvidenceNetwork(minimalBrief());
    expect(out.central_nodes).toEqual([]);
    expect(out.isolated_nodes).toEqual([]);
    expect(out.single_point_failures).toEqual([]);
  });

  it('counts refs only from timeline, entities, contradictions (not hypotheses)', () => {
    const brief = minimalBrief({
      evidence_index: { a: {}, b: {}, c: {}, d: {} },
      working_timeline: [
        { time_window: 'T', event: 'E', confidence: 'high', basis: 'public', source_ids: ['a', 'b'] },
      ],
      key_entities: [{ name: 'X', type: 'person', source_refs: ['a', 'c'] }],
      contradictions_tensions: [{ issue: 'I', statement_a_refs: ['a'], statement_b_refs: [] }],
      hypotheses: [
        { statement: 'H', likelihood: 'high', evidence_for: ['d'], evidence_against: [], falsification_tests: [] },
      ],
    });
    const out = computeEvidenceNetwork(brief);
    // a: timeline + entities + contradictions = 3; b: timeline = 1; c: entities = 1. d only in hypotheses → not counted.
    expect(out.central_nodes.length).toBeLessThanOrEqual(5);
    const centralIds = out.central_nodes.map((n) => n.id);
    expect(centralIds).toContain('a');
    // d appears only in hypotheses so must not be in central (would need refs from timeline/entities/contradictions)
    const allNodeIds = [...out.central_nodes, ...out.isolated_nodes].map((n) => n.id);
    expect(allNodeIds).toContain('b');
    expect(allNodeIds).toContain('c');
    // d has 0 mentions from timeline/entities/contradictions so either missing or isolated with mention_count 0; we only count refs from included sections so d gets 0
    const dNode = out.central_nodes.find((n) => n.id === 'd') ?? out.isolated_nodes.find((n) => n.id === 'd');
    if (dNode) expect(dNode.mention_count).toBe(0);
  });

  it('central_nodes capped at 5', () => {
    const ids = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'];
    const brief = minimalBrief({
      evidence_index: Object.fromEntries(ids.map((id) => [id, {}])),
      working_timeline: ids.flatMap((id, i) => [
        {
          time_window: `T${i}`,
          event: `E${i}`,
          confidence: 'high',
          basis: 'public',
          source_ids: [id, ids[(i + 1) % ids.length]],
        },
      ]),
    });
    const out = computeEvidenceNetwork(brief);
    expect(out.central_nodes.length).toBeLessThanOrEqual(5);
  });

  it('isolated_nodes capped at 10', () => {
    const brief = minimalBrief({
      evidence_index: Object.fromEntries(
        Array.from({ length: 20 }, (_, i) => [`id${i}`, {}])
      ),
      working_timeline: Array.from({ length: 20 }, (_, i) => ({
        time_window: `T${i}`,
        event: `E${i}`,
        confidence: 'high',
        basis: 'public',
        source_ids: [`id${i}`],
      })),
    });
    const out = computeEvidenceNetwork(brief);
    expect(out.isolated_nodes.length).toBeLessThanOrEqual(10);
  });

  it('single_point_failures only from timeline and contradictions, capped at 10', () => {
    const brief = minimalBrief({
      evidence_index: { e1: {}, e2: {} },
      working_timeline: [
        { time_window: 'T', event: 'E', confidence: 'high', basis: 'public', source_ids: ['e1'] },
      ],
      contradictions_tensions: [
        { issue: 'I', statement_a_refs: ['e2'], statement_b_refs: [], source_refs: [] },
      ],
    });
    const out = computeEvidenceNetwork(brief);
    expect(out.single_point_failures.length).toBeGreaterThanOrEqual(1);
    expect(out.single_point_failures.length).toBeLessThanOrEqual(10);
    const areas = out.single_point_failures.map((s) => s.claim_area);
    expect(areas.some((a) => a.startsWith('working_timeline_'))).toBe(true);
    expect(areas.some((a) => a.startsWith('contradiction_'))).toBe(true);
    expect(areas.some((a) => a.startsWith('hypothesis_'))).toBe(false);
  });

  it('each node has id, mention_count, type, optional url', () => {
    const brief = minimalBrief({
      evidence_index: { e1: { type: 'url', url: 'https://x.com' } },
      working_timeline: [
        { time_window: 'T', event: 'E', confidence: 'high', basis: 'public', source_ids: ['e1'] },
      ],
    });
    const out = computeEvidenceNetwork(brief);
    for (const n of [...out.central_nodes, ...out.isolated_nodes]) {
      expect(n).toHaveProperty('id');
      expect(n).toHaveProperty('mention_count');
      expect(n).toHaveProperty('type');
      expect(typeof n.mention_count).toBe('number');
    }
  });

  it('each single_point_failure has claim_area and depends_on_ids', () => {
    const brief = minimalBrief({
      evidence_index: { e1: {} },
      working_timeline: [
        { time_window: 'T', event: 'E', confidence: 'high', basis: 'public', source_ids: ['e1'] },
      ],
    });
    const out = computeEvidenceNetwork(brief);
    for (const s of out.single_point_failures) {
      expect(s).toHaveProperty('claim_area');
      expect(s).toHaveProperty('depends_on_ids');
      expect(Array.isArray(s.depends_on_ids)).toBe(true);
    }
  });
});
