export interface OfficialSource {
  name: string;
  domain: string;
  description: string;
  buildSearchUrl?: (query: string) => string;
  fallbackDomainSearchUrl?: (query: string) => string;
  linkOnly?: boolean;
  directUrl?: string;
  /** Optional: "free" or "paywalled" for court sources */
  access?: 'free' | 'paywalled';
}

export interface SourceSubsection {
  subsectionName: string;
  note?: string;
  sources: OfficialSource[];
}

export interface SourceGroup {
  groupName: string;
  sources: OfficialSource[];
  subsections?: SourceSubsection[];
}

const encodeQuery = (query: string): string => encodeURIComponent(query);

export const officialSourceGroups: SourceGroup[] = [
  {
    groupName: 'DOJ / Law Enforcement / Courts',
    sources: [
      {
        name: 'Department of Justice',
        domain: 'justice.gov',
        description: 'Press releases, legal documents, enforcement actions',
        buildSearchUrl: (query) => `https://www.justice.gov/search?keys=${encodeQuery(query)}`,
      },
      {
        name: 'FBI',
        domain: 'fbi.gov',
        description: 'Most wanted, news, investigations, crime statistics',
        buildSearchUrl: (query) => `https://www.fbi.gov/search?query=${encodeQuery(query)}`,
      },
      {
        name: 'FBI Vault',
        domain: 'vault.fbi.gov',
        description: 'FOIA documents, declassified records, historical files',
        buildSearchUrl: (query) => `https://vault.fbi.gov/search?SearchableText=${encodeQuery(query)}`,
      },
      {
        name: 'DEA',
        domain: 'dea.gov',
        description: 'Drug enforcement, fugitives, press releases',
        directUrl: 'https://www.dea.gov/',
        linkOnly: true,
      },
      {
        name: 'ATF',
        domain: 'atf.gov',
        description: 'Firearms, explosives, arson investigations',
        directUrl: 'https://www.atf.gov/',
        linkOnly: true,
      },
      {
        name: 'U.S. Marshals',
        domain: 'usmarshals.gov',
        description: 'Fugitive operations, witness protection, prisoner transport',
        directUrl: 'https://www.usmarshals.gov/',
        linkOnly: true,
      },
      {
        name: 'PACER',
        domain: 'pacer.uscourts.gov',
        description: 'Federal court records (requires account)',
        directUrl: 'https://pacer.uscourts.gov/',
        linkOnly: true,
      },
      {
        name: 'U.S. Courts',
        domain: 'uscourts.gov',
        description: 'Federal judiciary information, opinions, statistics',
        directUrl: 'https://www.uscourts.gov/',
        linkOnly: true,
      },
    ],
  },
  {
    groupName: 'Courts & Corrections (US)',
    sources: [
      {
        name: 'CourtListener — Free (Free Law Project)',
        domain: 'courtlistener.com',
        description: 'Free federal court opinions and dockets',
        directUrl: 'https://www.courtlistener.com/',
        linkOnly: true,
        access: 'free',
      },
      {
        name: 'RECAP Archive — Free (Free Law Project)',
        domain: 'courtlistener.com',
        description: 'Free PACER document archive',
        directUrl: 'https://www.courtlistener.com/recap/',
        linkOnly: true,
        access: 'free',
      },
      {
        name: 'PACER Case Locator — Paywalled (Official)',
        domain: 'pcl.uscourts.gov',
        description: 'Federal case search',
        directUrl: 'https://pcl.uscourts.gov/',
        linkOnly: true,
        access: 'paywalled',
      },
      {
        name: 'PACER — Paywalled (Official)',
        domain: 'pacer.uscourts.gov',
        description: 'Federal court records (requires account)',
        directUrl: 'https://pacer.uscourts.gov/',
        linkOnly: true,
        access: 'paywalled',
      },
      {
        name: 'Federal Bureau of Prisons Inmate Locator (Official)',
        domain: 'bop.gov',
        description: 'Federal inmate lookup',
        directUrl: 'https://www.bop.gov/inmateloc/',
        linkOnly: true,
      },
    ],
  },
  {
    groupName: 'International Courts & Records',
    sources: [
      {
        name: 'International Criminal Court (ICC)',
        domain: 'icc-cpi.int',
        description: 'International criminal tribunal',
        directUrl: 'https://www.icc-cpi.int/',
        linkOnly: true,
      },
      {
        name: 'International Court of Justice (ICJ)',
        domain: 'icj-cij.org',
        description: 'UN principal judicial organ',
        directUrl: 'https://www.icj-cij.org/',
        linkOnly: true,
      },
      {
        name: 'European Court of Human Rights (ECHR)',
        domain: 'echr.coe.int',
        description: 'European human rights court',
        directUrl: 'https://www.echr.coe.int/',
        linkOnly: true,
      },
      {
        name: 'World Legal Information Institute (WorldLII)',
        domain: 'worldlii.org',
        description: 'Free global legal database',
        directUrl: 'https://www.worldlii.org/',
        linkOnly: true,
      },
      {
        name: 'BAILII (UK & Ireland)',
        domain: 'bailii.org',
        description: 'British and Irish Legal Information Institute',
        directUrl: 'https://www.bailii.org/',
        linkOnly: true,
      },
      {
        name: 'CanLII (Canada)',
        domain: 'canlii.org',
        description: 'Canadian Legal Information Institute',
        directUrl: 'https://www.canlii.org/',
        linkOnly: true,
      },
      {
        name: 'AustLII (Australia)',
        domain: 'austlii.edu.au',
        description: 'Australian Legal Information Institute',
        directUrl: 'https://www.austlii.edu.au/',
        linkOnly: true,
      },
    ],
  },
  {
    groupName: 'Congress / Oversight / Audit',
    sources: [
      {
        name: 'Congress.gov',
        domain: 'congress.gov',
        description: 'Bills, resolutions, legislative actions, Congressional Record',
        buildSearchUrl: (query) => `https://www.congress.gov/search?q=${encodeQuery(query)}`,
      },
      {
        name: 'House Oversight Committee',
        domain: 'oversight.house.gov',
        description: 'Committee investigations, hearings, reports',
        buildSearchUrl: (query) => `https://oversight.house.gov/?s=${encodeQuery(query)}`,
      },
      {
        name: 'Government Accountability Office',
        domain: 'gao.gov',
        description: 'Audit reports, bid protests, legal decisions',
        buildSearchUrl: (query) => `https://www.gao.gov/search?search_api_fulltext=${encodeQuery(query)}`,
      },
      {
        name: 'Congressional Budget Office',
        domain: 'cbo.gov',
        description: 'Budget analysis, economic forecasts, cost estimates',
        directUrl: 'https://www.cbo.gov/',
        linkOnly: true,
      },
      {
        name: 'CRS Reports',
        domain: 'crsreports.congress.gov',
        description: 'Congressional Research Service reports',
        buildSearchUrl: (query) => `https://crsreports.congress.gov/search/#/?terms=${encodeQuery(query)}`,
      },
    ],
    subsections: [
      {
        subsectionName: 'Financial Disclosures & STOCK Act Filings',
        note: 'These links lead to official government databases where financial disclosures and STOCK Act filings can be searched.',
        sources: [
          {
            name: 'House Financial Disclosures (STOCK Act)',
            domain: 'disclosures-clerk.house.gov',
            description: 'Search annual financial disclosures and stock transaction reports (PTRs) for House members and senior staff',
            directUrl: 'https://disclosures-clerk.house.gov/PublicDisclosure/FinancialDisclosure',
            linkOnly: true,
          },
          {
            name: 'Senate Financial Disclosures (EFD)',
            domain: 'efdsearch.senate.gov',
            description: 'Search financial disclosure reports and stock transactions for U.S. Senators',
            directUrl: 'https://efdsearch.senate.gov/search/',
            linkOnly: true,
          },
          {
            name: 'Executive Branch Financial Disclosures (OGE)',
            domain: 'oge.gov',
            description: 'Public financial disclosures for Cabinet members, White House staff, and senior federal officials (OGE Form 278)',
            directUrl: 'https://www.oge.gov/web/oge.nsf/Public%20Financial%20Disclosure%20Reports',
            linkOnly: true,
          },
          {
            name: 'Executive Branch STOCK Act Transactions',
            domain: 'oge.gov',
            description: 'Periodic Transaction Reports (STOCK Act) for executive branch officials',
            directUrl: 'https://www.oge.gov/web/oge.nsf/Resources/Financial%20Disclosure',
            linkOnly: true,
          },
          {
            name: 'Federal Judges Financial Disclosures',
            domain: 'uscourts.gov',
            description: 'Financial disclosure reports for federal judges (assets, income, gifts)',
            directUrl: 'https://www.uscourts.gov/forms/financial-disclosure-reports',
            linkOnly: true,
          },
          {
            name: 'House Ethics Committee',
            domain: 'ethics.house.gov',
            description: 'Ethics enforcement and investigations related to disclosure violations',
            directUrl: 'https://ethics.house.gov',
            linkOnly: true,
          },
          {
            name: 'Senate Ethics Committee',
            domain: 'ethics.senate.gov',
            description: 'Ethics enforcement and investigations related to disclosure violations',
            directUrl: 'https://www.ethics.senate.gov',
            linkOnly: true,
          },
        ],
      },
    ],
  },
  {
    groupName: 'Inspectors General / Accountability',
    sources: [
      {
        name: 'Oversight.gov (CIGIE)',
        domain: 'oversight.gov',
        description: 'Inspector General reports across all federal agencies',
        buildSearchUrl: (query) => `https://www.oversight.gov/reports?search=${encodeQuery(query)}`,
      },
      {
        name: 'DOJ OIG',
        domain: 'oig.justice.gov',
        description: 'Justice Department Inspector General investigations',
        directUrl: 'https://oig.justice.gov/',
        linkOnly: true,
      },
      {
        name: 'DoD OIG',
        domain: 'dodig.mil',
        description: 'Defense Department Inspector General audits',
        directUrl: 'https://www.dodig.mil/',
        linkOnly: true,
      },
      {
        name: 'DHS OIG',
        domain: 'oig.dhs.gov',
        description: 'Homeland Security Inspector General reports',
        directUrl: 'https://www.oig.dhs.gov/',
        linkOnly: true,
      },
      {
        name: 'HHS OIG',
        domain: 'oig.hhs.gov',
        description: 'Health & Human Services Inspector General, Medicare fraud',
        directUrl: 'https://oig.hhs.gov/',
        linkOnly: true,
      },
      {
        name: 'Treasury OIG',
        domain: 'oig.treasury.gov',
        description: 'Treasury Inspector General investigations',
        directUrl: 'https://oig.treasury.gov/',
        linkOnly: true,
      },
      {
        name: 'EPA OIG',
        domain: 'oig.epa.gov',
        description: 'Environmental Protection Agency Inspector General',
        directUrl: 'https://oig.epa.gov/',
        linkOnly: true,
      },
    ],
  },
  {
    groupName: 'Finance / Markets / Consumer Protection',
    sources: [
      {
        name: 'SEC',
        domain: 'sec.gov',
        description: 'Securities filings (EDGAR), enforcement actions, investor alerts',
        buildSearchUrl: (query) => `https://www.sec.gov/search?query=${encodeQuery(query)}`,
      },
      {
        name: 'FinCEN',
        domain: 'fincen.gov',
        description: 'Financial crimes enforcement, AML guidance, advisories',
        buildSearchUrl: (query) => `https://www.fincen.gov/search?search_api_fulltext=${encodeQuery(query)}`,
      },
      {
        name: 'FTC',
        domain: 'ftc.gov',
        description: 'Consumer protection, antitrust, scam alerts',
        buildSearchUrl: (query) => `https://www.ftc.gov/search?search_api_fulltext=${encodeQuery(query)}`,
      },
      {
        name: 'CFPB',
        domain: 'consumerfinance.gov',
        description: 'Consumer Financial Protection Bureau, complaints, enforcement',
        buildSearchUrl: (query) => `https://www.consumerfinance.gov/search/?query=${encodeQuery(query)}`,
      },
      {
        name: 'OCC',
        domain: 'occ.gov',
        description: 'Bank regulation, enforcement actions, licensing',
        buildSearchUrl: (query) => `https://www.occ.gov/search/index.html?query=${encodeQuery(query)}`,
      },
      {
        name: 'Federal Reserve',
        domain: 'federalreserve.gov',
        description: 'Monetary policy, bank supervision, economic research',
        buildSearchUrl: (query) => `https://www.federalreserve.gov/searchdefault.htm?searchtext=${encodeQuery(query)}`,
      },
    ],
  },
  {
    groupName: 'Health / Safety / Environment',
    sources: [
      {
        name: 'CDC',
        domain: 'cdc.gov',
        description: 'Disease surveillance, health guidelines, outbreak reports',
        buildSearchUrl: (query) => `https://search.cdc.gov/search/?query=${encodeQuery(query)}`,
      },
      {
        name: 'FDA',
        domain: 'fda.gov',
        description: 'Drug approvals, recalls, safety alerts, inspections',
        buildSearchUrl: (query) => `https://www.fda.gov/search?s=${encodeQuery(query)}`,
      },
      {
        name: 'NIH',
        domain: 'nih.gov',
        description: 'Medical research, clinical trials, health information',
        buildSearchUrl: (query) => `https://search.nih.gov/search?query=${encodeQuery(query)}`,
      },
      {
        name: 'EPA',
        domain: 'epa.gov',
        description: 'Environmental regulations, cleanup sites, enforcement',
        buildSearchUrl: (query) => `https://www.epa.gov/search?querytext=${encodeQuery(query)}`,
      },
      {
        name: 'OSHA',
        domain: 'osha.gov',
        description: 'Workplace safety, violations, inspection data',
        buildSearchUrl: (query) => `https://www.osha.gov/search?query=${encodeQuery(query)}`,
      },
    ],
  },
  {
    groupName: 'Immigration / Security / Defense',
    sources: [
      {
        name: 'DHS',
        domain: 'dhs.gov',
        description: 'Homeland Security policies, alerts, operations',
        buildSearchUrl: (query) => `https://www.dhs.gov/search?search_api_fulltext=${encodeQuery(query)}`,
      },
      {
        name: 'ICE',
        domain: 'ice.gov',
        description: 'Immigration enforcement, most wanted, operations',
        buildSearchUrl: (query) => `https://www.ice.gov/search?search_api_fulltext=${encodeQuery(query)}`,
      },
      {
        name: 'CBP',
        domain: 'cbp.gov',
        description: 'Customs and Border Protection, trade enforcement',
        buildSearchUrl: (query) => `https://www.cbp.gov/search?search_api_fulltext=${encodeQuery(query)}`,
      },
      {
        name: 'USCIS',
        domain: 'uscis.gov',
        description: 'Immigration services, visa processing, citizenship',
        buildSearchUrl: (query) => `https://www.uscis.gov/search?query=${encodeQuery(query)}`,
      },
      {
        name: 'Defense.gov',
        domain: 'defense.gov',
        description: 'Department of Defense news, contracts, operations',
        buildSearchUrl: (query) => `https://www.defense.gov/Search/?q=${encodeQuery(query)}`,
      },
    ],
  },
  {
    groupName: 'Records / Archives / Transparency',
    sources: [
      {
        name: 'National Archives',
        domain: 'archives.gov',
        description: 'Historical records, presidential libraries, declassified documents',
        buildSearchUrl: (query) => `https://www.archives.gov/research/search?query=${encodeQuery(query)}`,
      },
      {
        name: 'Federal Register',
        domain: 'federalregister.gov',
        description: 'New regulations, executive orders, agency notices',
        buildSearchUrl: (query) => `https://www.federalregister.gov/documents/search?conditions%5Bterm%5D=${encodeQuery(query)}`,
      },
      {
        name: 'GovInfo',
        domain: 'govinfo.gov',
        description: 'Official government publications, CFR, Congressional Record',
        buildSearchUrl: (query) => `https://www.govinfo.gov/app/search/${encodeQuery(query)}`,
      },
      {
        name: 'Data.gov',
        domain: 'data.gov',
        description: 'Open government datasets, APIs, downloadable data',
        buildSearchUrl: (query) => `https://catalog.data.gov/dataset?q=${encodeQuery(query)}`,
      },
      {
        name: 'FOIA.gov',
        domain: 'foia.gov',
        description: 'Freedom of Information Act requests and guidance',
        directUrl: 'https://www.foia.gov/',
        linkOnly: true,
      },
    ],
  },
  {
    groupName: 'Education / Labor / Social Systems',
    sources: [
      {
        name: 'Department of Education',
        domain: 'ed.gov',
        description: 'Education policy, student aid, school data',
        buildSearchUrl: (query) => `https://www.ed.gov/search?search_api_fulltext=${encodeQuery(query)}`,
      },
      {
        name: 'Department of Labor',
        domain: 'dol.gov',
        description: 'Employment law, wage data, workplace violations',
        buildSearchUrl: (query) => `https://www.dol.gov/search?query=${encodeQuery(query)}`,
      },
      {
        name: 'EEOC',
        domain: 'eeoc.gov',
        description: 'Employment discrimination, civil rights enforcement',
        buildSearchUrl: (query) => `https://www.eeoc.gov/search?search_api_fulltext=${encodeQuery(query)}`,
      },
      {
        name: 'Social Security Administration',
        domain: 'ssa.gov',
        description: 'Benefits, retirement, disability information',
        buildSearchUrl: (query) => `https://www.ssa.gov/search/?q=${encodeQuery(query)}`,
      },
    ],
  },
];

