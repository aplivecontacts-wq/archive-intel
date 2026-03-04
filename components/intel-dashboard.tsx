'use client';

import { Card, CardContent } from '@/components/ui/card';

interface IntelDashboardProps {
  briefJson: Record<string, unknown>;
  caseId: string;
}

export function IntelDashboard({
  briefJson: bj,
  caseId,
}: IntelDashboardProps) {
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

      {/* Executive Overview — directly under Instrument Panel */}
      {typeof bj.executive_overview === 'string' && bj.executive_overview.trim() !== '' && (
        <Card className="bg-white border-emerald-200">
          <CardContent className="pt-4">
            <h3 className="text-emerald-700 font-semibold mb-2">Executive Overview</h3>
            <p className="text-gray-700 whitespace-pre-wrap text-sm">
              {bj.executive_overview}
            </p>
          </CardContent>
        </Card>
      )}

      {/* 2) Contradictions + Hypotheses + Collapse Tests */}
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

    </div>
  );
}
