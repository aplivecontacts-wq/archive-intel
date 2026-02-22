/**
 * Deterministic diff between two brief_json versions.
 * No network. No OpenAI. Pure JSON comparison.
 * Used at generation time to populate changes_since_last_version.
 */

import type { BriefJson, BriefChangeEntry } from '@/lib/ai/brief-schema';

function timelineFingerprint(item: Record<string, unknown>): string {
  const ids = (item.source_ids ?? item.source_refs ?? []) as string[];
  const sorted = Array.isArray(ids) ? [...ids].sort() : [];
  return [
    String(item.time_window ?? ''),
    String(item.event ?? ''),
    String(item.confidence ?? ''),
    String(item.basis ?? ''),
    sorted.join(','),
  ].join('|');
}

function entityKey(e: Record<string, unknown>): string {
  return `${String(e.name ?? '').trim()}::${String(e.type ?? '')}`;
}

export function computeChangesSinceLastVersion(
  prev: BriefJson,
  next: BriefJson
): BriefChangeEntry[] {
  const out: BriefChangeEntry[] = [];

  // Executive Overview
  const prevExec = (prev.executive_overview ?? '').trim();
  const nextExec = (next.executive_overview ?? '').trim();
  if (prevExec !== nextExec) {
    out.push({
      section: 'executive_overview',
      kind: 'modified',
      label: 'Executive overview updated',
    });
  }

  // Working Timeline (by index; ignore verified)
  const prevTl = prev.working_timeline ?? [];
  const nextTl = next.working_timeline ?? [];
  const maxTl = Math.max(prevTl.length, nextTl.length);
  for (let i = 0; i < maxTl; i++) {
    const p = prevTl[i] as Record<string, unknown> | undefined;
    const n = nextTl[i] as Record<string, unknown> | undefined;
    if (!p && n) {
      const event = String((n as Record<string, unknown>).event ?? '').slice(0, 60);
      out.push({
        section: 'working_timeline',
        kind: 'added',
        label: `Timeline: added event '${event}${event.length >= 60 ? '…' : ''}'`,
      });
    } else if (p && !n) {
      const event = String((p as Record<string, unknown>).event ?? '').slice(0, 60);
      out.push({
        section: 'working_timeline',
        kind: 'removed',
        label: `Timeline: removed event '${event}${event.length >= 60 ? '…' : ''}'`,
      });
    } else if (p && n && timelineFingerprint(p) !== timelineFingerprint(n)) {
      const event = String((n as Record<string, unknown>).event ?? '').slice(0, 60);
      out.push({
        section: 'working_timeline',
        kind: 'modified',
        label: `Timeline: modified event '${event}${event.length >= 60 ? '…' : ''}'`,
      });
    }
  }

  // Key Entities (by name + type)
  const prevEntities = new Map<string, Record<string, unknown>>();
  for (const e of prev.key_entities ?? []) {
    const o = e as Record<string, unknown>;
    prevEntities.set(entityKey(o), o);
  }
  const nextEntities = new Map<string, Record<string, unknown>>();
  for (const e of next.key_entities ?? []) {
    const o = e as Record<string, unknown>;
    nextEntities.set(entityKey(o), o);
  }
  for (const [k] of nextEntities) {
    if (!prevEntities.has(k)) {
      out.push({
        section: 'key_entities',
        kind: 'added',
        label: `Entity: added '${String(nextEntities.get(k)?.name ?? k)}'`,
      });
    }
  }
  for (const [k] of prevEntities) {
    if (!nextEntities.has(k)) {
      out.push({
        section: 'key_entities',
        kind: 'removed',
        label: `Entity: removed '${String(prevEntities.get(k)?.name ?? k)}'`,
      });
    }
  }

  // Contradictions (by issue)
  const prevIssues = new Map<string, Record<string, unknown>>();
  for (const c of prev.contradictions_tensions ?? []) {
    const o = c as Record<string, unknown>;
    const issue = String(o.issue ?? '').trim();
    if (issue) prevIssues.set(issue, o);
  }
  const nextIssues = new Map<string, Record<string, unknown>>();
  for (const c of next.contradictions_tensions ?? []) {
    const o = c as Record<string, unknown>;
    const issue = String(o.issue ?? '').trim();
    if (issue) nextIssues.set(issue, o);
  }
  for (const [issue] of nextIssues) {
    if (!prevIssues.has(issue)) {
      out.push({
        section: 'contradictions_tensions',
        kind: 'added',
        label: `Contradiction: added '${issue.slice(0, 50)}${issue.length > 50 ? '…' : ''}'`,
      });
    } else if (JSON.stringify(prevIssues.get(issue)) !== JSON.stringify(nextIssues.get(issue))) {
      out.push({
        section: 'contradictions_tensions',
        kind: 'modified',
        label: `Contradiction: modified '${issue.slice(0, 50)}${issue.length > 50 ? '…' : ''}'`,
      });
    }
  }
  for (const [issue] of prevIssues) {
    if (!nextIssues.has(issue)) {
      out.push({
        section: 'contradictions_tensions',
        kind: 'removed',
        label: `Contradiction: removed '${issue.slice(0, 50)}${issue.length > 50 ? '…' : ''}'`,
      });
    }
  }

  // Hypotheses (by statement)
  const prevHyp = new Map<string, Record<string, unknown>>();
  for (const h of prev.hypotheses ?? []) {
    const o = h as Record<string, unknown>;
    const st = String(o.statement ?? '').trim();
    if (st) prevHyp.set(st, o);
  }
  const nextHyp = new Map<string, Record<string, unknown>>();
  for (const h of next.hypotheses ?? []) {
    const o = h as Record<string, unknown>;
    const st = String(o.statement ?? '').trim();
    if (st) nextHyp.set(st, o);
  }
  for (const [st] of nextHyp) {
    if (!prevHyp.has(st)) {
      out.push({
        section: 'hypotheses',
        kind: 'added',
        label: `Hypothesis: added '${st.slice(0, 50)}${st.length > 50 ? '…' : ''}'`,
      });
    } else if (JSON.stringify(prevHyp.get(st)) !== JSON.stringify(nextHyp.get(st))) {
      out.push({
        section: 'hypotheses',
        kind: 'modified',
        label: `Hypothesis: modified '${st.slice(0, 50)}${st.length > 50 ? '…' : ''}'`,
      });
    }
  }
  for (const [st] of prevHyp) {
    if (!nextHyp.has(st)) {
      out.push({
        section: 'hypotheses',
        kind: 'removed',
        label: `Hypothesis: removed '${st.slice(0, 50)}${st.length > 50 ? '…' : ''}'`,
      });
    }
  }

  // Critical Gaps (by missing_item)
  const prevGaps = new Map<string, Record<string, unknown>>();
  for (const g of prev.critical_gaps ?? []) {
    const o = g as Record<string, unknown>;
    const m = String(o.missing_item ?? '').trim();
    if (m) prevGaps.set(m, o);
  }
  const nextGaps = new Map<string, Record<string, unknown>>();
  for (const g of next.critical_gaps ?? []) {
    const o = g as Record<string, unknown>;
    const m = String(o.missing_item ?? '').trim();
    if (m) nextGaps.set(m, o);
  }
  for (const [m] of nextGaps) {
    if (!prevGaps.has(m)) {
      out.push({
        section: 'critical_gaps',
        kind: 'added',
        label: `Critical gap: added '${m.slice(0, 50)}${m.length > 50 ? '…' : ''}'`,
      });
    } else if (JSON.stringify(prevGaps.get(m)) !== JSON.stringify(nextGaps.get(m))) {
      out.push({
        section: 'critical_gaps',
        kind: 'modified',
        label: `Critical gap: modified '${m.slice(0, 50)}${m.length > 50 ? '…' : ''}'`,
      });
    }
  }
  for (const [m] of prevGaps) {
    if (!nextGaps.has(m)) {
      out.push({
        section: 'critical_gaps',
        kind: 'removed',
        label: `Critical gap: removed '${m.slice(0, 50)}${m.length > 50 ? '…' : ''}'`,
      });
    }
  }

  // Verification Tasks (by task string)
  const prevTasks = new Set<string>();
  for (const t of prev.verification_tasks ?? []) {
    const task = String((t as Record<string, unknown>).task ?? '').trim();
    if (task) prevTasks.add(task);
  }
  const nextTasks = new Set<string>();
  for (const t of next.verification_tasks ?? []) {
    const task = String((t as Record<string, unknown>).task ?? '').trim();
    if (task) nextTasks.add(task);
  }
  for (const task of nextTasks) {
    if (!prevTasks.has(task)) {
      out.push({
        section: 'verification_tasks',
        kind: 'added',
        label: `Verification task: added '${task.slice(0, 50)}${task.length > 50 ? '…' : ''}'`,
      });
    }
  }
  for (const task of prevTasks) {
    if (!nextTasks.has(task)) {
      out.push({
        section: 'verification_tasks',
        kind: 'removed',
        label: `Verification task: removed '${task.slice(0, 50)}${task.length > 50 ? '…' : ''}'`,
      });
    }
  }

  // Evidence Strength (by theme)
  const prevEs = new Map<string, Record<string, unknown>>();
  for (const e of prev.evidence_strength ?? []) {
    const o = e as Record<string, unknown>;
    const theme = String(o.theme ?? '').trim();
    if (theme) prevEs.set(theme, o);
  }
  const nextEs = new Map<string, Record<string, unknown>>();
  for (const e of next.evidence_strength ?? []) {
    const o = e as Record<string, unknown>;
    const theme = String(o.theme ?? '').trim();
    if (theme) nextEs.set(theme, o);
  }
  for (const [theme] of nextEs) {
    if (!prevEs.has(theme)) {
      out.push({
        section: 'evidence_strength',
        kind: 'added',
        label: `Evidence strength: added theme '${theme.slice(0, 40)}${theme.length > 40 ? '…' : ''}'`,
      });
    } else if (JSON.stringify(prevEs.get(theme)) !== JSON.stringify(nextEs.get(theme))) {
      out.push({
        section: 'evidence_strength',
        kind: 'modified',
        label: `Evidence strength: modified theme '${theme.slice(0, 40)}${theme.length > 40 ? '…' : ''}'`,
      });
    }
  }
  for (const [theme] of prevEs) {
    if (!nextEs.has(theme)) {
      out.push({
        section: 'evidence_strength',
        kind: 'removed',
        label: `Evidence strength: removed theme '${theme.slice(0, 40)}${theme.length > 40 ? '…' : ''}'`,
      });
    }
  }

  return out;
}
