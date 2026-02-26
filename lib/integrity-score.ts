/**
 * Phase 11.3: Deterministic structural integrity score for a brief.
 * NO AI. Same input → same output. Uses only brief_json (and evidence_index).
 */
import type { BriefJson, BriefIntegrityScore, EvidenceIndex } from '@/lib/ai/brief-schema';

const NEWS_DOMAINS = [
  'nytimes.com', 'bbc.com', 'reuters.com', 'apnews.com', 'washingtonpost.com',
  'theguardian.com', 'npr.org', 'cnn.com', 'abcnews.go.com', 'cbsnews.com',
  'nbcnews.com', 'pbs.org', 'aljazeera.com', 'axios.com', 'politico.com',
  'bloomberg.com', 'wsj.com', 'ft.com', 'economist.com', 'latimes.com',
  'usatoday.com', 'usnews.com', 'newsweek.com', 'time.com',
];
const SOCIAL_DOMAINS = [
  'twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'tiktok.com', 'reddit.com',
  'youtube.com', 'linkedin.com', 'threads.net', 'snapchat.com',
];

function classifyEntry(entry: { type?: string; url?: string }): 'official' | 'established_news' | 'social' | 'internal' | 'unverified' {
  const type = (entry.type ?? '').toLowerCase();
  if (type === 'note' || type === 'confidential') return 'internal';
  const url = (entry.url ?? '').toLowerCase();
  if (!url) return 'unverified';
  if (url.endsWith('.gov') || url.includes('.gov/')) return 'official';
  if (NEWS_DOMAINS.some((d) => url.includes(d))) return 'established_news';
  if (SOCIAL_DOMAINS.some((d) => url.includes(d))) return 'social';
  return 'unverified';
}

function getCredibilityCounts(evidenceIndex: EvidenceIndex): { strong: number; total: number } {
  const entries = evidenceIndex && typeof evidenceIndex === 'object' && !Array.isArray(evidenceIndex)
    ? Object.values(evidenceIndex)
    : [];
  let official = 0, establishedNews = 0;
  for (const entry of entries) {
    const e = entry && typeof entry === 'object' ? entry : {};
    const cat = classifyEntry(e);
    if (cat === 'official') official++;
    else if (cat === 'established_news') establishedNews++;
  }
  return { strong: official + establishedNews, total: entries.length };
}

export function computeIntegrityScore(brief: BriefJson): BriefIntegrityScore {
  // A) Timeline coverage (0–25)
  const timeline = brief.working_timeline ?? [];
  const totalEvents = timeline.length;
  let multiRefCount = 0;
  for (const item of timeline) {
    const refs = item.source_refs ?? item.source_ids ?? [];
    if (refs.length >= 2) multiRefCount++;
  }
  const timelinePct = totalEvents === 0 ? 0 : (multiRefCount / totalEvents) * 100;
  const timeline_score = totalEvents === 0 ? 0 : (timelinePct / 100) * 25;

  // B) Unresolved contradictions (0–20): 0→20, 1–2→15, 3–4→10, 5+→0
  const contradictionCount = (brief.contradictions_tensions ?? []).length;
  let contradiction_score: number;
  if (contradictionCount === 0) contradiction_score = 20;
  else if (contradictionCount <= 2) contradiction_score = 15;
  else if (contradictionCount <= 4) contradiction_score = 10;
  else contradiction_score = 0;

  // C) Critical gaps (0–15): 0→15, 1–2→10, 3–4→5, 5+→0
  const gapCount = (brief.critical_gaps ?? []).length;
  let gap_score: number;
  if (gapCount === 0) gap_score = 15;
  else if (gapCount <= 2) gap_score = 10;
  else if (gapCount <= 4) gap_score = 5;
  else gap_score = 0;

  // D) Credibility mix (0–20)
  const { strong: strongSources, total: totalSources } = getCredibilityCounts(brief.evidence_index ?? {});
  const credibility_score = totalSources === 0 ? 0 : (strongSources / totalSources) * 20;

  // E) Hypothesis balance (0–20)
  const hypotheses = brief.hypotheses ?? [];
  const totalHyp = hypotheses.length;
  let meaningfulCount = 0;
  for (const h of hypotheses) {
    const against = h.evidence_against ?? [];
    if (against.length > 0) meaningfulCount++;
  }
  const hypothesis_score = totalHyp === 0 ? 0 : (meaningfulCount / totalHyp) * 20;

  const raw = timeline_score + contradiction_score + gap_score + credibility_score + hypothesis_score;
  const score_0_100 = Math.round(Math.max(0, Math.min(100, raw)));

  // Grade bands: 90–100 A, 80–89 B, 70–79 C, 60–69 D, <60 F
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (score_0_100 >= 90) grade = 'A';
  else if (score_0_100 >= 80) grade = 'B';
  else if (score_0_100 >= 70) grade = 'C';
  else if (score_0_100 >= 60) grade = 'D';
  else grade = 'F';

  const drivers: string[] = [];
  if (timeline_score > 20) drivers.push('High proportion of timeline events supported by multiple evidence references.');
  if (contradiction_score >= 18) drivers.push('Minimal unresolved contradictions.');
  if (credibility_score > 15) drivers.push('Strong share of official or established news sources.');
  if (hypothesis_score > 15) drivers.push('Hypotheses include meaningful counter-evidence.');
  if (gap_score >= 10 && gapCount === 0) drivers.push('No critical evidence gaps identified.');

  const weak_points: string[] = [];
  if (timeline_score < 10 && totalEvents > 0) weak_points.push('Low proportion of timeline events with multiple supporting references.');
  if (contradiction_score < 10 && contradictionCount > 0) weak_points.push('Multiple unresolved contradictions present.');
  if (gap_score < 7 && gapCount > 0) weak_points.push('Several critical evidence gaps remain.');
  if (credibility_score < 10 && totalSources > 0) weak_points.push('Heavy reliance on lower-credibility or unverified sources.');
  if (hypothesis_score < 10 && totalHyp > 0) weak_points.push('Hypotheses lack meaningful counter-evidence.');

  return {
    score_0_100,
    grade,
    drivers: drivers.slice(0, 3),
    weak_points: weak_points.slice(0, 3),
  };
}
