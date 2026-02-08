export type InputType = 'url' | 'username' | 'quote';

export function detectInputType(input: string): InputType {
  const trimmed = input.trim();

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return 'url';
  }

  if (trimmed.startsWith('@') || /^[a-zA-Z0-9_]{3,}$/.test(trimmed)) {
    return 'username';
  }

  return 'quote';
}

export function normalizeInput(input: string, type: InputType): string {
  const trimmed = input.trim();

  if (type === 'url') {
    let normalized = trimmed.toLowerCase();
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  }

  if (type === 'username') {
    return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  }

  return trimmed;
}


export interface QueryWithCategory {
  source: 'search';
  title: string;
  url: null;
  captured_at: null;
  snippet: string;
  confidence: number;
  category?: string;
}

export function generateMockSearchQueries(input: string, inputType: InputType): QueryWithCategory[] {
  const queries: QueryWithCategory[] = [];

  if (inputType === 'url') {
    const domain = input.replace(/^https?:\/\//, '').split('/')[0];

    // EXISTING QUERIES
    queries.push({
      source: 'search' as const,
      title: `Site search for ${domain}`,
      url: null,
      captured_at: null,
      snippet: `site:${domain} "${input}"`,
      confidence: 0.9,
      category: 'Basic Search',
    });

    queries.push({
      source: 'search' as const,
      title: `Cache lookup`,
      url: null,
      captured_at: null,
      snippet: `cache:${input}`,
      confidence: 0.85,
      category: 'Basic Search',
    });

    queries.push({
      source: 'search' as const,
      title: `Related images`,
      url: null,
      captured_at: null,
      snippet: `filetype:jpg site:${domain}`,
      confidence: 0.75,
      category: 'Basic Search',
    });

    queries.push({
      source: 'search' as const,
      title: `PDF documents`,
      url: null,
      captured_at: null,
      snippet: `filetype:pdf site:${domain}`,
      confidence: 0.7,
      category: 'Basic Search',
    });

    // 1) STRUCTURAL PAGE QUERIES (ARCHIVE MAGNETS)
    queries.push({
      source: 'search' as const,
      title: `Press pages`,
      url: null,
      captured_at: null,
      snippet: `site:${domain} press`,
      confidence: 0.92,
      category: 'Structural Pages',
    });

    queries.push({
      source: 'search' as const,
      title: `Press releases`,
      url: null,
      captured_at: null,
      snippet: `site:${domain} "press release"`,
      confidence: 0.9,
      category: 'Structural Pages',
    });

    queries.push({
      source: 'search' as const,
      title: `News section`,
      url: null,
      captured_at: null,
      snippet: `site:${domain} news`,
      confidence: 0.9,
      category: 'Structural Pages',
    });

    queries.push({
      source: 'search' as const,
      title: `Reports`,
      url: null,
      captured_at: null,
      snippet: `site:${domain} reports`,
      confidence: 0.88,
      category: 'Structural Pages',
    });

    queries.push({
      source: 'search' as const,
      title: `Investigations`,
      url: null,
      captured_at: null,
      snippet: `site:${domain} investigations`,
      confidence: 0.85,
      category: 'Structural Pages',
    });

    queries.push({
      source: 'search' as const,
      title: `Publications`,
      url: null,
      captured_at: null,
      snippet: `site:${domain} publications`,
      confidence: 0.87,
      category: 'Structural Pages',
    });

    queries.push({
      source: 'search' as const,
      title: `Statements`,
      url: null,
      captured_at: null,
      snippet: `site:${domain} statements`,
      confidence: 0.86,
      category: 'Structural Pages',
    });

    // 2) FILE-TYPE SURVIVORSHIP QUERIES
    queries.push({
      source: 'search' as const,
      title: `PDF files (domain)`,
      url: null,
      captured_at: null,
      snippet: `filetype:pdf "${domain}"`,
      confidence: 0.93,
      category: 'File-Based Survivors',
    });

    queries.push({
      source: 'search' as const,
      title: `PDF on site`,
      url: null,
      captured_at: null,
      snippet: `filetype:pdf site:${domain}`,
      confidence: 0.9,
      category: 'File-Based Survivors',
    });

    queries.push({
      source: 'search' as const,
      title: `Word documents`,
      url: null,
      captured_at: null,
      snippet: `filetype:doc site:${domain}`,
      confidence: 0.82,
      category: 'File-Based Survivors',
    });

    queries.push({
      source: 'search' as const,
      title: `Word (modern format)`,
      url: null,
      captured_at: null,
      snippet: `filetype:docx site:${domain}`,
      confidence: 0.82,
      category: 'File-Based Survivors',
    });

    queries.push({
      source: 'search' as const,
      title: `Excel spreadsheets`,
      url: null,
      captured_at: null,
      snippet: `filetype:xls site:${domain}`,
      confidence: 0.78,
      category: 'File-Based Survivors',
    });

    queries.push({
      source: 'search' as const,
      title: `PowerPoint presentations`,
      url: null,
      captured_at: null,
      snippet: `filetype:ppt site:${domain}`,
      confidence: 0.78,
      category: 'File-Based Survivors',
    });

    // 3) EXTERNAL MENTIONS (OFF-SITE SURVIVORS)
    queries.push({
      source: 'search' as const,
      title: `Third-party mentions`,
      url: null,
      captured_at: null,
      snippet: `"${domain}" -site:${domain}`,
      confidence: 0.94,
      category: 'External Mentions',
    });

    queries.push({
      source: 'search' as const,
      title: `Full URL mentions`,
      url: null,
      captured_at: null,
      snippet: `"${input}" -site:${domain}`,
      confidence: 0.92,
      category: 'External Mentions',
    });

    // 4) TIME ANCHOR QUERIES
    const currentYear = new Date().getFullYear();
    const yearsBack = [1, 2, 3, 5, 7, 10];

    yearsBack.slice(0, 3).forEach((years) => {
      const year = currentYear - years;
      queries.push({
        source: 'search' as const,
        title: `${year} mentions`,
        url: null,
        captured_at: null,
        snippet: `"${domain}" ${year}`,
        confidence: 0.85,
        category: 'Time Anchors',
      });
    });

    queries.push({
      source: 'search' as const,
      title: `Lawsuits`,
      url: null,
      captured_at: null,
      snippet: `"${domain}" lawsuit`,
      confidence: 0.88,
      category: 'Time Anchors',
    });

    queries.push({
      source: 'search' as const,
      title: `Investigations`,
      url: null,
      captured_at: null,
      snippet: `"${domain}" investigation`,
      confidence: 0.89,
      category: 'Time Anchors',
    });

    // 5) AUTHORITY / OVERSIGHT LANGUAGE QUERIES
    queries.push({
      source: 'search' as const,
      title: `DOJ references`,
      url: null,
      captured_at: null,
      snippet: `"${domain}" DOJ`,
      confidence: 0.91,
      category: 'Authority & Oversight',
    });

    queries.push({
      source: 'search' as const,
      title: `OIG references`,
      url: null,
      captured_at: null,
      snippet: `"${domain}" OIG`,
      confidence: 0.89,
      category: 'Authority & Oversight',
    });

    queries.push({
      source: 'search' as const,
      title: `Oversight mentions`,
      url: null,
      captured_at: null,
      snippet: `"${domain}" oversight`,
      confidence: 0.87,
      category: 'Authority & Oversight',
    });

    queries.push({
      source: 'search' as const,
      title: `Audits`,
      url: null,
      captured_at: null,
      snippet: `"${domain}" audit`,
      confidence: 0.86,
      category: 'Authority & Oversight',
    });

    queries.push({
      source: 'search' as const,
      title: `Enforcement actions`,
      url: null,
      captured_at: null,
      snippet: `"${domain}" enforcement`,
      confidence: 0.88,
      category: 'Authority & Oversight',
    });

    queries.push({
      source: 'search' as const,
      title: `Complaints`,
      url: null,
      captured_at: null,
      snippet: `"${domain}" complaint`,
      confidence: 0.85,
      category: 'Authority & Oversight',
    });

    queries.push({
      source: 'search' as const,
      title: `Investigation records`,
      url: null,
      captured_at: null,
      snippet: `"${domain}" investigation`,
      confidence: 0.89,
      category: 'Authority & Oversight',
    });

  } else if (inputType === 'username') {
    // EXISTING QUERIES
    queries.push({
      source: 'search' as const,
      title: `Social media search`,
      url: null,
      captured_at: null,
      snippet: `"@${input}" site:twitter.com OR site:x.com`,
      confidence: 0.9,
      category: 'Basic Search',
    });

    queries.push({
      source: 'search' as const,
      title: `GitHub profile`,
      url: null,
      captured_at: null,
      snippet: `site:github.com "${input}"`,
      confidence: 0.85,
      category: 'Basic Search',
    });

    queries.push({
      source: 'search' as const,
      title: `LinkedIn search`,
      url: null,
      captured_at: null,
      snippet: `site:linkedin.com "${input}"`,
      confidence: 0.8,
      category: 'Basic Search',
    });

    // 2) FILE-TYPE SURVIVORSHIP QUERIES (for username/person)
    queries.push({
      source: 'search' as const,
      title: `PDF mentions`,
      url: null,
      captured_at: null,
      snippet: `filetype:pdf "${input}"`,
      confidence: 0.88,
      category: 'File-Based Survivors',
    });

    // 3) EXTERNAL MENTIONS
    queries.push({
      source: 'search' as const,
      title: `Forum mentions`,
      url: null,
      captured_at: null,
      snippet: `"${input}" site:reddit.com`,
      confidence: 0.82,
      category: 'External Mentions',
    });

    queries.push({
      source: 'search' as const,
      title: `News mentions`,
      url: null,
      captured_at: null,
      snippet: `"${input}" site:*.news`,
      confidence: 0.85,
      category: 'External Mentions',
    });

    // 4) TIME ANCHOR QUERIES
    queries.push({
      source: 'search' as const,
      title: `Lawsuit involvement`,
      url: null,
      captured_at: null,
      snippet: `"${input}" lawsuit`,
      confidence: 0.86,
      category: 'Time Anchors',
    });

    queries.push({
      source: 'search' as const,
      title: `Investigation mentions`,
      url: null,
      captured_at: null,
      snippet: `"${input}" investigation`,
      confidence: 0.87,
      category: 'Time Anchors',
    });

    // 5) AUTHORITY / OVERSIGHT LANGUAGE QUERIES
    queries.push({
      source: 'search' as const,
      title: `DOJ records`,
      url: null,
      captured_at: null,
      snippet: `"${input}" DOJ`,
      confidence: 0.89,
      category: 'Authority & Oversight',
    });

    queries.push({
      source: 'search' as const,
      title: `Oversight records`,
      url: null,
      captured_at: null,
      snippet: `"${input}" oversight`,
      confidence: 0.85,
      category: 'Authority & Oversight',
    });

    queries.push({
      source: 'search' as const,
      title: `Complaint records`,
      url: null,
      captured_at: null,
      snippet: `"${input}" complaint`,
      confidence: 0.84,
      category: 'Authority & Oversight',
    });

  } else {
    // EXISTING QUERIES FOR QUOTE/TEXT
    queries.push({
      source: 'search' as const,
      title: `Exact phrase match`,
      url: null,
      captured_at: null,
      snippet: `"${input}"`,
      confidence: 0.95,
      category: 'Basic Search',
    });

    queries.push({
      source: 'search' as const,
      title: `News articles`,
      url: null,
      captured_at: null,
      snippet: `"${input}" site:*.news OR site:*.com/news`,
      confidence: 0.8,
      category: 'Basic Search',
    });

    queries.push({
      source: 'search' as const,
      title: `Forum discussions`,
      url: null,
      captured_at: null,
      snippet: `"${input}" site:reddit.com OR site:*.forum`,
      confidence: 0.75,
      category: 'Basic Search',
    });

    // 2) FILE-TYPE SURVIVORSHIP QUERIES
    queries.push({
      source: 'search' as const,
      title: `PDF documents`,
      url: null,
      captured_at: null,
      snippet: `filetype:pdf "${input}"`,
      confidence: 0.9,
      category: 'File-Based Survivors',
    });

    queries.push({
      source: 'search' as const,
      title: `Word documents`,
      url: null,
      captured_at: null,
      snippet: `filetype:doc "${input}"`,
      confidence: 0.82,
      category: 'File-Based Survivors',
    });

    // 4) TIME ANCHOR QUERIES
    queries.push({
      source: 'search' as const,
      title: `Lawsuit context`,
      url: null,
      captured_at: null,
      snippet: `"${input}" lawsuit`,
      confidence: 0.85,
      category: 'Time Anchors',
    });

    queries.push({
      source: 'search' as const,
      title: `Investigation context`,
      url: null,
      captured_at: null,
      snippet: `"${input}" investigation`,
      confidence: 0.87,
      category: 'Time Anchors',
    });

    // 5) AUTHORITY / OVERSIGHT LANGUAGE QUERIES
    queries.push({
      source: 'search' as const,
      title: `Government records`,
      url: null,
      captured_at: null,
      snippet: `"${input}" site:*.gov`,
      confidence: 0.92,
      category: 'Authority & Oversight',
    });

    queries.push({
      source: 'search' as const,
      title: `Oversight mentions`,
      url: null,
      captured_at: null,
      snippet: `"${input}" oversight`,
      confidence: 0.86,
      category: 'Authority & Oversight',
    });

    queries.push({
      source: 'search' as const,
      title: `Audit records`,
      url: null,
      captured_at: null,
      snippet: `"${input}" audit`,
      confidence: 0.84,
      category: 'Authority & Oversight',
    });
  }

  return queries;
}
