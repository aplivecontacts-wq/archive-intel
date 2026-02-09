/**
 * Canonical query result categories for grouping.
 * Unknown/missing category falls back to "original".
 */
export type QueryCategory =
  | 'original'
  | 'structural'
  | 'file_survivorship'
  | 'external_mentions'
  | 'social_presence'
  | 'contact_presence'
  | 'time_anchors'
  | 'authority_language'
  | 'courts_corrections_us'
  | 'courts_records_international';

export const CATEGORY_ORDER: QueryCategory[] = [
  'original',
  'structural',
  'file_survivorship',
  'external_mentions',
  'social_presence',
  'contact_presence',
  'time_anchors',
  'authority_language',
  'courts_corrections_us',
  'courts_records_international',
];

export const CATEGORY_LABELS: Record<QueryCategory, string> = {
  original: 'Original Queries',
  structural: 'Structural Pages',
  file_survivorship: 'File Survivorship',
  external_mentions: 'External Mentions',
  social_presence: 'Social Presence',
  contact_presence: 'Contact & Presence',
  time_anchors: 'Time Anchors',
  authority_language: 'Authority Language',
  courts_corrections_us: 'Courts & Corrections (US)',
  courts_records_international: 'International Courts & Records',
};

/** Map legacy display names to canonical keys (backwards compat) */
const DISPLAY_TO_CANONICAL: Record<string, QueryCategory> = {
  'Basic Search': 'original',
  'Structural Pages': 'structural',
  'File-Based Survivors': 'file_survivorship',
  'External Mentions': 'external_mentions',
  'Social Presence': 'social_presence',
  'Contact & Presence': 'contact_presence',
  'Time Anchors': 'time_anchors',
  'Authority & Oversight': 'authority_language',
  'Courts & Corrections (US)': 'courts_corrections_us',
  'International Courts & Records': 'courts_records_international',
};

/** Infer category from title when DB has no category (UI-only, no persistence) */
const TITLE_TO_CATEGORY: Record<string, QueryCategory> = {
  'Press pages': 'structural',
  'Press releases': 'structural',
  'News section': 'structural',
  'Reports': 'structural',
  'Investigations': 'structural',
  'Publications': 'structural',
  'Statements': 'structural',
  'PDF files (domain)': 'file_survivorship',
  'PDF on site': 'file_survivorship',
  'Word documents': 'file_survivorship',
  'Word (modern format)': 'file_survivorship',
  'Excel spreadsheets': 'file_survivorship',
  'PowerPoint presentations': 'file_survivorship',
  'PDF mentions': 'file_survivorship',
  'PDF documents': 'file_survivorship',
  'Third-party mentions': 'external_mentions',
  'Full URL mentions': 'external_mentions',
  'Forum mentions': 'external_mentions',
  'News mentions': 'external_mentions',
  'Forum discussions': 'external_mentions',
  'Snapchat (limited)': 'social_presence',
  'WhatsApp public links': 'social_presence',
  'Linktree': 'social_presence',
  'Beacons': 'social_presence',
  'Instagram': 'contact_presence',
  'Facebook': 'contact_presence',
  'LinkedIn': 'contact_presence',
  'LinkedIn (company)': 'contact_presence',
  'X/Twitter': 'contact_presence',
  'TikTok': 'contact_presence',
  'YouTube': 'contact_presence',
  'Reddit': 'contact_presence',
  'Threads': 'contact_presence',
  'Telegram': 'contact_presence',
  'Discord invites': 'contact_presence',
  'GitHub': 'contact_presence',
  'Medium': 'contact_presence',
  'Substack': 'contact_presence',
  'LinkTr.ee': 'contact_presence',
  'Beacons.ai': 'contact_presence',
  'Carrd': 'contact_presence',
  'Bio.site': 'contact_presence',
  'Contact pages': 'contact_presence',
  'Public email indicators': 'contact_presence',
  'Press emails': 'contact_presence',
  'Public phone indicators': 'contact_presence',
  'Public address indicators': 'contact_presence',
  'PDF contact info': 'contact_presence',
  'WhatsApp links': 'contact_presence',
  'Instagram direct': 'contact_presence',
  'X direct': 'contact_presence',
  'Telegram direct': 'contact_presence',
  'GitHub direct': 'contact_presence',
  'Lawsuits': 'time_anchors',
  'Lawsuit involvement': 'time_anchors',
  'Investigation mentions': 'time_anchors',
  'Lawsuit context': 'time_anchors',
  'Investigation context': 'time_anchors',
  'News articles': 'original',
  'DOJ references': 'authority_language',
  'OIG references': 'authority_language',
  'Oversight mentions': 'authority_language',
  'Audits': 'authority_language',
  'Enforcement actions': 'authority_language',
  'Complaints': 'authority_language',
  'Investigation records': 'authority_language',
  'DOJ records': 'authority_language',
  'Oversight records': 'authority_language',
  'Complaint records': 'authority_language',
  'Government records': 'authority_language',
  'Audit records': 'authority_language',
  'CourtListener': 'courts_corrections_us',
  'RECAP Archive': 'courts_corrections_us',
  'PACER': 'courts_corrections_us',
  'PACER Case Locator': 'courts_corrections_us',
  'United States District Court': 'courts_corrections_us',
  'United States v.': 'courts_corrections_us',
  'Plaintiff v.': 'courts_corrections_us',
  'Defendant': 'courts_corrections_us',
  'Civil action': 'courts_corrections_us',
  'Indictment': 'courts_corrections_us',
  'Arraignment': 'courts_corrections_us',
  'Sentencing': 'courts_corrections_us',
  'BOP inmate locator': 'courts_corrections_us',
  'BOP inmate': 'courts_corrections_us',
  'ICC': 'courts_records_international',
  'ICJ': 'courts_records_international',
  'ECHR': 'courts_records_international',
  'WorldLII': 'courts_records_international',
  'BAILII': 'courts_records_international',
  'CanLII': 'courts_records_international',
  'AustLII': 'courts_records_international',
  'Court decision': 'courts_records_international',
  'Judicial decision': 'courts_records_international',
  'Tribunal': 'courts_records_international',
  'Case no.': 'courts_records_international',
};

