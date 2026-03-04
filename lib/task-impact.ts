/**
 * Heuristic: estimate how completing a Next Moves task would affect the case integrity score.
 * Uses the same categories as lib/integrity-score (timeline 25, contradictions 20, gaps 15, etc.).
 * Falsification-style tasks (e.g. "If X were found it would contradict Y") are - (red);
 * evidence-building tasks are + (green). Point estimates are approximate.
 */
export interface TaskImpactEstimate {
  sign: '+' | '-';
  points: number;
}

const FALSIFICATION_PHRASES = [
  'contradict',
  'would weaken',
  'falsification',
  'if .* were found',
  'would undermine',
  'would disprove',
  'different date',
  'conflicting',
  'disconfirm',
];

export function estimateTaskImpact(
  taskTitle: string,
  weakPoints?: string[]
): TaskImpactEstimate {
  const title = (taskTitle ?? '').toLowerCase().trim();
  const weak = (weakPoints ?? []).join(' ').toLowerCase();

  const isFalsification = FALSIFICATION_PHRASES.some((phrase) => {
    try {
      return new RegExp(phrase, 'i').test(title);
    } catch {
      return title.includes(phrase);
    }
  });

  if (isFalsification) {
    return { sign: '-', points: 5 };
  }

  // Evidence-building / resolution tasks: + (improves score)
  // Rough max gains from integrity formula: resolve 1 contradiction +5, close 1 gap +5, add multi-ref event varies
  const resolveContradiction = /resolv|contradiction|tension|conflict/.test(title) && /contradiction|tension/.test(weak);
  const closeGap = /gap|missing|find evidence|verify|confirm|source|primary|official/.test(title);
  if (resolveContradiction) return { sign: '+', points: 5 };
  if (closeGap) return { sign: '+', points: 4 };
  return { sign: '+', points: 3 };
}