export const US_STATES = [
  { code: 'al', name: 'Alabama' },
  { code: 'ak', name: 'Alaska' },
  { code: 'az', name: 'Arizona' },
  { code: 'ar', name: 'Arkansas' },
  { code: 'ca', name: 'California' },
  { code: 'co', name: 'Colorado' },
  { code: 'ct', name: 'Connecticut' },
  { code: 'de', name: 'Delaware' },
  { code: 'dc', name: 'District of Columbia' },
  { code: 'fl', name: 'Florida' },
  { code: 'ga', name: 'Georgia' },
  { code: 'hi', name: 'Hawaii' },
  { code: 'id', name: 'Idaho' },
  { code: 'il', name: 'Illinois' },
  { code: 'in', name: 'Indiana' },
  { code: 'ia', name: 'Iowa' },
  { code: 'ks', name: 'Kansas' },
  { code: 'ky', name: 'Kentucky' },
  { code: 'la', name: 'Louisiana' },
  { code: 'me', name: 'Maine' },
  { code: 'md', name: 'Maryland' },
  { code: 'ma', name: 'Massachusetts' },
  { code: 'mi', name: 'Michigan' },
  { code: 'mn', name: 'Minnesota' },
  { code: 'ms', name: 'Mississippi' },
  { code: 'mo', name: 'Missouri' },
  { code: 'mt', name: 'Montana' },
  { code: 'ne', name: 'Nebraska' },
  { code: 'nv', name: 'Nevada' },
  { code: 'nh', name: 'New Hampshire' },
  { code: 'nj', name: 'New Jersey' },
  { code: 'nm', name: 'New Mexico' },
  { code: 'ny', name: 'New York' },
  { code: 'nc', name: 'North Carolina' },
  { code: 'nd', name: 'North Dakota' },
  { code: 'oh', name: 'Ohio' },
  { code: 'ok', name: 'Oklahoma' },
  { code: 'or', name: 'Oregon' },
  { code: 'pa', name: 'Pennsylvania' },
  { code: 'ri', name: 'Rhode Island' },
  { code: 'sc', name: 'South Carolina' },
  { code: 'sd', name: 'South Dakota' },
  { code: 'tn', name: 'Tennessee' },
  { code: 'tx', name: 'Texas' },
  { code: 'ut', name: 'Utah' },
  { code: 'vt', name: 'Vermont' },
  { code: 'va', name: 'Virginia' },
  { code: 'wa', name: 'Washington' },
  { code: 'wv', name: 'West Virginia' },
  { code: 'wi', name: 'Wisconsin' },
  { code: 'wy', name: 'Wyoming' },
  { code: 'pr', name: 'Puerto Rico' },
  { code: 'vi', name: 'U.S. Virgin Islands' },
  { code: 'gu', name: 'Guam' },
  { code: 'as', name: 'American Samoa' },
  { code: 'mp', name: 'Northern Mariana Islands' },
];

export const getOfficialStateUrl = (stateCode: string): string => {
  const territoryUrls: Record<string, string> = {
    pr: 'https://www.pr.gov/',
    vi: 'https://www.vi.gov/',
    gu: 'https://www.guam.gov/',
    as: 'https://www.americansamoa.gov/',
    mp: 'https://www.cnmi.gov/',
  };

  return territoryUrls[stateCode] || `https://www.${stateCode}.gov/`;
};

export const looksLikePersonName = (query: string): boolean => {
  const trimmed = query.trim();
  const hasSpaces = trimmed.includes(' ');
  const words = trimmed.split(/\s+/);
  const isAlphabetic = /^[a-zA-Z\s\-'.]+$/.test(trimmed);
  const hasTwoOrMoreWords = words.length >= 2;
  const reasonableLength = trimmed.length >= 4 && trimmed.length <= 50;

  return hasSpaces && isAlphabetic && hasTwoOrMoreWords && reasonableLength;
};

export const looksLikeStockTicker = (query: string): boolean => {
  const trimmed = query.trim().toUpperCase();
  const isShortAllCaps = /^[A-Z]{1,5}$/.test(trimmed);
  const noSpaces = !trimmed.includes(' ');

  return isShortAllCaps && noSpaces;
};
