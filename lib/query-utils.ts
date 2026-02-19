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

/**
 * Sanitize a search snippet for use in Google URLs and display.
 * Google does not support site:* (wildcard) in site: operator; it breaks the search.
 * Replaces those patterns so the link works and the displayed query is clear.
 */
export function sanitizeSnippetForGoogle(snippet: string): string {
  return snippet
    .replace(/site:\*\.news/gi, 'news')
    .replace(/site:\*\.com\/news/gi, 'news')
    .replace(/site:\*\.forum/gi, 'forum')
    .replace(/site:\*\.gov/gi, '.gov')
    .replace(/\s+/g, ' ')
    .trim();
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
      category: 'original',
    });

    queries.push({
      source: 'search' as const,
      title: `Cache lookup`,
      url: null,
      captured_at: null,
      snippet: `cache:${input}`,
      confidence: 0.85,
      category: 'original',
    });

    queries.push({
      source: 'search' as const,
      title: `Related images`,
      url: null,
      captured_at: null,
      snippet: `filetype:jpg site:${domain}`,
      confidence: 0.75,
      category: 'original',
    });

    queries.push({
      source: 'search' as const,
      title: `PDF documents`,
      url: null,
      captured_at: null,
      snippet: `filetype:pdf site:${domain}`,
      confidence: 0.7,
      category: 'original',
    });

    // 1) STRUCTURAL PAGE QUERIES (ARCHIVE MAGNETS)
    queries.push({
      source: 'search' as const,
      title: `Press pages`,
      url: null,
      captured_at: null,
      snippet: `site:${domain} press`,
      confidence: 0.92,
      category: 'structural',
    });

    queries.push({
      source: 'search' as const,
      title: `Press releases`,
      url: null,
      captured_at: null,
      snippet: `site:${domain} "press release"`,
      confidence: 0.9,
      category: 'structural',
    });

    queries.push({
      source: 'search' as const,
      title: `News section`,
      url: null,
      captured_at: null,
      snippet: `site:${domain} news`,
      confidence: 0.9,
      category: 'structural',
    });

    queries.push({
      source: 'search' as const,
      title: `Reports`,
      url: null,
      captured_at: null,
      snippet: `site:${domain} reports`,
      confidence: 0.88,
      category: 'structural',
    });

    queries.push({
      source: 'search' as const,
      title: `Investigations`,
      url: null,
      captured_at: null,
      snippet: `site:${domain} investigations`,
      confidence: 0.85,
      category: 'structural',
    });

    queries.push({
      source: 'search' as const,
      title: `Publications`,
      url: null,
      captured_at: null,
      snippet: `site:${domain} publications`,
      confidence: 0.87,
      category: 'structural',
    });

    queries.push({
      source: 'search' as const,
      title: `Statements`,
      url: null,
      captured_at: null,
      snippet: `site:${domain} statements`,
      confidence: 0.86,
      category: 'structural',
    });

    // 2) FILE-TYPE SURVIVORSHIP QUERIES
    queries.push({
      source: 'search' as const,
      title: `PDF files (domain)`,
      url: null,
      captured_at: null,
      snippet: `filetype:pdf "${domain}"`,
      confidence: 0.93,
      category: 'file_survivorship',
    });

    queries.push({
      source: 'search' as const,
      title: `PDF on site`,
      url: null,
      captured_at: null,
      snippet: `filetype:pdf site:${domain}`,
      confidence: 0.9,
      category: 'file_survivorship',
    });

    queries.push({
      source: 'search' as const,
      title: `Word documents`,
      url: null,
      captured_at: null,
      snippet: `filetype:doc site:${domain}`,
      confidence: 0.82,
      category: 'file_survivorship',
    });

    queries.push({
      source: 'search' as const,
      title: `Word (modern format)`,
      url: null,
      captured_at: null,
      snippet: `filetype:docx site:${domain}`,
      confidence: 0.82,
      category: 'file_survivorship',
    });

    queries.push({
      source: 'search' as const,
      title: `Excel spreadsheets`,
      url: null,
      captured_at: null,
      snippet: `filetype:xls site:${domain}`,
      confidence: 0.78,
      category: 'file_survivorship',
    });

    queries.push({
      source: 'search' as const,
      title: `PowerPoint presentations`,
      url: null,
      captured_at: null,
      snippet: `filetype:ppt site:${domain}`,
      confidence: 0.78,
      category: 'file_survivorship',
    });

    // 3) EXTERNAL MENTIONS (OFF-SITE SURVIVORS)
    queries.push({
      source: 'search' as const,
      title: `Third-party mentions`,
      url: null,
      captured_at: null,
      snippet: `"${domain}" -site:${domain}`,
      confidence: 0.94,
      category: 'external_mentions',
    });

    queries.push({
      source: 'search' as const,
      title: `Full URL mentions`,
      url: null,
      captured_at: null,
      snippet: `"${input}" -site:${domain}`,
      confidence: 0.92,
      category: 'external_mentions',
    });

    // 3a) SOCIAL PRESENCE (for URL/domain)
    const termForSocial = domain;
    const socialPresenceQueriesUrl = [
      { title: 'Instagram', snippet: `site:instagram.com "${termForSocial}"` },
      { title: 'Facebook', snippet: `site:facebook.com "${termForSocial}"` },
      { title: 'LinkedIn', snippet: `site:linkedin.com "${termForSocial}"` },
      { title: 'Snapchat (limited)', snippet: `site:snapchat.com "${termForSocial}"` },
      { title: 'Telegram', snippet: `(site:t.me OR site:telegram.me) "${termForSocial}"` },
      { title: 'Discord invites', snippet: `(site:discord.gg OR site:discord.com/invite) "${termForSocial}"` },
      { title: 'WhatsApp public links', snippet: `(site:wa.me OR site:chat.whatsapp.com) "${termForSocial}"` },
      { title: 'Linktree', snippet: `site:linktr.ee "${termForSocial}"` },
      { title: 'Beacons', snippet: `site:beacons.ai "${termForSocial}"` },
      { title: 'Carrd', snippet: `site:carrd.co "${termForSocial}"` },
      { title: 'TikTok', snippet: `site:tiktok.com "${termForSocial}"` },
      { title: 'YouTube', snippet: `site:youtube.com "${termForSocial}"` },
      { title: 'X/Twitter', snippet: `(site:x.com OR site:twitter.com) "${termForSocial}"` },
    ];
    socialPresenceQueriesUrl.forEach((q, i) => {
      queries.push({
        source: 'search' as const,
        title: q.title,
        url: null,
        captured_at: null,
        snippet: q.snippet,
        confidence: 0.84 - i * 0.01,
        category: 'social_presence',
      });
    });

    // 3b) CONTACT & PRESENCE (for URL/domain)
    const termForUrl = domain;
    const looksLikeUsername = /^[a-zA-Z0-9_-]+$/.test(termForUrl);
    const contactPresenceQueriesUrl = [
      { title: 'Instagram', snippet: `site:instagram.com "${termForUrl}"` },
      { title: 'Facebook', snippet: `site:facebook.com "${termForUrl}"` },
      { title: 'LinkedIn', snippet: `(site:linkedin.com OR site:linkedin.com/company OR site:linkedin.com/in) "${termForUrl}"` },
      { title: 'X/Twitter', snippet: `(site:x.com OR site:twitter.com) "${termForUrl}"` },
      { title: 'TikTok', snippet: `site:tiktok.com "${termForUrl}"` },
      { title: 'YouTube', snippet: `site:youtube.com "${termForUrl}"` },
      { title: 'Reddit', snippet: `site:reddit.com "${termForUrl}"` },
      { title: 'Threads', snippet: `site:threads.net "${termForUrl}"` },
      { title: 'Telegram', snippet: `(site:t.me OR site:telegram.me) "${termForUrl}"` },
      { title: 'Discord invites', snippet: `(site:discord.gg OR site:discord.com/invite) "${termForUrl}"` },
      { title: 'GitHub', snippet: `site:github.com "${termForUrl}"` },
      { title: 'Medium', snippet: `site:medium.com "${termForUrl}"` },
      { title: 'Substack', snippet: `site:substack.com "${termForUrl}"` },
      { title: 'LinkTr.ee', snippet: `site:linktr.ee "${termForUrl}"` },
      { title: 'Beacons.ai', snippet: `site:beacons.ai "${termForUrl}"` },
      { title: 'Carrd', snippet: `site:carrd.co "${termForUrl}"` },
      { title: 'Bio.site', snippet: `site:bio.site "${termForUrl}"` },
      { title: 'Contact pages', snippet: `"${termForUrl}" (contact OR "contact us" OR about OR support OR help OR press OR media)` },
      { title: 'Public email indicators', snippet: `"${termForUrl}" (mailto: OR "@")` },
      { title: 'Press emails', snippet: `"${termForUrl}" ("press@" OR "media@" OR "support@" OR "info@")` },
      { title: 'Public phone indicators', snippet: `"${termForUrl}" ("tel:" OR phone OR "call us")` },
      { title: 'Public address indicators', snippet: `"${termForUrl}" (headquarters OR HQ OR office OR "registered address" OR address)` },
      { title: 'PDF contact info', snippet: `"${termForUrl}" (pdf OR "press release") (email OR phone OR address)` },
      { title: 'WhatsApp links', snippet: `(site:wa.me OR site:chat.whatsapp.com) "${termForUrl}"` },
    ];
    if (looksLikeUsername) {
      contactPresenceQueriesUrl.push(
        { title: 'Instagram direct', snippet: `instagram.com/${termForUrl}` },
        { title: 'X direct', snippet: `x.com/${termForUrl}` },
        { title: 'Telegram direct', snippet: `t.me/${termForUrl}` },
        { title: 'GitHub direct', snippet: `github.com/${termForUrl}` },
      );
    }
    contactPresenceQueriesUrl.forEach((q, i) => {
      queries.push({
        source: 'search' as const,
        title: q.title,
        url: null,
        captured_at: null,
        snippet: q.snippet,
        confidence: 0.82 - i * 0.01,
        category: 'contact_presence',
      });
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
        category: 'time_anchors',
      });
    });

    queries.push({
      source: 'search' as const,
      title: `Lawsuits`,
      url: null,
      captured_at: null,
      snippet: `"${domain}" lawsuit`,
      confidence: 0.88,
      category: 'time_anchors',
    });

    queries.push({
      source: 'search' as const,
      title: `Investigations`,
      url: null,
      captured_at: null,
      snippet: `"${domain}" investigation`,
      confidence: 0.89,
      category: 'time_anchors',
    });

    // 5) AUTHORITY / OVERSIGHT LANGUAGE QUERIES
    queries.push({
      source: 'search' as const,
      title: `DOJ references`,
      url: null,
      captured_at: null,
      snippet: `"${domain}" DOJ`,
      confidence: 0.91,
      category: 'authority_language',
    });

    queries.push({
      source: 'search' as const,
      title: `OIG references`,
      url: null,
      captured_at: null,
      snippet: `"${domain}" OIG`,
      confidence: 0.89,
      category: 'authority_language',
    });

    queries.push({
      source: 'search' as const,
      title: `Oversight mentions`,
      url: null,
      captured_at: null,
      snippet: `"${domain}" oversight`,
      confidence: 0.87,
      category: 'authority_language',
    });

    queries.push({
      source: 'search' as const,
      title: `Audits`,
      url: null,
      captured_at: null,
      snippet: `"${domain}" audit`,
      confidence: 0.86,
      category: 'authority_language',
    });

    queries.push({
      source: 'search' as const,
      title: `Enforcement actions`,
      url: null,
      captured_at: null,
      snippet: `"${domain}" enforcement`,
      confidence: 0.88,
      category: 'authority_language',
    });

    queries.push({
      source: 'search' as const,
      title: `Complaints`,
      url: null,
      captured_at: null,
      snippet: `"${domain}" complaint`,
      confidence: 0.85,
      category: 'authority_language',
    });

    queries.push({
      source: 'search' as const,
      title: `Investigation records`,
      url: null,
      captured_at: null,
      snippet: `"${domain}" investigation`,
      confidence: 0.89,
      category: 'authority_language',
    });

    // 6) COURTS & CORRECTIONS (US)
    const courtsCorrectionsUrl = [
      { title: 'CourtListener', snippet: `site:courtlistener.com "${domain}"` },
      { title: 'RECAP Archive', snippet: `site:courtlistener.com/recap "${domain}"` },
      { title: 'PACER', snippet: `site:pacer.uscourts.gov "${domain}"` },
      { title: 'PACER Case Locator', snippet: `site:pcl.uscourts.gov "${domain}"` },
      { title: 'United States District Court', snippet: `"${domain}" "United States District Court"` },
      { title: 'United States v.', snippet: `"United States v. ${domain}"` },
      { title: 'Plaintiff v.', snippet: `"${domain}" "Plaintiff v."` },
      { title: 'Defendant', snippet: `"${domain}" Defendant` },
      { title: 'Civil action', snippet: `"${domain}" "civil action"` },
      { title: 'Indictment', snippet: `"${domain}" indictment` },
      { title: 'Arraignment', snippet: `"${domain}" arraignment` },
      { title: 'Sentencing', snippet: `"${domain}" sentencing` },
      { title: 'BOP inmate locator', snippet: `"${domain}" site:bop.gov inmate` },
      { title: 'BOP inmate', snippet: `"${domain}" "BOP inmate locator"` },
    ];
    courtsCorrectionsUrl.forEach((q, i) => {
      queries.push({
        source: 'search' as const,
        title: q.title,
        url: null,
        captured_at: null,
        snippet: q.snippet,
        confidence: 0.85 - i * 0.01,
        category: 'courts_corrections_us',
      });
    });

    // 7) INTERNATIONAL COURTS & RECORDS
    const intlCourtsUrl = [
      { title: 'ICC', snippet: `"${domain}" site:icc-cpi.int` },
      { title: 'ICJ', snippet: `"${domain}" site:icj-cij.org` },
      { title: 'ECHR', snippet: `"${domain}" site:echr.coe.int` },
      { title: 'WorldLII', snippet: `"${domain}" site:worldlii.org` },
      { title: 'BAILII', snippet: `"${domain}" site:bailii.org` },
      { title: 'CanLII', snippet: `"${domain}" site:canlii.org` },
      { title: 'AustLII', snippet: `"${domain}" site:austlii.edu.au` },
      { title: 'Court decision', snippet: `"${domain}" "court decision"` },
      { title: 'Judicial decision', snippet: `"${domain}" "judicial decision"` },
      { title: 'Tribunal', snippet: `"${domain}" tribunal` },
      { title: 'Case no.', snippet: `"${domain}" "case no."` },
    ];
    intlCourtsUrl.forEach((q, i) => {
      queries.push({
        source: 'search' as const,
        title: q.title,
        url: null,
        captured_at: null,
        snippet: q.snippet,
        confidence: 0.82 - i * 0.01,
        category: 'courts_records_international',
      });
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
      category: 'original',
    });

    queries.push({
      source: 'search' as const,
      title: `GitHub profile`,
      url: null,
      captured_at: null,
      snippet: `site:github.com "${input}"`,
      confidence: 0.85,
      category: 'original',
    });

    queries.push({
      source: 'search' as const,
      title: `LinkedIn search`,
      url: null,
      captured_at: null,
      snippet: `site:linkedin.com "${input}"`,
      confidence: 0.8,
      category: 'original',
    });

    // 2) FILE-TYPE SURVIVORSHIP QUERIES (for username/person)
    queries.push({
      source: 'search' as const,
      title: `PDF mentions`,
      url: null,
      captured_at: null,
      snippet: `filetype:pdf "${input}"`,
      confidence: 0.88,
      category: 'file_survivorship',
    });

    // 3) EXTERNAL MENTIONS
    queries.push({
      source: 'search' as const,
      title: `Forum mentions`,
      url: null,
      captured_at: null,
      snippet: `"${input}" site:reddit.com`,
      confidence: 0.82,
      category: 'external_mentions',
    });

    queries.push({
      source: 'search' as const,
      title: `News mentions`,
      url: null,
      captured_at: null,
      snippet: `"${input}" site:*.news`,
      confidence: 0.85,
      category: 'external_mentions',
    });

    // 3a) SOCIAL PRESENCE (for username)
    const socialPresenceQueriesUser = [
      { title: 'Instagram', snippet: `site:instagram.com "${input}"` },
      { title: 'Facebook', snippet: `site:facebook.com "${input}"` },
      { title: 'LinkedIn', snippet: `site:linkedin.com "${input}"` },
      { title: 'Snapchat (limited)', snippet: `site:snapchat.com "${input}"` },
      { title: 'Telegram', snippet: `(site:t.me OR site:telegram.me) "${input}"` },
      { title: 'Discord invites', snippet: `(site:discord.gg OR site:discord.com/invite) "${input}"` },
      { title: 'WhatsApp public links', snippet: `(site:wa.me OR site:chat.whatsapp.com) "${input}"` },
      { title: 'Linktree', snippet: `site:linktr.ee "${input}"` },
      { title: 'Beacons', snippet: `site:beacons.ai "${input}"` },
      { title: 'Carrd', snippet: `site:carrd.co "${input}"` },
      { title: 'TikTok', snippet: `site:tiktok.com "${input}"` },
      { title: 'YouTube', snippet: `site:youtube.com "${input}"` },
      { title: 'X/Twitter', snippet: `(site:x.com OR site:twitter.com) "${input}"` },
    ];
    socialPresenceQueriesUser.forEach((q, i) => {
      queries.push({
        source: 'search' as const,
        title: q.title,
        url: null,
        captured_at: null,
        snippet: q.snippet,
        confidence: 0.84 - i * 0.01,
        category: 'social_presence',
      });
    });

    // 3b) CONTACT & PRESENCE (for username)
    const looksLikeHandle = /^[a-zA-Z0-9_-]+$/.test(input);
    const contactPresenceQueriesUser = [
      { title: 'Instagram', snippet: `site:instagram.com "${input}"` },
      { title: 'Facebook', snippet: `site:facebook.com "${input}"` },
      { title: 'LinkedIn', snippet: `(site:linkedin.com OR site:linkedin.com/company OR site:linkedin.com/in) "${input}"` },
      { title: 'X/Twitter', snippet: `(site:x.com OR site:twitter.com) "${input}"` },
      { title: 'TikTok', snippet: `site:tiktok.com "${input}"` },
      { title: 'YouTube', snippet: `site:youtube.com "${input}"` },
      { title: 'Reddit', snippet: `site:reddit.com "${input}"` },
      { title: 'Threads', snippet: `site:threads.net "${input}"` },
      { title: 'Telegram', snippet: `(site:t.me OR site:telegram.me) "${input}"` },
      { title: 'Discord invites', snippet: `(site:discord.gg OR site:discord.com/invite) "${input}"` },
      { title: 'GitHub', snippet: `site:github.com "${input}"` },
      { title: 'Medium', snippet: `site:medium.com "${input}"` },
      { title: 'Substack', snippet: `site:substack.com "${input}"` },
      { title: 'LinkTr.ee', snippet: `site:linktr.ee "${input}"` },
      { title: 'Beacons.ai', snippet: `site:beacons.ai "${input}"` },
      { title: 'Carrd', snippet: `site:carrd.co "${input}"` },
      { title: 'Bio.site', snippet: `site:bio.site "${input}"` },
      { title: 'Contact pages', snippet: `"${input}" (contact OR "contact us" OR about OR support OR help OR press OR media)` },
      { title: 'Public email indicators', snippet: `"${input}" (mailto: OR "@")` },
      { title: 'Press emails', snippet: `"${input}" ("press@" OR "media@" OR "support@" OR "info@")` },
      { title: 'Public phone indicators', snippet: `"${input}" ("tel:" OR phone OR "call us")` },
      { title: 'Public address indicators', snippet: `"${input}" (headquarters OR HQ OR office OR "registered address" OR address)` },
      { title: 'PDF contact info', snippet: `"${input}" (pdf OR "press release") (email OR phone OR address)` },
      { title: 'WhatsApp links', snippet: `(site:wa.me OR site:chat.whatsapp.com) "${input}"` },
    ];
    if (looksLikeHandle) {
      contactPresenceQueriesUser.push(
        { title: 'Instagram direct', snippet: `instagram.com/${input}` },
        { title: 'X direct', snippet: `x.com/${input}` },
        { title: 'Telegram direct', snippet: `t.me/${input}` },
        { title: 'GitHub direct', snippet: `github.com/${input}` },
      );
    }
    contactPresenceQueriesUser.forEach((q, i) => {
      queries.push({
        source: 'search' as const,
        title: q.title,
        url: null,
        captured_at: null,
        snippet: q.snippet,
        confidence: 0.82 - i * 0.01,
        category: 'contact_presence',
      });
    });

    // 4) TIME ANCHOR QUERIES
    queries.push({
      source: 'search' as const,
      title: `Lawsuit involvement`,
      url: null,
      captured_at: null,
      snippet: `"${input}" lawsuit`,
      confidence: 0.86,
      category: 'time_anchors',
    });

    queries.push({
      source: 'search' as const,
      title: `Investigation mentions`,
      url: null,
      captured_at: null,
      snippet: `"${input}" investigation`,
      confidence: 0.87,
      category: 'time_anchors',
    });

    // 5) AUTHORITY / OVERSIGHT LANGUAGE QUERIES
    queries.push({
      source: 'search' as const,
      title: `DOJ records`,
      url: null,
      captured_at: null,
      snippet: `"${input}" DOJ`,
      confidence: 0.89,
      category: 'authority_language',
    });

    queries.push({
      source: 'search' as const,
      title: `Oversight records`,
      url: null,
      captured_at: null,
      snippet: `"${input}" oversight`,
      confidence: 0.85,
      category: 'authority_language',
    });

    queries.push({
      source: 'search' as const,
      title: `Complaint records`,
      url: null,
      captured_at: null,
      snippet: `"${input}" complaint`,
      confidence: 0.84,
      category: 'authority_language',
    });

    // 6) COURTS & CORRECTIONS (US) - username
    const courtsCorrectionsUser = [
      { title: 'CourtListener', snippet: `site:courtlistener.com "${input}"` },
      { title: 'RECAP Archive', snippet: `site:courtlistener.com/recap "${input}"` },
      { title: 'PACER', snippet: `site:pacer.uscourts.gov "${input}"` },
      { title: 'PACER Case Locator', snippet: `site:pcl.uscourts.gov "${input}"` },
      { title: 'United States District Court', snippet: `"${input}" "United States District Court"` },
      { title: 'United States v.', snippet: `"United States v. ${input}"` },
      { title: 'Plaintiff v.', snippet: `"${input}" "Plaintiff v."` },
      { title: 'Defendant', snippet: `"${input}" Defendant` },
      { title: 'Civil action', snippet: `"${input}" "civil action"` },
      { title: 'Indictment', snippet: `"${input}" indictment` },
      { title: 'Arraignment', snippet: `"${input}" arraignment` },
      { title: 'Sentencing', snippet: `"${input}" sentencing` },
      { title: 'BOP inmate locator', snippet: `"${input}" site:bop.gov inmate` },
      { title: 'BOP inmate', snippet: `"${input}" "BOP inmate locator"` },
    ];
    courtsCorrectionsUser.forEach((q, i) => {
      queries.push({
        source: 'search' as const,
        title: q.title,
        url: null,
        captured_at: null,
        snippet: q.snippet,
        confidence: 0.85 - i * 0.01,
        category: 'courts_corrections_us',
      });
    });

    // 7) INTERNATIONAL COURTS & RECORDS - username
    const intlCourtsUser = [
      { title: 'ICC', snippet: `"${input}" site:icc-cpi.int` },
      { title: 'ICJ', snippet: `"${input}" site:icj-cij.org` },
      { title: 'ECHR', snippet: `"${input}" site:echr.coe.int` },
      { title: 'WorldLII', snippet: `"${input}" site:worldlii.org` },
      { title: 'BAILII', snippet: `"${input}" site:bailii.org` },
      { title: 'CanLII', snippet: `"${input}" site:canlii.org` },
      { title: 'AustLII', snippet: `"${input}" site:austlii.edu.au` },
      { title: 'Court decision', snippet: `"${input}" "court decision"` },
      { title: 'Judicial decision', snippet: `"${input}" "judicial decision"` },
      { title: 'Tribunal', snippet: `"${input}" tribunal` },
      { title: 'Case no.', snippet: `"${input}" "case no."` },
    ];
    intlCourtsUser.forEach((q, i) => {
      queries.push({
        source: 'search' as const,
        title: q.title,
        url: null,
        captured_at: null,
        snippet: q.snippet,
        confidence: 0.82 - i * 0.01,
        category: 'courts_records_international',
      });
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
      category: 'original',
    });

    queries.push({
      source: 'search' as const,
      title: `News articles`,
      url: null,
      captured_at: null,
      snippet: `"${input}" site:*.news OR site:*.com/news`,
      confidence: 0.8,
      category: 'original',
    });

    queries.push({
      source: 'search' as const,
      title: `Forum discussions`,
      url: null,
      captured_at: null,
      snippet: `"${input}" site:reddit.com OR site:*.forum`,
      confidence: 0.75,
      category: 'original',
    });

    // 2a) SOCIAL PRESENCE (for quote/text)
    const socialPresenceQueriesQuote = [
      { title: 'Instagram', snippet: `site:instagram.com "${input}"` },
      { title: 'Facebook', snippet: `site:facebook.com "${input}"` },
      { title: 'LinkedIn', snippet: `site:linkedin.com "${input}"` },
      { title: 'Snapchat (limited)', snippet: `site:snapchat.com "${input}"` },
      { title: 'Telegram', snippet: `(site:t.me OR site:telegram.me) "${input}"` },
      { title: 'Discord invites', snippet: `(site:discord.gg OR site:discord.com/invite) "${input}"` },
      { title: 'WhatsApp public links', snippet: `(site:wa.me OR site:chat.whatsapp.com) "${input}"` },
      { title: 'Linktree', snippet: `site:linktr.ee "${input}"` },
      { title: 'Beacons', snippet: `site:beacons.ai "${input}"` },
      { title: 'Carrd', snippet: `site:carrd.co "${input}"` },
      { title: 'TikTok', snippet: `site:tiktok.com "${input}"` },
      { title: 'YouTube', snippet: `site:youtube.com "${input}"` },
      { title: 'X/Twitter', snippet: `(site:x.com OR site:twitter.com) "${input}"` },
    ];
    socialPresenceQueriesQuote.forEach((q, i) => {
      queries.push({
        source: 'search' as const,
        title: q.title,
        url: null,
        captured_at: null,
        snippet: q.snippet,
        confidence: 0.84 - i * 0.01,
        category: 'social_presence',
      });
    });

    // 2) FILE-TYPE SURVIVORSHIP QUERIES
    queries.push({
      source: 'search' as const,
      title: `PDF documents`,
      url: null,
      captured_at: null,
      snippet: `filetype:pdf "${input}"`,
      confidence: 0.9,
      category: 'file_survivorship',
    });

    queries.push({
      source: 'search' as const,
      title: `Word documents`,
      url: null,
      captured_at: null,
      snippet: `filetype:doc "${input}"`,
      confidence: 0.82,
      category: 'file_survivorship',
    });

    // 3b) CONTACT & PRESENCE (for quote/text)
    const looksLikeTerm = /^[a-zA-Z0-9_-]+$/.test(input);
    const contactPresenceQueriesQuote = [
      { title: 'Instagram', snippet: `site:instagram.com "${input}"` },
      { title: 'Facebook', snippet: `site:facebook.com "${input}"` },
      { title: 'LinkedIn', snippet: `(site:linkedin.com OR site:linkedin.com/company OR site:linkedin.com/in) "${input}"` },
      { title: 'X/Twitter', snippet: `(site:x.com OR site:twitter.com) "${input}"` },
      { title: 'TikTok', snippet: `site:tiktok.com "${input}"` },
      { title: 'YouTube', snippet: `site:youtube.com "${input}"` },
      { title: 'Reddit', snippet: `site:reddit.com "${input}"` },
      { title: 'Threads', snippet: `site:threads.net "${input}"` },
      { title: 'Telegram', snippet: `(site:t.me OR site:telegram.me) "${input}"` },
      { title: 'Discord invites', snippet: `(site:discord.gg OR site:discord.com/invite) "${input}"` },
      { title: 'GitHub', snippet: `site:github.com "${input}"` },
      { title: 'Medium', snippet: `site:medium.com "${input}"` },
      { title: 'Substack', snippet: `site:substack.com "${input}"` },
      { title: 'LinkTr.ee', snippet: `site:linktr.ee "${input}"` },
      { title: 'Beacons.ai', snippet: `site:beacons.ai "${input}"` },
      { title: 'Carrd', snippet: `site:carrd.co "${input}"` },
      { title: 'Bio.site', snippet: `site:bio.site "${input}"` },
      { title: 'Contact pages', snippet: `"${input}" (contact OR "contact us" OR about OR support OR help OR press OR media)` },
      { title: 'Public email indicators', snippet: `"${input}" (mailto: OR "@")` },
      { title: 'Press emails', snippet: `"${input}" ("press@" OR "media@" OR "support@" OR "info@")` },
      { title: 'Public phone indicators', snippet: `"${input}" ("tel:" OR phone OR "call us")` },
      { title: 'Public address indicators', snippet: `"${input}" (headquarters OR HQ OR office OR "registered address" OR address)` },
      { title: 'PDF contact info', snippet: `"${input}" (pdf OR "press release") (email OR phone OR address)` },
      { title: 'WhatsApp links', snippet: `(site:wa.me OR site:chat.whatsapp.com) "${input}"` },
    ];
    if (looksLikeTerm) {
      contactPresenceQueriesQuote.push(
        { title: 'Instagram direct', snippet: `instagram.com/${input}` },
        { title: 'X direct', snippet: `x.com/${input}` },
        { title: 'Telegram direct', snippet: `t.me/${input}` },
        { title: 'GitHub direct', snippet: `github.com/${input}` },
      );
    }
    contactPresenceQueriesQuote.forEach((q, i) => {
      queries.push({
        source: 'search' as const,
        title: q.title,
        url: null,
        captured_at: null,
        snippet: q.snippet,
        confidence: 0.82 - i * 0.01,
        category: 'contact_presence',
      });
    });

    // 4) TIME ANCHOR QUERIES
    queries.push({
      source: 'search' as const,
      title: `Lawsuit context`,
      url: null,
      captured_at: null,
      snippet: `"${input}" lawsuit`,
      confidence: 0.85,
      category: 'time_anchors',
    });

    queries.push({
      source: 'search' as const,
      title: `Investigation context`,
      url: null,
      captured_at: null,
      snippet: `"${input}" investigation`,
      confidence: 0.87,
      category: 'time_anchors',
    });

    // 5) AUTHORITY / OVERSIGHT LANGUAGE QUERIES
    queries.push({
      source: 'search' as const,
      title: `Government records`,
      url: null,
      captured_at: null,
      snippet: `"${input}" site:*.gov`,
      confidence: 0.92,
      category: 'authority_language',
    });

    queries.push({
      source: 'search' as const,
      title: `Oversight mentions`,
      url: null,
      captured_at: null,
      snippet: `"${input}" oversight`,
      confidence: 0.86,
      category: 'authority_language',
    });

    queries.push({
      source: 'search' as const,
      title: `Audit records`,
      url: null,
      captured_at: null,
      snippet: `"${input}" audit`,
      confidence: 0.84,
      category: 'authority_language',
    });

    // 6) COURTS & CORRECTIONS (US) - quote
    const courtsCorrectionsQuote = [
      { title: 'CourtListener', snippet: `site:courtlistener.com "${input}"` },
      { title: 'RECAP Archive', snippet: `site:courtlistener.com/recap "${input}"` },
      { title: 'PACER', snippet: `site:pacer.uscourts.gov "${input}"` },
      { title: 'PACER Case Locator', snippet: `site:pcl.uscourts.gov "${input}"` },
      { title: 'United States District Court', snippet: `"${input}" "United States District Court"` },
      { title: 'United States v.', snippet: `"United States v. ${input}"` },
      { title: 'Plaintiff v.', snippet: `"${input}" "Plaintiff v."` },
      { title: 'Defendant', snippet: `"${input}" Defendant` },
      { title: 'Civil action', snippet: `"${input}" "civil action"` },
      { title: 'Indictment', snippet: `"${input}" indictment` },
      { title: 'Arraignment', snippet: `"${input}" arraignment` },
      { title: 'Sentencing', snippet: `"${input}" sentencing` },
      { title: 'BOP inmate locator', snippet: `"${input}" site:bop.gov inmate` },
      { title: 'BOP inmate', snippet: `"${input}" "BOP inmate locator"` },
    ];
    courtsCorrectionsQuote.forEach((q, i) => {
      queries.push({
        source: 'search' as const,
        title: q.title,
        url: null,
        captured_at: null,
        snippet: q.snippet,
        confidence: 0.85 - i * 0.01,
        category: 'courts_corrections_us',
      });
    });

    // 7) INTERNATIONAL COURTS & RECORDS - quote
    const intlCourtsQuote = [
      { title: 'ICC', snippet: `"${input}" site:icc-cpi.int` },
      { title: 'ICJ', snippet: `"${input}" site:icj-cij.org` },
      { title: 'ECHR', snippet: `"${input}" site:echr.coe.int` },
      { title: 'WorldLII', snippet: `"${input}" site:worldlii.org` },
      { title: 'BAILII', snippet: `"${input}" site:bailii.org` },
      { title: 'CanLII', snippet: `"${input}" site:canlii.org` },
      { title: 'AustLII', snippet: `"${input}" site:austlii.edu.au` },
      { title: 'Court decision', snippet: `"${input}" "court decision"` },
      { title: 'Judicial decision', snippet: `"${input}" "judicial decision"` },
      { title: 'Tribunal', snippet: `"${input}" tribunal` },
      { title: 'Case no.', snippet: `"${input}" "case no."` },
    ];
    intlCourtsQuote.forEach((q, i) => {
      queries.push({
        source: 'search' as const,
        title: q.title,
        url: null,
        captured_at: null,
        snippet: q.snippet,
        confidence: 0.82 - i * 0.01,
        category: 'courts_records_international',
      });
    });
  }

  return queries;
}
