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
const SECTION_GAP = 4;

function ensureNewPage(doc: jsPDF, y: number): number {
  if (y > PAGE_H - MARGIN) {
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
  fontSize: number
): number {
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(text || '', MAX_W);
  for (const line of lines) {
    y = ensureNewPage(doc, y);
    doc.text(line, x, y);
    y += LINE;
  }
  return y;
}

function addSectionTitle(doc: jsPDF, title: string, y: number): number {
  y = ensureNewPage(doc, y);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(title, MARGIN, y);
  y += LINE + 2;
  doc.setFont('helvetica', 'normal');
  return y;
}

export function buildBriefPdf(
  caseTitle: string,
  versionNumber: number,
  createdAt: string,
  briefJson: BriefJson
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

  // 3) Working Timeline
  y = addSectionTitle(doc, 'Working Timeline', y);
  const timeline = briefJson.working_timeline;
  if (!timeline?.length) {
    y = addWrappedText(doc, 'None.', MARGIN, y, 10);
  } else {
    for (const item of timeline) {
      const refs = (item.source_refs ?? item.source_ids ?? []).join(', ');
      const line =
        `${item.time_window || ''} — ${item.event || ''} (${item.confidence || ''}, ${item.basis || ''})${refs ? ` [${refs}]` : ''}`.trim();
      y = addWrappedText(doc, line, MARGIN, y, 10);
      y += 1;
    }
  }
  y += SECTION_GAP;

  // 4) Key Entities
  y = addSectionTitle(doc, 'Key Entities', y);
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
  y = addSectionTitle(doc, 'Contradictions / Tensions', y);
  const contradictions = briefJson.contradictions_tensions;
  if (!contradictions?.length) {
    y = addWrappedText(doc, 'None.', MARGIN, y, 10);
  } else {
    for (const c of contradictions) {
      const refs = (c.source_refs ?? []).join(', ');
      y = addWrappedText(
        doc,
        `${c.issue || ''}: ${c.details || ''}${refs ? ` [${refs}]` : ''}`.trim(),
        MARGIN,
        y,
        10
      );
      y += 1;
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

  const out = doc.output('arraybuffer');
  return new Uint8Array(out);
}
