/**
 * Builds a PDF from stored brief_json. Used by GET /api/cases/[caseId]/briefs/[briefId]/pdf.
 */
import { jsPDF } from 'jspdf';
import type { BriefJson } from '@/lib/ai/brief-schema';

const MARGIN = 20;
const PAGE_W = 210;
const PAGE_H = 297;
const MAX_W = PAGE_W - MARGIN * 2;
const LINE = 6;
const SECTION_GAP = 8;
const TITLE_FONT_SIZE = 14;
const LINE_AFTER_HEADER = 6;
const MIN_SPACE_FOR_SECTION = 40;

function ensureNewPage(doc: jsPDF, y: number): number {
  if (y > PAGE_H - MARGIN) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function ensureMinSpace(doc: jsPDF, y: number, minNeeded: number): number {
  if (PAGE_H - MARGIN - y < minNeeded) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function addWrappedText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  maxWidth: number = MAX_W
): number {
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(text || '', maxWidth);
  for (const line of lines) {
    y = ensureNewPage(doc, y);
    doc.text(line, x, y);
    y += LINE;
  }
  return y;
}

function addSectionTitle(doc: jsPDF, title: string, y: number, major = false): number {
  if (major) {
    y = ensureMinSpace(doc, y, MIN_SPACE_FOR_SECTION);
  }
  y = ensureNewPage(doc, y);
  doc.setFontSize(TITLE_FONT_SIZE);
  doc.setFont('helvetica', 'bold');
  doc.text(title, MARGIN, y);
  y += LINE + 2;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += LINE_AFTER_HEADER;
  doc.setFont('helvetica', 'normal');
  return y;
}

const TABLE_FONT = 9;
const TABLE_CELL_PAD = 2;
const TIMELINE_COLS = [26, 62, 24, 26, 32] as const;

function addTableRow(
  doc: jsPDF,
  y: number,
  cells: string[],
  colWidths: readonly number[],
  bold = false
): number {
  doc.setFontSize(TABLE_FONT);
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  let rowHeight = LINE + TABLE_CELL_PAD;
  const wrapped: string[][] = [];
  for (let i = 0; i < cells.length; i++) {
    const w = colWidths[i] - TABLE_CELL_PAD * 2;
    const lines = doc.splitTextToSize(cells[i] ?? '', w);
    wrapped.push(lines);
    rowHeight = Math.max(rowHeight, lines.length * LINE + TABLE_CELL_PAD);
  }
  y = ensureNewPage(doc, y);
  if (y + rowHeight > PAGE_H - MARGIN) {
    doc.addPage();
    y = MARGIN;
  }
  let x = MARGIN;
  for (let i = 0; i < cells.length; i++) {
    doc.rect(x, y, colWidths[i], rowHeight);
    const lines = wrapped[i];
    let ly = y + TABLE_CELL_PAD + LINE * 0.5;
    for (const line of lines) {
      doc.text(line, x + TABLE_CELL_PAD, ly);
      ly += LINE;
    }
    x += colWidths[i];
  }
  return y + rowHeight;
}

export type SavedLinkWithNotesForPdf = {
  source: string;
  url: string;
  title: string | null;
  source_tier?: 'primary' | 'secondary' | null;
  notes: { content: string; created_at: string }[];
};

export function buildBriefPdf(
  caseTitle: string,
  versionNumber: number,
  createdAt: string,
  briefJson: BriefJson,
  savedLinksWithNotes?: SavedLinkWithNotesForPdf[]
): Uint8Array {
  const doc = new jsPDF();
  let y = MARGIN;

  // 1) Title block
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(caseTitle || 'Untitled Case', MARGIN, y);
  y += LINE + 2;
  doc.setFontSize(12);
  doc.text(`Forensic Brief v${versionNumber}`, MARGIN, y);
  y += LINE;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(createdAt, MARGIN, y);
  y += LINE + SECTION_GAP;

  // What Changed (if any)
  const changesSince = briefJson.changes_since_last_version;
  if (changesSince && Array.isArray(changesSince) && changesSince.length > 0) {
    y = addSectionTitle(doc, 'What Changed', y);
    for (const entry of changesSince) {
      const kindTag = entry.kind === 'added' ? '[Added]' : entry.kind === 'removed' ? '[Removed]' : '[Modified]';
      const line = `${kindTag} ${entry.label || ''}`.trim();
      y = addWrappedText(doc, line, MARGIN, y, 9);
      y += 0.5;
    }
    y += SECTION_GAP;
  }

  // 2) Executive Overview
  y = addSectionTitle(doc, 'Executive Overview', y);
  y = addWrappedText(
    doc,
    briefJson.executive_overview?.trim() || 'None.',
    MARGIN,
    y,
    10
  );
  y += SECTION_GAP;

  // 3) Working Timeline (table)
  y = addSectionTitle(doc, 'Working Timeline', y, true);
  const timeline = briefJson.working_timeline;
  const evidenceIndex = briefJson.evidence_index ?? {};
  if (!timeline?.length) {
    y = addWrappedText(doc, 'None.', MARGIN, y, 10);
  } else {
    y = addTableRow(doc, y, ['Time', 'Event', 'Confidence', 'Basis', 'Refs'], TIMELINE_COLS, true);
    for (const item of timeline) {
      const refIds = item.source_refs ?? item.source_ids ?? [];
      const refs = refIds.join(', ');
      const verifiedSuffix = item.verified === true ? ' ✓' : '';
      y = addTableRow(
        doc,
        y,
        [
          String(item.time_window ?? '').trim(),
          String(item.event ?? '').trim() + (verifiedSuffix ? ' ' + verifiedSuffix : ''),
          String(item.confidence ?? ''),
          String(item.basis ?? ''),
          refs,
        ],
        TIMELINE_COLS
      );
    }
    y += 2;
    y = addWrappedText(doc, 'Evidence details:', MARGIN, y, 9);
    y += 1;
    for (const item of timeline) {
      const refIds = item.source_refs ?? item.source_ids ?? [];
      if (refIds.length > 0) {
        for (const id of refIds) {
          const evidence = evidenceIndex[id];
          const desc = evidence?.description?.trim();
          const url = evidence?.url?.trim();
          const evidenceLine = evidence
            ? `${id}: ${desc || evidence.type || id}${url ? ` (${url})` : ''}`
            : id;
          y = addWrappedText(doc, evidenceLine, MARGIN, y, 9);
          y += 0.5;
        }
        y += 0.5;
      }
    }
  }
  y += SECTION_GAP;

  // 4) Key Entities
  y = addSectionTitle(doc, 'Key Entities', y, true);
  const entities = briefJson.key_entities;
  if (!entities?.length) {
    y = addWrappedText(doc, 'None.', MARGIN, y, 10);
  } else {
    for (const e of entities) {
      const refs = (e.source_refs ?? []).join(', ');
      y = addWrappedText(
        doc,
        `${e.name} (${e.type})${refs ? ` — ${refs}` : ''}`.trim(),
        MARGIN,
        y,
        10
      );
      y += 1;
    }
  }
  y += SECTION_GAP;

  // 5) Contradictions / Tensions
  y = addSectionTitle(doc, 'Contradictions / Tensions', y, true);
  const contradictions = briefJson.contradictions_tensions;
  if (!contradictions?.length) {
    y = addWrappedText(doc, 'None.', MARGIN, y, 10);
  } else {
    for (const c of contradictions) {
      const hasStructured =
        typeof c.statement_a === 'string' && typeof c.statement_b === 'string';
      if (hasStructured) {
        y = ensureNewPage(doc, y);
        y = addWrappedText(doc, `${c.issue || ''} [${c.issue_type ?? 'other'}]`, MARGIN, y, 10);
        y += 1;
        y = addWrappedText(
          doc,
          `Statement A: ${c.statement_a || ''}${(c.statement_a_refs ?? []).length ? ` [${(c.statement_a_refs ?? []).join(', ')}]` : ''}`,
          MARGIN,
          y,
          9
        );
        y += 1;
        y = addWrappedText(
          doc,
          `Statement B: ${c.statement_b || ''}${(c.statement_b_refs ?? []).length ? ` [${(c.statement_b_refs ?? []).join(', ')}]` : ''}`,
          MARGIN,
          y,
          9
        );
        y += 1;
        if (c.why_it_matters?.trim()) {
          y = addWrappedText(doc, `Why it matters: ${c.why_it_matters}`, MARGIN, y, 9);
          y += 1;
        }
        const tasks = c.resolution_tasks ?? [];
        if (tasks.length > 0) {
          for (const t of tasks) {
            y = addWrappedText(doc, `• ${String(t)}`, MARGIN, y, 9);
            y += 0.5;
          }
        }
        y += 2;
      } else {
        const refs = (c.source_refs ?? []).join(', ');
        y = addWrappedText(
          doc,
          `${c.issue || ''}: ${c.details ?? ''}${refs ? ` [${refs}]` : ''}`.trim(),
          MARGIN,
          y,
          10
        );
        y += 1;
      }
    }
  }
  y += SECTION_GAP;

  // 6) Verification Tasks
  y = addSectionTitle(doc, 'Verification Tasks', y);
  const tasks = briefJson.verification_tasks;
  if (!tasks?.length) {
    y = addWrappedText(doc, 'None.', MARGIN, y, 10);
  } else {
    for (const t of tasks) {
      const q = (t.suggested_queries ?? []).join('; ');
      y = addWrappedText(
        doc,
        `${t.task || ''} (${t.priority || ''})${q ? ` — ${q}` : ''}`.trim(),
        MARGIN,
        y,
        10
      );
      y += 1;
    }
  }
  y += SECTION_GAP;

  // 7) Evidence Strength Matrix (optional)
  const evidenceStrength = briefJson.evidence_strength;
  const evidenceIndexForPdf = briefJson.evidence_index ?? {};
  if (evidenceStrength && Array.isArray(evidenceStrength) && evidenceStrength.length > 0) {
    y = addSectionTitle(doc, 'Evidence Strength Matrix', y);
    for (const es of evidenceStrength) {
      const counts = `${es.results_count ?? 0} results, ${es.saved_links_count ?? 0} saved links, ${es.wayback_count ?? 0} wayback, ${es.note_count ?? 0} notes`;
      const pCount = es.primary_sources_count ?? 0;
      const sCount = es.secondary_sources_count ?? 0;
      const tierLabel = (pCount > 0 || sCount > 0) ? ` [${pCount}P, ${sCount}S]` : '';
      const line = `${es.theme || ''} — ${String(es.strength_rating || '').toUpperCase()} (${counts})${tierLabel}. ${es.corroboration_estimate || ''}`.trim();
      y = addWrappedText(doc, line, MARGIN, y, 10);
      if (Array.isArray(es.supporting_refs) && es.supporting_refs.length > 0) {
        const refLabels = es.supporting_refs.map((id: string) => {
          const entry = evidenceIndexForPdf[id];
          const tier = entry && typeof entry === 'object' && (entry as { source_tier?: string }).source_tier;
          return tier === 'primary' ? `${id} [P]` : tier === 'secondary' ? `${id} [S]` : id;
        });
        y = addWrappedText(doc, `Refs: ${refLabels.join(', ')}`, MARGIN, y, 9);
        y += 0.5;
      }
      y += 1;
    }
  }

  // 8) Hypotheses (optional)
  const hypotheses = briefJson.hypotheses;
  if (hypotheses && Array.isArray(hypotheses) && hypotheses.length > 0) {
    y += SECTION_GAP;
    y = addSectionTitle(doc, 'Hypotheses', y, true);
    for (const h of hypotheses) {
      y = ensureNewPage(doc, y);
      const lik = String(h.likelihood || '').toUpperCase();
      y = addWrappedText(doc, `${h.statement || ''} [${lik}]`, MARGIN, y, 10);
      y += 1;
      y = addWrappedText(doc, `Evidence for: ${Array.isArray(h.evidence_for) ? h.evidence_for.join(', ') : ''}`, MARGIN, y, 9);
      y = addWrappedText(doc, `Evidence against: ${Array.isArray(h.evidence_against) ? h.evidence_against.join(', ') : ''}`, MARGIN, y, 9);
      y += 1;
      if (Array.isArray(h.falsification_tests) && h.falsification_tests.length > 0) {
        for (const t of h.falsification_tests) {
          y = addWrappedText(doc, `• ${t}`, MARGIN, y, 9);
          y += 0.5;
        }
      }
      y += 2;
    }
  }

  // 9) Critical Gaps (Missing Evidence) (optional)
  const criticalGaps = briefJson.critical_gaps;
  if (criticalGaps && Array.isArray(criticalGaps) && criticalGaps.length > 0) {
    y += SECTION_GAP;
    y = addSectionTitle(doc, 'Critical Gaps (Missing Evidence)', y, true);
    for (const g of criticalGaps) {
      y = ensureNewPage(doc, y);
      y = addWrappedText(doc, `Missing: ${g.missing_item || ''}`, MARGIN, y, 10);
      y += 1;
      y = addWrappedText(doc, `Why it matters: ${g.why_it_matters || ''}`, MARGIN, y, 9);
      y += 1;
      y = addWrappedText(doc, `Fastest way to verify: ${g.fastest_way_to_verify || ''}`, MARGIN, y, 9);
      y += 1;
      if (Array.isArray(g.suggested_queries) && g.suggested_queries.length > 0) {
        y = addWrappedText(doc, 'Suggested queries:', MARGIN, y, 9);
        for (const q of g.suggested_queries) {
          y = addWrappedText(doc, `• ${q}`, MARGIN, y, 9);
          y += 0.5;
        }
      }
      y += 2;
    }
  }

  // 9b) Collapse Tests (optional, Phase 11.1)
  const collapseTests = briefJson.collapse_tests;
  if (collapseTests && Array.isArray(collapseTests) && collapseTests.length > 0) {
    y += SECTION_GAP;
    y = addSectionTitle(doc, 'Collapse Tests', y, true);
    for (const t of collapseTests) {
      y = ensureNewPage(doc, y);
      y = addWrappedText(doc, `Claim/Hypothesis: ${t.claim_or_hypothesis || ''}`, MARGIN, y, 10);
      y += 1;
      if (Array.isArray(t.critical_assumptions) && t.critical_assumptions.length > 0) {
        y = addWrappedText(doc, 'Critical assumptions:', MARGIN, y, 9);
        for (const a of t.critical_assumptions) {
          y = addWrappedText(doc, `• ${a}`, MARGIN, y, 9);
          y += 0.5;
        }
        y += 0.5;
      }
      if (Array.isArray(t.single_points_of_failure) && t.single_points_of_failure.length > 0) {
        y = addWrappedText(doc, 'Single points of failure:', MARGIN, y, 9);
        for (const s of t.single_points_of_failure) {
          y = addWrappedText(doc, `• ${s}`, MARGIN, y, 9);
          y += 0.5;
        }
        y += 0.5;
      }
      if (Array.isArray(t.what_would_falsify) && t.what_would_falsify.length > 0) {
        y = addWrappedText(doc, 'What would falsify:', MARGIN, y, 9);
        for (const w of t.what_would_falsify) {
          y = addWrappedText(doc, `• ${w}`, MARGIN, y, 9);
          y += 0.5;
        }
        y += 0.5;
      }
      y = addWrappedText(doc, `Highest leverage next step: ${t.highest_leverage_next_step || ''}`, MARGIN, y, 9);
      y += 1;
      if (Array.isArray(t.supporting_refs) && t.supporting_refs.length > 0) {
        y = addWrappedText(doc, `Refs: ${t.supporting_refs.join(', ')}`, MARGIN, y, 9);
        y += 0.5;
      }
      y += 2;
    }
  }

  // 9c) Incentive Matrix (optional, Phase 11.2)
  const incentiveMatrix = briefJson.incentive_matrix;
  if (incentiveMatrix && Array.isArray(incentiveMatrix) && incentiveMatrix.length > 0) {
    y += SECTION_GAP;
    y = addSectionTitle(doc, 'Incentive Matrix', y, true);
    for (const m of incentiveMatrix) {
      y = ensureNewPage(doc, y);
      y = addWrappedText(doc, `${m.actor || ''} — ${m.role || ''}`, MARGIN, y, 10);
      y += 1;
      if (Array.isArray(m.narrative_a_incentives) && m.narrative_a_incentives.length > 0) {
        y = addWrappedText(doc, 'Narrative A incentives:', MARGIN, y, 9);
        for (const a of m.narrative_a_incentives) {
          y = addWrappedText(doc, `• ${a}`, MARGIN, y, 9);
          y += 0.5;
        }
        y += 0.5;
      }
      if (Array.isArray(m.narrative_b_incentives) && m.narrative_b_incentives.length > 0) {
        y = addWrappedText(doc, 'Narrative B incentives:', MARGIN, y, 9);
        for (const b of m.narrative_b_incentives) {
          y = addWrappedText(doc, `• ${b}`, MARGIN, y, 9);
          y += 0.5;
        }
        y += 0.5;
      }
      if (Array.isArray(m.exposure_if_false) && m.exposure_if_false.length > 0) {
        y = addWrappedText(doc, 'Exposure if false:', MARGIN, y, 9);
        for (const e of m.exposure_if_false) {
          y = addWrappedText(doc, `• ${e}`, MARGIN, y, 9);
          y += 0.5;
        }
        y += 0.5;
      }
      if (Array.isArray(m.supporting_refs) && m.supporting_refs.length > 0) {
        y = addWrappedText(doc, `Refs: ${m.supporting_refs.join(', ')}`, MARGIN, y, 9);
        y += 0.5;
      }
      y += 2;
    }
  }

  // 9) Evidence & brief quality (one block: credibility, evidence summary, entity summary, integrity, network, coherence)
  const hasCredibility = typeof briefJson.source_credibility_summary === 'string' && briefJson.source_credibility_summary.trim() !== '';
  const esp = briefJson.evidence_summary_panel;
  const entityPanel = briefJson.entity_summary_panel;
  const integrityScore = briefJson.integrity_score;
  const evidenceNetwork = briefJson.evidence_network;
  const coherenceAlerts = briefJson.coherence_alerts;
  const hasEsp = esp && typeof esp === 'object' && esp.totals;
  const hasEntityPanel = entityPanel && typeof entityPanel === 'object' && Array.isArray(entityPanel.top_entities) && entityPanel.top_entities.length > 0;
  const hasIntegrity = integrityScore && typeof integrityScore === 'object' && typeof integrityScore.score_0_100 === 'number';
  const hasNetwork = evidenceNetwork && typeof evidenceNetwork === 'object' && (
    ((evidenceNetwork.central_nodes ?? []).length > 0) || ((evidenceNetwork.isolated_nodes ?? []).length > 0) || ((evidenceNetwork.single_point_failures ?? []).length > 0)
  );
  const hasCoherence = coherenceAlerts && Array.isArray(coherenceAlerts) && coherenceAlerts.length > 0;
  if (hasCredibility || hasEsp || hasEntityPanel || hasIntegrity || hasNetwork || hasCoherence) {
    y += SECTION_GAP;
    y = addSectionTitle(doc, 'Evidence & brief quality', y, true);
    if (hasCredibility) {
      y = addWrappedText(doc, briefJson.source_credibility_summary!.trim(), MARGIN, y, 10);
      y += 2;
    }
    if (hasEsp) {
      const t = esp!.totals;
      const intro = (esp as { intro?: string }).intro;
      if (intro) {
        y = addWrappedText(doc, intro, MARGIN, y, 10);
        y += 1;
      }
      y = addWrappedText(doc, `Totals: ${t.results ?? 0} results, ${t.saved_links ?? 0} saved links, ${t.notes ?? 0} notes, ${t.wayback_results ?? 0} wayback.`, MARGIN, y, 10);
      if (Array.isArray(esp!.top_sources) && esp!.top_sources.length > 0) {
        y += 2;
        y = addWrappedText(doc, 'Top sources: ' + esp!.top_sources.slice(0, 5).map((s: { label: string; count: number }) => `${s.label} (${s.count})`).join(', '), MARGIN, y, 10);
      }
      if (Array.isArray(esp!.coverage_notes) && esp!.coverage_notes.length > 0) {
        y += 2;
        y = addWrappedText(doc, esp!.coverage_notes.join(' '), MARGIN, y, 10);
      }
      y += 2;
    }
    if (hasEntityPanel) {
      const intro = (entityPanel as { intro?: string }).intro;
      if (intro) {
        y = addWrappedText(doc, intro, MARGIN, y, 10);
        y += 1;
      }
      const lines = entityPanel!.top_entities!.map((e: { name: string; type: string; mention_count: number }) => `${e.name} (${e.type}): ${e.mention_count}`);
      y = addWrappedText(doc, lines.join('; '), MARGIN, y, 10);
      if (Array.isArray(entityPanel!.notable_connections) && entityPanel!.notable_connections.length > 0) {
        y += 2;
        y = addWrappedText(doc, entityPanel!.notable_connections.join(' '), MARGIN, y, 10);
      }
      y += 2;
    }
    if (hasIntegrity) {
      y = addWrappedText(doc, `Score: ${integrityScore!.score_0_100}/100 — Grade: ${integrityScore!.grade ?? ''}`, MARGIN, y, 10);
      y += 1;
      if (Array.isArray(integrityScore!.drivers) && integrityScore!.drivers.length > 0) {
        y = addWrappedText(doc, 'Drivers:', MARGIN, y, 9);
        for (const d of integrityScore!.drivers) {
          y = addWrappedText(doc, `• ${d}`, MARGIN, y, 9);
          y += 0.5;
        }
        y += 0.5;
      }
      if (Array.isArray(integrityScore!.weak_points) && integrityScore!.weak_points.length > 0) {
        y = addWrappedText(doc, 'Weak points:', MARGIN, y, 9);
        for (const w of integrityScore!.weak_points) {
          y = addWrappedText(doc, `• ${w}`, MARGIN, y, 9);
          y += 0.5;
        }
        y += 0.5;
      }
      y += 2;
    }
    if (hasNetwork) {
      const centralNodes = evidenceNetwork!.central_nodes ?? [];
      const isolatedNodes = evidenceNetwork!.isolated_nodes ?? [];
      const singlePointFailures = evidenceNetwork!.single_point_failures ?? [];
      if (centralNodes.length > 0) {
        y = addWrappedText(doc, 'Central nodes (high mention count):', MARGIN, y, 9);
        for (const n of centralNodes) {
          y = addWrappedText(doc, `• ${n.id} — ${n.mention_count} refs${n.type ? ` (${n.type})` : ''}`, MARGIN, y, 9);
          y += 0.5;
        }
        y += 0.5;
      }
      if (isolatedNodes.length > 0) {
        y = addWrappedText(doc, 'Isolated nodes (mention_count = 1):', MARGIN, y, 9);
        for (const n of isolatedNodes) {
          y = addWrappedText(doc, `• ${n.id}${n.type ? ` (${n.type})` : ''}`, MARGIN, y, 9);
          y += 0.5;
        }
        y += 0.5;
      }
      if (singlePointFailures.length > 0) {
        y = addWrappedText(doc, 'Single-point failures:', MARGIN, y, 9);
        for (const s of singlePointFailures) {
          const deps = Array.isArray(s.depends_on_ids) ? s.depends_on_ids.join(', ') : '';
          y = addWrappedText(doc, `• ${s.claim_area} → depends on ${deps}`, MARGIN, y, 9);
          y += 0.5;
        }
        y += 0.5;
      }
      y += 2;
    }
    if (hasCoherence) {
      for (const a of coherenceAlerts!) {
        y = ensureNewPage(doc, y);
        y = addWrappedText(doc, `[${(a.severity ?? '').toUpperCase()}] ${a.alert ?? ''}`, MARGIN, y, 10);
        y = addWrappedText(doc, a.why_it_matters ?? '', MARGIN, y, 9);
        y += 0.5;
        if (Array.isArray(a.affected_sections) && a.affected_sections.length > 0) {
          y = addWrappedText(doc, `Sections: ${a.affected_sections.join(', ')}`, MARGIN, y, 9);
          y += 0.5;
        }
        if (Array.isArray(a.related_evidence_ids) && a.related_evidence_ids.length > 0) {
          y = addWrappedText(doc, `Refs: ${a.related_evidence_ids.join(', ')}`, MARGIN, y, 9);
          y += 0.5;
        }
        y += 1.5;
      }
      y += 2;
    }
  }

  // 10) Saved link notes (evidence) — so nothing is missed
  if (savedLinksWithNotes && savedLinksWithNotes.length > 0) {
    y += SECTION_GAP;
    y = addSectionTitle(doc, 'Saved link notes (evidence)', y, true);
    y = addWrappedText(
      doc,
      'Per-link notes from the Saved tab for this case. Used when this brief was generated.',
      MARGIN,
      y,
      9
    );
    y += 2;
    for (const link of savedLinksWithNotes) {
      y = ensureNewPage(doc, y);
      const tierLabel = link.source_tier === 'primary' ? ' [Primary]' : link.source_tier === 'secondary' ? ' [Secondary]' : '';
      const header = `${link.source}${tierLabel} · ${link.title || link.url || ''}`.trim();
      y = addWrappedText(doc, header, MARGIN, y, 10);
      y = addWrappedText(doc, link.url || '', MARGIN, y, 9);
      y += 1;
      if (link.notes.length > 0) {
        for (let i = 0; i < link.notes.length; i++) {
          const n = link.notes[i];
          y = addWrappedText(doc, `Note ${i + 1}: ${n.content}`, MARGIN, y, 9);
          y += 1;
        }
      } else {
        y = addWrappedText(doc, 'No notes.', MARGIN, y, 9);
        y += 1;
      }
      y += 2;
    }
  }

  const out = doc.output('arraybuffer');
  return new Uint8Array(out);
}

/** Case overview PDF when no brief exists (for full-case export). */
export type CaseOverviewInput = {
  caseTitle: string;
  objective: string | null;
  exportedAt: string;
  queries: { id: string; title?: string | null; created_at: string }[];
  savedLinks: { url: string; title?: string | null; source: string }[];
};

export function buildCaseOverviewPdf(input: CaseOverviewInput): Uint8Array {
  const doc = new jsPDF();
  let y = MARGIN;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(input.caseTitle || 'Untitled Case', MARGIN, y);
  y += LINE + 2;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Case export · ${input.exportedAt}`, MARGIN, y);
  y += LINE + SECTION_GAP;

  if (input.objective?.trim()) {
    y = addSectionTitle(doc, 'Objective', y);
    y = addWrappedText(doc, input.objective.trim(), MARGIN, y, 10);
    y += SECTION_GAP;
  }

  y = addSectionTitle(doc, 'Queries', y, true);
  if (!input.queries.length) {
    y = addWrappedText(doc, 'No queries yet.', MARGIN, y, 10);
  } else {
    for (const q of input.queries) {
      y = ensureNewPage(doc, y);
      const title = (q.title || 'Untitled query').slice(0, 80);
      doc.setFontSize(10);
      doc.text(title, MARGIN, y);
      y += LINE;
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(new Date(q.created_at).toLocaleString(), MARGIN, y);
      doc.setTextColor(0, 0, 0);
      y += LINE + 2;
    }
  }
  y += SECTION_GAP;

  y = addSectionTitle(doc, 'Saved Links', y, true);
  if (!input.savedLinks.length) {
    y = addWrappedText(doc, 'No saved links.', MARGIN, y, 10);
  } else {
    for (const link of input.savedLinks) {
      y = ensureNewPage(doc, y);
      const header = (link.title || link.url || '').slice(0, 80);
      doc.setFontSize(10);
      doc.text(header, MARGIN, y);
      y += LINE;
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`${link.source} · ${link.url}`, MARGIN, y);
      doc.setTextColor(0, 0, 0);
      y += LINE + 2;
    }
  }

  y += SECTION_GAP;
  y = ensureNewPage(doc, y);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text('No brief generated yet. Generate a brief from the Case Briefs tab for a full forensic report.', MARGIN, y);

  const out = doc.output('arraybuffer');
  return new Uint8Array(out);
}
