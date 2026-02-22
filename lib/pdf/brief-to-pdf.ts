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
  if (evidenceStrength && Array.isArray(evidenceStrength) && evidenceStrength.length > 0) {
    y = addSectionTitle(doc, 'Evidence Strength Matrix', y);
    for (const es of evidenceStrength) {
      const counts = `${es.results_count ?? 0} results, ${es.saved_links_count ?? 0} saved links, ${es.wayback_count ?? 0} wayback, ${es.note_count ?? 0} notes`;
      const line = `${es.theme || ''} — ${String(es.strength_rating || '').toUpperCase()} (${counts}). ${es.corroboration_estimate || ''}`.trim();
      y = addWrappedText(doc, line, MARGIN, y, 10);
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
      const header = `${link.source} · ${link.title || link.url || ''}`.trim();
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
