'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ExternalLink, Copy, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  officialSourceGroups,
  US_STATES,
  getOfficialStateUrl,
  looksLikePersonName,
  looksLikeStockTicker,
  type OfficialSource,
  type SourceSubsection,
} from '@/lib/officialSources';
import { isValidUrl, canonicalizeUrl } from '@/lib/url-utils';

interface OfficialSourcesProps {
  rawInput: string;
}

export function OfficialSources({ rawInput }: OfficialSourcesProps) {
  const [selectedState, setSelectedState] = useState<string>('');

  const query = rawInput.trim();
  const isUrl = isValidUrl(query);
  const urlDomain = isUrl ? new URL(canonicalizeUrl(query)).hostname : null;

  if (query.length < 3) {
    return (
      <Card className="bg-white border-emerald-200 shadow-sm">
        <CardContent className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-emerald-300 mx-auto mb-4" />
          <p className="text-emerald-700 font-mono text-sm mb-2">MINIMUM.QUERY.LENGTH.REQUIRED</p>
          <p className="text-gray-500 text-xs">Enter at least 3 characters for official sources search</p>
        </CardContent>
      </Card>
    );
  }

  const handleCopyLink = (url: string, sourceName: string) => {
    navigator.clipboard.writeText(url);
    toast.success(`${sourceName} search link copied to clipboard`);
  };

  const renderSourceCard = (source: OfficialSource) => {
    const searchUrl = source.buildSearchUrl ? source.buildSearchUrl(query) : null;
    const domainUrl = source.directUrl || `https://www.${source.domain}`;

    return (
      <Card key={source.name} className="bg-white border-emerald-200 hover:border-emerald-300 transition-all">
        <CardContent className="p-4">
          <div className="space-y-3">
            <div>
              <div className="flex items-start justify-between gap-2 mb-1">
                <h4 className="text-gray-900 font-semibold text-sm">{source.name}</h4>
                {source.access === 'free' && (
                  <Badge variant="outline" className="text-xs font-mono text-emerald-700 border-emerald-300">
                    Free
                  </Badge>
                )}
                {source.access === 'paywalled' && (
                  <Badge variant="outline" className="text-xs font-mono text-amber-700 border-amber-300">
                    Paywalled
                  </Badge>
                )}
                {!source.access && source.domain.endsWith('.gov') && (
                  <Badge variant="outline" className="text-xs font-mono text-emerald-700 border-emerald-300">
                    .gov
                  </Badge>
                )}
              </div>
              <p className="text-xs text-gray-600 mb-2">{source.description}</p>
              <p className="text-xs text-emerald-600 font-mono">{source.domain}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {searchUrl ? (
                <>
                  <a
                    href={searchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1"
                  >
                    <Button
                      size="sm"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      OPEN SEARCH
                    </Button>
                  </a>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyLink(searchUrl, source.name)}
                    className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </>
              ) : (
                <a
                  href={domainUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-mono text-xs"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    {source.directUrl ? 'OPEN DISCLOSURE DATABASE' : 'VISIT SITE'}
                  </Button>
                </a>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const isPersonName = looksLikePersonName(query);
  const isStockTicker = looksLikeStockTicker(query);

  return (
    <div className="space-y-6">
      {isUrl && urlDomain && (
        <Card className="bg-emerald-50 border-emerald-300 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-mono text-emerald-800">DOMAIN SEARCH DETECTED</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-gray-700">
              Your input is a URL. Use the domain-restricted searches below to find related information:
            </p>
            <div className="bg-white p-3 rounded border border-emerald-200">
              <p className="text-xs font-mono text-emerald-700 break-all">{urlDomain}</p>
            </div>
            <p className="text-xs text-gray-500 italic">
              Tip: The official sources below will search for this URL across government databases
            </p>
          </CardContent>
        </Card>
      )}

      {isPersonName && (
        <Card className="bg-blue-50 border-blue-300 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-blue-900 font-semibold mb-1">💡 SEARCHING FOR A PERSON?</p>
            <p className="text-xs text-gray-700">
              Tip: Search by last name first. Try multiple years. Financial disclosure databases may require specific date ranges.
            </p>
          </CardContent>
        </Card>
      )}

      {isStockTicker && (
        <Card className="bg-blue-50 border-blue-300 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-blue-900 font-semibold mb-1">💡 SEARCHING FOR A STOCK OR COMPANY?</p>
            <p className="text-xs text-gray-700">
              Tip: Search by official&apos;s name in disclosure databases, then review transaction sections for company or ticker information.
            </p>
          </CardContent>
        </Card>
      )}

      {officialSourceGroups.map((group) => (
        <div key={group.groupName} className="space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1 bg-emerald-200" />
            <h3 className="text-sm font-mono font-bold text-emerald-800 uppercase tracking-wide">
              {group.groupName}
            </h3>
            <div className="h-px flex-1 bg-emerald-200" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {group.sources.map((source) => renderSourceCard(source))}
          </div>

          {group.subsections && group.subsections.map((subsection) => (
            <div key={subsection.subsectionName} className="mt-6 space-y-3">
              <div className="bg-gradient-to-r from-blue-50 to-emerald-50 p-3 rounded-lg border border-blue-200">
                <h4 className="text-sm font-mono font-bold text-blue-900 mb-2">
                  {subsection.subsectionName}
                </h4>
                {subsection.note && (
                  <p className="text-xs text-gray-700 italic">
                    {subsection.note}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {subsection.sources.map((source) => renderSourceCard(source))}
              </div>
            </div>
          ))}
        </div>
      ))}

      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-px flex-1 bg-emerald-200" />
          <h3 className="text-sm font-mono font-bold text-emerald-800 uppercase tracking-wide">
            State & Local
          </h3>
          <div className="h-px flex-1 bg-emerald-200" />
        </div>

        <Card className="bg-white border-emerald-200 shadow-sm">
          <CardContent className="p-4 space-y-4">
            <div>
              <label className="text-xs font-mono text-emerald-700 mb-2 block">
                GENERAL STATE WEBSITE:
              </label>
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger className="w-full bg-white border-emerald-200 text-gray-900 font-mono">
                  <SelectValue placeholder="Choose a state or territory..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {US_STATES.map((state) => (
                    <SelectItem key={state.code} value={state.code} className="font-mono">
                      {state.name} ({state.code.toUpperCase()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedState && (() => {
              const stateUrl = getOfficialStateUrl(selectedState);
              const stateName = US_STATES.find((s) => s.code === selectedState)?.name;

              return (
                <div className="pt-3 border-t border-emerald-200">
                  <a
                    href={stateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <Button
                      size="sm"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      OPEN OFFICIAL GOVERNMENT WEBSITE
                    </Button>
                  </a>
                  <p className="text-xs text-gray-500 mt-2 font-mono text-center">
                    {stateUrl}
                  </p>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
