/**
 * Phase 11.5: Deterministic narrative coherence scan — internal consistency alerts.
 * NO AI. Same input → same output. Uses only brief_json (and evidence_index for classification).
 * Uses shared classifyEvidenceEntry from brief-schema for source credibility.
 */
import type { BriefJson, BriefCoherenceAlert } from '@/lib/ai/brief-schema';
import { classifyEvidenceEntry } from '@/lib/ai/brief-schema';

export function computeCoherenceAlerts(brief: BriefJson): BriefCoherenceAlert[] {
  const evidenceIndex = brief.evidence_index ?? {};
  const evidenceIds = new Set(Object.keys(evidenceIndex));
  const alerts: BriefCoherenceAlert[] = [];
  const seen = new Set<string>();

  function add(a: BriefCoherenceAlert) {
    const key = `${a.severity}:${a.alert}`;
    if (seen.has(key)) return;
    seen.add(key);
    alerts.push(a);
  }

  const timeline = brief.working_timeline ?? [];
  const contradictions = brief.contradictions_tensions ?? [];

  // CHECK 1 — Verified timeline event with weak support
  for (let i = 0; i < timeline.length && alerts.length < 10; i++) {
    const item = timeline[i];
    if (item.verified !== true) continue;
    const refs = item.source_refs ?? item.source_ids ?? [];
    if (refs.length <= 1) {
      add({
        severity: 'high',
        alert: 'Verified timeline event supported by zero or one reference.',
        why_it_matters: 'Verified events should have multiple independent references to justify confirmation status.',
        affected_sections: ['working_timeline'],
        related_evidence_ids: refs.filter((id) => evidenceIds.has(id)),
      });
    }
  }

  // CHECK 2 — High confidence on mostly social/unverified (shared classify)
  for (let i = 0; i < timeline.length && alerts.length < 10; i++) {
    const item = timeline[i];
    if (item.confidence !== 'high') continue;
    const refs = item.source_refs ?? item.source_ids ?? [];
    if (refs.length === 0) continue;
    let socialOrUnverified = 0;
    for (const id of refs) {
      const entry = evidenceIndex[id];
      const e = entry && typeof entry === 'object' ? entry : {};
      const cat = classifyEvidenceEntry(e);
      if (cat === 'social' || cat === 'unverified') socialOrUnverified++;
    }
    if (socialOrUnverified / refs.length > 0.5) {
      add({
        severity: 'high',
        alert: 'High-confidence timeline event relies primarily on social or unverified sources.',
        why_it_matters: 'High confidence should align with higher-credibility sources.',
        affected_sections: ['working_timeline'],
        related_evidence_ids: refs.filter((id) => evidenceIds.has(id)),
      });
    }
  }

  // CHECK 3 — Contradictions without resolution tasks
  for (let i = 0; i < contradictions.length && alerts.length < 10; i++) {
    const c = contradictions[i];
    const tasks = c.resolution_tasks ?? [];
    if (tasks.length > 0) continue;
    const refs: string[] = [];
    for (const id of c.statement_a_refs ?? []) if (evidenceIds.has(id)) refs.push(id);
    for (const id of c.statement_b_refs ?? []) if (evidenceIds.has(id)) refs.push(id);
    for (const id of c.source_refs ?? []) if (evidenceIds.has(id)) refs.push(id);
    add({
      severity: 'high',
      alert: 'Contradiction present with no resolution tasks.',
      why_it_matters: 'Unresolved contradictions without concrete next steps reduce actionable clarity.',
      affected_sections: ['contradictions_tensions'],
      related_evidence_ids: refs,
    });
  }

  return alerts.slice(0, 10);
}