export interface GroupedQueries<T> {
  original: T[];
  structural: T[];
  file_survivorship: T[];
  external_mentions: T[];
  social_presence: T[];
  contact_presence: T[];
  time_anchors: T[];
  authority_language: T[];
  courts_corrections_us: T[];
  courts_records_international: T[];
}

function toCanonicalCategory(raw: string | null | undefined, title?: string): QueryCategory {
  if (raw) {
    const lower = raw.trim().toLowerCase();
    if (CATEGORY_ORDER.includes(lower as QueryCategory)) return lower as QueryCategory;
    const mapped = DISPLAY_TO_CANONICAL[raw.trim()];
    if (mapped) return mapped;
  }
  if (title && TITLE_TO_CATEGORY[title]) return TITLE_TO_CATEGORY[title];
  if (title && title.startsWith('Site search for ')) return 'original';
  if (title && title.startsWith('Cache lookup')) return 'original';
  if (title && title.startsWith('Related images')) return 'original';
  if (title && title.startsWith('Social media search')) return 'original';
  if (title && title.startsWith('GitHub profile')) return 'original';
  if (title && title.startsWith('LinkedIn search')) return 'original';
  if (title && title.startsWith('Exact phrase match')) return 'original';
  if (title && /^\d{4} mentions$/.test(title)) return 'time_anchors';
  return 'original';
}

/** Dev assertion: warn if too many items fall to original (indicates mapping regression) */
export function assertCategoryDistribution<T extends { category?: string | null; title?: string }>(
  items: T[],
  grouped: GroupedQueries<T>,
  maxOriginalRatio = 0.9
): void {
  if (process.env.NODE_ENV !== 'development' || items.length < 5) return;
  const originalCount = grouped.original.length;
  const ratio = originalCount / items.length;
  if (ratio > maxOriginalRatio) {
    console.warn(
      `[groupQueries] ${Math.round(ratio * 100)}% of results in "Original" - possible categorization regression. Sample titles:`,
      items.slice(0, 5).map((i) => i.title)
    );
  }
}

/**
 * Groups query result items by canonical category.
 * Items with missing/unknown category fall into "original".
 * UI-only: infers category from title when not in response.
 */
export function groupQueries<T extends { category?: string | null; title?: string }>(
  items: T[]
): GroupedQueries<T> {
  const out: GroupedQueries<T> = {
    original: [],
    structural: [],
    file_survivorship: [],
    external_mentions: [],
    social_presence: [],
    contact_presence: [],
    time_anchors: [],
    authority_language: [],
    courts_corrections_us: [],
    courts_records_international: [],
  };
  for (const item of items) {
    if (process.env.NODE_ENV === 'development' && (item.category == null || item.category === '')) {
      console.warn('[groupQueries] Missing category for item:', { title: item.title, id: (item as any).id });
    }
    const cat = toCanonicalCategory(item.category, item.title);
    out[cat].push(item);
  }
  return out;
}
