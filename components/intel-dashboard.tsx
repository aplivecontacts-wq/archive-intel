'use client';

import { Card, CardContent } from '@/components/ui/card';

export interface IntelDashboardEntity {
  id: string;
  name: string;
  entity_type: string;
  mention_count: number;
}

export interface IntelDashboardTask {
  id: string;
  title: string;
  status: string;
  detail?: string | null;
}

interface IntelDashboardProps {
  briefJson: Record<string, unknown>;
  caseId: string;
  entities?: IntelDashboardEntity[];
  onOpenEntityMentions?: (entity: IntelDashboardEntity) => void;
  tasks?: IntelDashboardTask[];
  fetchTasks?: () => void;
}

export function IntelDashboard({
  briefJson: bj,
  caseId,
  entities = [],
  onOpenEntityMentions,
  tasks = [],
  fetchTasks,
}: IntelDashboardProps) {
  const evidenceIndex = (bj.evidence_index ?? {}) as Record<string, { type?: string; description?: string; url?: string }>;

  return (
    <div className="space-y-4 font-mono text-sm">
      <h2 className="text-emerald-700 font-semibold text-base border-b border-emerald-200 pb-2">
        Intel Dashboard
      </h2>

      {/* 1) Instrument panel */}
      <Card className="bg-white border-emerald-200">
        <CardContent className="pt-4 space-y-3">
          <h3 className="text-emerald-700 font-semibold mb-2">Instrument Panel</h3>
          {bj.integrity_score != null && typeof bj.integrity_score === 'object' && (
            <div className="text-sm space-y-1">
              <p className="text-gray-900 font-medium">
                Score: {Number((bj.integrity_score as Record<string, unknown>).score_0_100) ?? 0}/100 — Grade: {String((bj.integrity_score as Record<string, unknown>).grade ?? '—')}
              </p>
              {Array.isArray((bj.integrity_score as Record<string, unknown>).drivers) && ((bj.integrity_score as Record<string, unknown>).drivers as string[]).length > 0 && (
                <p className="text-gray-600 text-xs">Drivers: {((bj.integrity_score as Record<string, unknown>).drivers as string[]).slice(0, 3).join('; ')}</p>
              )}
            </div>
          )}
          {typeof bj.source_credibility_summary === 'string' && bj.source_credibility_summary.trim() !== '' && (
            <p className="text-gray-600 text-xs">{bj.source_credibility_summary}</p>
          )}
          {Array.isArray(bj.coherence_alerts) && bj.coherence_alerts.length > 0 && (
            <ul className="space-y-1.5">
              {(bj.coherence_alerts as Array<Record<string, unknown>>).slice(0, 3).map((a, i) => (
                <li key={i} className="text-xs border-l-2 border-amber-200 pl-2 text-gray-700">
                  <span className="font-medium">{String(a.severity)}:</span> {String(a.alert ?? '').slice(0, 80)}
                  {String(a.alert ?? '').length > 80 ? '…' : ''}
                </li>
              ))}
            </ul>
          )}
          {(!bj.integrity_score && typeof bj.source_credibility_summary !== 'string' && (!Array.isArray(bj.coherence_alerts) || bj.coherence_alerts.length === 0)) && (
            <p className="text-gray-400 text-xs italic">Not computed for this version.</p>
          )}
        </CardContent>
      </Card>

      {/* 2) Top Entities */}
      <Card className="bg-white border-emerald-200">
        <CardContent className="pt-4">
          <h3 className="text-emerald-700 font-semibold mb-2">Top Entities</h3>
          {entities.length === 0 ? (
            <p className="text-gray-400 text-xs">No entities. Rebuild from case page.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {entities.slice(0, 15).map((e) => (
                <li key={e.id}>
                  {onOpenEntityMentions ? (
                    <button
                      type="button"
                      onClick={() => onOpenEntityMentions(e)}
                      className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
                    >
                      {e.name} <span className="text-emerald-600">({e.mention_count})</span>
                    </button>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {e.name} ({e.mention_count})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 3) Working Timeline with evidence chips */}
      <Card className="bg-white border-emerald-200">
        <CardContent className="pt-4">
          <h3 className="text-emerald-700 font-semibold mb-2">Working Timeline</h3>
          {Array.isArray(bj.working_timeline) && bj.working_timeline.length > 0 ? (
            <ul className="space-y-2">
              {(bj.working_timeline as Array<Record<string, unknown>>).map((item, i) => {
                const refs = Array.from(new Set((item.source_ids ?? item.source_refs ?? []) as string[]));
                return (
                  <li key={i} className="border-l-2 border-emerald-200 pl-3 py-1 text-xs">
                    <span className="text-gray-500">{String(item.time_window ?? '')}</span>
                    {' — '}
                    <span className="text-gray-800">{String(item.event ?? '').slice(0, 60)}{String(item.event ?? '').length > 60 ? '…' : ''}</span>
                    {refs.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {refs.map((id) => {
                          const ev = evidenceIndex[id];
                          const label = ev
                            ? (ev.description && String(ev.description).trim() ? String(ev.description).trim().slice(0, 30) : ev.type ? `${ev.type}` : id)
                            : id;
                          if (ev?.url) {
                            return (
                              <a
                                key={id}
                                href={ev.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-600 hover:underline px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-100"
                              >
                                [{label}]
                              </a>
                            );
                          }
                          return (
                            <span key={id} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                              [{String(label)}]
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-gray-400 text-xs italic">No timeline in this brief.</p>
          )}
        </CardContent>
      </Card>

      {/* 4) Contradictions + Hypotheses + Collapse Tests */}
      <Card className="bg-white border-emerald-200">
        <CardContent className="pt-4 space-y-3">
          <h3 className="text-emerald-700 font-semibold mb-2">Contradictions / Tensions</h3>
          {Array.isArray(bj.contradictions_tensions) && bj.contradictions_tensions.length > 0 ? (
            <ul className="space-y-1.5 text-xs">
              {(bj.contradictions_tensions as Array<Record<string, unknown>>).map((c, i) => (
                <li key={i} className="border-l-2 border-amber-200 pl-2 text-gray-700">
                  {String(c.issue ?? '')}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400 text-xs italic">None.</p>
          )}

          <h3 className="text-emerald-700 font-semibold mb-2 pt-2">Hypotheses</h3>
          {Array.isArray(bj.hypotheses) && bj.hypotheses.length > 0 ? (
            <ul className="space-y-1.5 text-xs">
              {(bj.hypotheses as Array<Record<string, unknown>>).map((h, i) => (
                <li key={i} className="border-l-2 border-emerald-200 pl-2 text-gray-700">
                  {String(h.statement ?? '').slice(0, 80)}{String(h.statement ?? '').length > 80 ? '…' : ''}
                  {h.likelihood != null && <span className="text-gray-500 ml-1">[{String(h.likelihood)}]</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400 text-xs italic">None.</p>
          )}

          <h3 className="text-emerald-700 font-semibold mb-2 pt-2">Collapse Tests</h3>
          {Array.isArray(bj.collapse_tests) && bj.collapse_tests.length > 0 ? (
            <ul className="space-y-1.5 text-xs">
              {(bj.collapse_tests as Array<Record<string, unknown>>).map((t, i) => (
                <li key={i} className="border-l-2 border-amber-200 pl-2 text-gray-700">
                  {String(t.claim_or_hypothesis ?? '').slice(0, 80)}{String(t.claim_or_hypothesis ?? '').length > 80 ? '…' : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400 text-xs italic">None.</p>
          )}
        </CardContent>
      </Card>

      {/* 5) Next Moves */}
      <Card className="bg-white border-emerald-200">
        <CardContent className="pt-4">
          <h3 className="text-emerald-700 font-semibold mb-2">Next Moves</h3>
          {tasks.length === 0 ? (
            <p className="text-gray-400 text-xs">No case tasks. Import from brief or add manually on the case page.</p>
          ) : (
            <ul className="space-y-1.5">
              {tasks
                .filter((t) => t.status === 'open' || t.status === 'in_progress')
                .slice(0, 10)
                .map((t) => (
                  <li key={t.id} className="flex items-start gap-2 text-xs">
                    {fetchTasks && (
                      <input
                        type="checkbox"
                        className="mt-0.5 shrink-0"
                        onChange={async () => {
                          const res = await fetch(`/api/cases/${caseId}/tasks/${t.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: 'done' }),
                          });
                          if (res.ok) fetchTasks();
                        }}
                        aria-label={`Mark "${t.title}" done`}
                      />
                    )}
                    <span className="text-gray-700">{t.title}</span>
                  </li>
                ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
