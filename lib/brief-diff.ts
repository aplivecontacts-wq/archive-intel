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
    const p = prevTl[i] as unknown as Record<string, unknown> | undefined;
    const n = nextTl[i] as unknown as Record<string, unknown> | undefined;
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
    const o = e as unknown as Record<string, unknown>;
    prevEntities.set(entityKey(o), o);
  }
  const nextEntities = new Map<string, Record<string, unknown>>();
  for (const e of next.key_entities ?? []) {
    const o = e as unknown as Record<string, unknown>;
    nextEntities.set(entityKey(o), o);
  }
  for (const k of Array.from(nextEntities.keys())) {
    if (!prevEntities.has(k)) {
      out.push({
        section: 'key_entities',
        kind: 'added',
        label: `Entity: added '${String(nextEntities.get(k)?.name ?? k)}'`,
      });
    }
  }
  for (const k of Array.from(prevEntities.keys())) {
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
    const o = c as unknown as Record<string, unknown>;
    const issue = String(o.issue ?? '').trim();
    if (issue) prevIssues.set(issue, o);
  }
  const nextIssues = new Map<string, Record<string, unknown>>();
  for (const c of next.contradictions_tensions ?? []) {
    const o = c as unknown as Record<string, unknown>;
    const issue = String(o.issue ?? '').trim();
    if (issue) nextIssues.set(issue, o);
  }
  for (const issue of Array.from(nextIssues.keys())) {
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
  for (const issue of Array.from(prevIssues.keys())) {
    if (!nextIssues.has(issue)) {
      out.push({
        section: 'contradictions_tensions',
        kind: 'removed',
        label: `Contradiction: removed '${issue.slice(0, 50)}${issue.length > 50 ? '…' : ''}'`,
      });
    }
  }

  // Verification Tasks (by task string)
  const prevTasks = new Set<string>();
  for (const t of prev.verification_tasks ?? []) {
    const task = String((t as unknown as Record<string, unknown>).task ?? '').trim();
    if (task) prevTasks.add(task);
  }
  const nextTasks = new Set<string>();
  for (const t of next.verification_tasks ?? []) {
    const task = String((t as unknown as Record<string, unknown>).task ?? '').trim();
    if (task) nextTasks.add(task);
  }
  for (const task of Array.from(nextTasks)) {
    if (!prevTasks.has(task)) {
      out.push({
        section: 'verification_tasks',
        kind: 'added',
        label: `Verification task: added '${task.slice(0, 50)}${task.length > 50 ? '…' : ''}'`,
      });
    }
  }
  for (const task of Array.from(prevTasks)) {
    if (!nextTasks.has(task)) {
      out.push({
        section: 'verification_tasks',
        kind: 'removed',
        label: `Verification task: removed '${task.slice(0, 50)}${task.length > 50 ? '…' : ''}'`,
      });
    }
  }

  return out;
}
