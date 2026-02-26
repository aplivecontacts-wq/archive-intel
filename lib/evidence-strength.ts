/**
 * Deterministic derivation of primary_sources_count and secondary_sources_count
 * from evidence_strength[].supporting_refs + evidence_index.source_tier.
 * Run after validateBriefJson; mutates brief.evidence_strength in place.
 */
import type { BriefJson, EvidenceStrengthItem, EvidenceIndex } from '@/lib/ai/brief-schema';

export function deriveEvidenceStrengthCounts(brief: BriefJson): void {
  const evidenceIndex: EvidenceIndex = brief.evidence_index ?? {};
  const items = brief.evidence_strength;
  if (!Array.isArray(items) || items.length === 0) return;

  for (const item of items as EvidenceStrengthItem[]) {
    const refs = item.supporting_refs;
    if (!Array.isArray(refs)) {
      item.primary_sources_count = 0;
      item.secondary_sources_count = 0;
      continue;
    }
    let primary = 0;
    let secondary = 0;
    for (const id of refs) {
      if (typeof id !== 'string') continue;
      const entry = evidenceIndex[id];
      if (!entry || typeof entry !== 'object') continue;
      const tier = entry.source_tier;
      if (tier === 'primary') primary++;
      else if (tier === 'secondary') secondary++;
    }
    item.primary_sources_count = primary;
    item.secondary_sources_count = secondary;
  }
}
