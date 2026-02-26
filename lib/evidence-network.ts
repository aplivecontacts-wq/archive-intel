/**
 * Phase 11.4: Deterministic evidence network — central nodes, isolated nodes, single-point failures.
 * NO AI. Same input → same output. Uses only brief_json (evidence_index + refs across sections).
 */
import type {
  BriefJson,
  BriefEvidenceNetwork,
  BriefEvidenceNetworkNode,
  BriefSinglePointFailure,
} from '@/lib/ai/brief-schema';

function addRefs(counts: Map<string, number>, refs: string[], validIds: Set<string>): void {
  for (const id of refs) {
    if (typeof id === 'string' && validIds.has(id)) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
}

export function computeEvidenceNetwork(brief: BriefJson): BriefEvidenceNetwork {
  const evidenceIndex = brief.evidence_index ?? {};
  const evidenceIds = new Set(Object.keys(evidenceIndex));
  const counts = new Map<string, number>();
  for (const id of Array.from(evidenceIds)) {
    counts.set(id, 0);
  }

  // Count refs only from working_timeline, key_entities, contradictions_tensions
  const timeline = brief.working_timeline ?? [];
  for (const item of timeline) {
    const refs = item.source_refs ?? item.source_ids ?? [];
    addRefs(counts, refs, evidenceIds);
  }

  const entities = brief.key_entities ?? [];
  for (const e of entities) {
    addRefs(counts, e.source_refs ?? [], evidenceIds);
  }

  const contradictions = brief.contradictions_tensions ?? [];
  for (const c of contradictions) {
    addRefs(counts, c.statement_a_refs ?? [], evidenceIds);
    addRefs(counts, c.statement_b_refs ?? [], evidenceIds);
    addRefs(counts, c.source_refs ?? [], evidenceIds);
  }

  const entries = Array.from(counts.entries()).map(([id, mention_count]) => ({
    id,
    mention_count,
    type: evidenceIndex[id]?.type ?? 'unknown',
    url: evidenceIndex[id]?.url,
  }));

  if (entries.length === 0) {
    return { central_nodes: [], isolated_nodes: [], single_point_failures: [] };
  }

  // central_nodes: top 5 by mention_count
  const sortedDesc = [...entries].sort((a, b) => b.mention_count - a.mention_count);
  const centralSet = sortedDesc.slice(0, 5);
  const centralIds = new Set(centralSet.map((e) => e.id));
  const central_nodes: BriefEvidenceNetworkNode[] = centralSet.map((e) => ({
    id: e.id,
    mention_count: e.mention_count,
    type: e.type,
    url: e.url,
  }));

  // isolated_nodes: mention_count === 1, exclude central, cap 10
  const isolated_nodes: BriefEvidenceNetworkNode[] = entries
    .filter((e) => e.mention_count === 1 && !centralIds.has(e.id))
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, 10)
    .map((e) => ({
      id: e.id,
      mention_count: e.mention_count,
      type: e.type,
      url: e.url,
    }));

  // single_point_failures: only from timeline and contradictions, cap 10
  const single_point_failures: BriefSinglePointFailure[] = [];

  for (let i = 0; i < timeline.length && single_point_failures.length < 10; i++) {
    const refs = timeline[i].source_refs ?? timeline[i].source_ids ?? [];
    if (refs.length === 1 && evidenceIds.has(refs[0])) {
      single_point_failures.push({
        claim_area: `working_timeline_${i}`,
        depends_on_ids: [refs[0]],
      });
    }
  }

  for (let i = 0; i < contradictions.length && single_point_failures.length < 10; i++) {
    const c = contradictions[i];
    const union = new Set<string>();
    for (const id of c.statement_a_refs ?? []) {
      if (evidenceIds.has(id)) union.add(id);
    }
    for (const id of c.statement_b_refs ?? []) {
      if (evidenceIds.has(id)) union.add(id);
    }
    for (const id of c.source_refs ?? []) {
      if (evidenceIds.has(id)) union.add(id);
    }
    if (union.size === 1) {
      single_point_failures.push({
        claim_area: `contradiction_${i}`,
        depends_on_ids: Array.from(union),
      });
    }
  }

  const capped = single_point_failures.slice(0, 10);

  return {
    central_nodes,
    isolated_nodes,
    single_point_failures: capped,
  };
}
