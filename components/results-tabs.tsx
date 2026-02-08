'use client';

import { useState, useEffect } from 'react';
import { debugLog } from '@/lib/debug-log';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ExternalLink, Clock, Search, FileText, Loader2, Copy, Building2, Info, LinkIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { isValidUrl, canonicalizeUrl } from '@/lib/url-utils';
import { OfficialSources } from '@/components/official-sources';

interface Result {
  id: string;
  query_id: string;
  source: 'wayback' | 'search' | 'note';
  title: string;
  url: string | null;
  captured_at: string | null;
  snippet: string | null;
  confidence: number;
  created_at: string;
}

interface Note {
  id: string;
  query_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface ResultsTabsProps {
  queryId: string;
  queryStatus: 'running' | 'complete';
  rawInput?: string;
}

const linkifyText = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-600 hover:text-emerald-700 underline cursor-pointer"
        >
          {part}
        </a>
      );
    }
    return <span key={index}>{part}</span>;
  });
};


export function ResultsTabs({ queryId, queryStatus, rawInput }: ResultsTabsProps) {
  const [results, setResults] = useState<Result[]>([]);
  const [note, setNote] = useState<Note | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [showDateJump, setShowDateJump] = useState(false);
  const [jumpDate, setJumpDate] = useState('');
  const [closestCapture, setClosestCapture] = useState<Result | null>(null);

  useEffect(() => {
    setNote(null);
    setNoteContent('');
    fetchResults();
    fetchNote();

    if (queryStatus === 'running') {
      const interval = setInterval(fetchResults, 2000);
      return () => clearInterval(interval);
    }
  }, [queryId, queryStatus]);

  const fetchResults = async () => {
    try {
      const response = await fetch(`/api/results?queryId=${queryId}`);
      const data = response.ok ? await response.json() : null;
      const resultsList = data?.results || [];
      // #region agent log
      debugLog('components/results-tabs.tsx', 'fetchResults completed', { queryId, ok: response.ok, count: resultsList.length, searchCount: resultsList.filter((r: Result) => r.source === 'search').length }, 'H3');
      // #endregion
      setResults(resultsList);
    } catch (error) {
      console.error('Failed to fetch results:', error);
      // #region agent log
      debugLog('components/results-tabs.tsx', 'fetchResults FAILED', { queryId, error: String(error) }, 'H3');
      // #endregion
    } finally {
      setLoading(false);
    }
  };

  const fetchNote = async () => {
    try {
      const response = await fetch(`/api/notes?queryId=${queryId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.note) {
          setNote(data.note);
          setNoteContent(data.note.content ?? '');
        } else {
          setNote(null);
          setNoteContent('');
        }
      } else {
        setNote(null);
        setNoteContent('');
      }
    } catch (error) {
      console.error('Failed to fetch note:', error);
      setNote(null);
      setNoteContent('');
    }
  };

  const handleSaveNote = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queryId, content: noteContent }),
      });

      if (!response.ok) throw new Error('Failed to save note');

      const data = await response.json();
      setNote(data.note);
      toast.success('Note saved successfully');
    } catch (error) {
      toast.error('Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const archiveResults = results.filter((r) => r.source === 'wayback');
  const searchResults = results.filter((r) => r.source === 'search');
  const isUrlInput = rawInput && isValidUrl(rawInput);
  const canonicalUrl = isUrlInput ? canonicalizeUrl(rawInput) : null;

  const availableYears = Array.from(
    new Set(
      archiveResults
        .filter(r => r.captured_at)
        .map(r => new Date(r.captured_at!).getFullYear())
    )
  ).sort((a, b) => b - a);

  const filteredArchiveResults = selectedYear
    ? archiveResults.filter(r =>
        r.captured_at && new Date(r.captured_at).getFullYear() === selectedYear
      )
    : archiveResults;

  const handleCopyAllLinks = () => {
    const links = filteredArchiveResults
      .filter(r => r.url)
      .map(r => r.url)
      .join('\n');

    navigator.clipboard.writeText(links);
    toast.success(
      selectedYear
        ? `${filteredArchiveResults.length} ${selectedYear} capture links copied`
        : 'All capture links copied to clipboard'
    );
  };

  const handleYearClick = (year: number) => {
    setSelectedYear(selectedYear === year ? null : year);
    setClosestCapture(null);
  };

  const handleDateJump = () => {
    if (!jumpDate || archiveResults.length === 0) return;

    try {
      const targetDate = new Date(jumpDate);
      if (isNaN(targetDate.getTime())) {
        toast.error('Invalid date format. Use YYYY-MM-DD');
        return;
      }

      const capturesWithDates = archiveResults
        .filter(r => r.captured_at)
        .map(r => ({
          result: r,
          date: new Date(r.captured_at!)
        }))
        .filter(c => c.date <= targetDate)
        .sort((a, b) => b.date.getTime() - a.date.getTime());

      if (capturesWithDates.length > 0) {
        const closest = capturesWithDates[0].result;
        setClosestCapture(closest);
        setSelectedYear(null);

        setTimeout(() => {
          const element = document.getElementById(`capture-${closest.id}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      } else {
        toast.error('No capture available near this date');
        setClosestCapture(null);
      }
    } catch (error) {
      toast.error('Invalid date format. Use YYYY-MM-DD');
    }
  };

  if (loading && queryStatus === 'running') {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-emerald-700 font-mono text-sm">PROCESSING.QUERY...</p>
        </div>
      </div>
    );
  }

  return (
    <Tabs defaultValue="archive" className="w-full">
      <TabsList className="bg-gray-100 border-emerald-200 font-mono">
        <TabsTrigger value="archive" className="data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">
          <Clock className="h-4 w-4 mr-2" />
          ARCHIVE ({archiveResults.length})
        </TabsTrigger>
        <TabsTrigger value="queries" className="data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">
          <Search className="h-4 w-4 mr-2" />
          QUERIES ({searchResults.length})
        </TabsTrigger>
        <TabsTrigger value="notes" className="data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">
          <FileText className="h-4 w-4 mr-2" />
          NOTES
        </TabsTrigger>
        <TabsTrigger value="official" className="data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">
          <Building2 className="h-4 w-4 mr-2" />
          OFFICIAL SOURCES
        </TabsTrigger>
      </TabsList>

      <TabsContent value="archive" className="space-y-3 mt-4">
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-700" />
          <AlertTitle className="text-blue-900 font-mono font-bold text-sm">HOW THE WAYBACK MACHINE WORKS</AlertTitle>
          <AlertDescription className="text-blue-900 text-xs space-y-2 mt-2">
            <p className="font-semibold">The Wayback Machine does NOT search by topic, name, or keywords.</p>
            <p>It only checks whether a SPECIFIC URL was saved in the past.</p>

            <div className="mt-3 space-y-1">
              <p className="font-semibold">What works best:</p>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                <li>Full URLs (https://example.com/page)</li>
                <li>Homepages (https://example.com)</li>
                <li>Press / News pages (/press, /news, /media)</li>
                <li>Specific articles or documents</li>
              </ul>
            </div>

            <div className="mt-3 space-y-1">
              <p className="font-semibold">What will NOT work:</p>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                <li>Names of people</li>
                <li>Company names by themselves</li>
                <li>Topics or phrases</li>
                <li>Questions or sentences</li>
              </ul>
            </div>

            <p className="mt-3 italic">
              <strong>Tip:</strong> Use Official Sources or Third-Party Search to FIND relevant URLs first. Then paste those URLs here to check if they were archived.
            </p>
          </AlertDescription>
        </Alert>

        {canonicalUrl && (
          <Card className="bg-emerald-50 border-emerald-200 shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-xs text-emerald-700 font-mono font-semibold mb-1">NORMALIZED URL:</p>
                  <p className="text-sm text-gray-700 font-mono break-all">{canonicalUrl}</p>
                </div>
                {archiveResults.length > 0 && (
                  <Button
                    onClick={handleCopyAllLinks}
                    size="sm"
                    variant="outline"
                    className="flex-shrink-0 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    COPY ALL
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {archiveResults.length > 0 && availableYears.length > 0 && (
          <Card className="bg-white border-emerald-200 shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div>
                <p className="text-xs text-gray-600 font-mono font-semibold mb-2">FILTER BY YEAR:</p>
                <div className="flex flex-wrap gap-2">
                  {availableYears.map((year) => (
                    <button
                      key={year}
                      onClick={() => handleYearClick(year)}
                      className={`px-3 py-1 rounded font-mono text-sm transition-all ${
                        selectedYear === year
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                      }`}
                    >
                      {year}
                    </button>
                  ))}
                  {selectedYear && (
                    <button
                      onClick={() => setSelectedYear(null)}
                      className="px-3 py-1 rounded font-mono text-sm bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-300"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-200 pt-3">
                <button
                  onClick={() => setShowDateJump(!showDateJump)}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-mono font-semibold flex items-center gap-1"
                >
                  {showDateJump ? '▼' : '▶'} PINPOINT A DATE
                </button>

                {showDateJump && (
                  <div className="mt-3 space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="YYYY-MM-DD (e.g., 2006-01-24)"
                        value={jumpDate}
                        onChange={(e) => setJumpDate(e.target.value)}
                        className="flex-1 px-3 py-2 text-sm font-mono border border-emerald-200 rounded focus:outline-none focus:border-emerald-500"
                      />
                      <Button
                        onClick={handleDateJump}
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono"
                      >
                        JUMP
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 italic">
                      Wayback only saves pages on certain days. If a date has no capture, try the closest earlier version.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {filteredArchiveResults.length === 0 && archiveResults.length > 0 ? (
          <Card className="bg-white border-emerald-200 shadow-sm">
            <CardContent className="text-center py-8">
              <p className="text-emerald-600/50 font-mono text-sm">NO CAPTURES FOR {selectedYear}</p>
              <p className="text-gray-600 text-sm mt-2">Try a different year or clear the filter.</p>
            </CardContent>
          </Card>
        ) : archiveResults.length === 0 ? (
          <>
            <Card className="bg-white border-emerald-200 shadow-sm">
              <CardContent className="text-center py-8">
                {!isUrlInput ? (
                  <div className="space-y-2">
                    <p className="text-emerald-600/50 font-mono text-sm">ARCHIVE.LOOKUP.REQUIRES.FULL.URL</p>
                    <p className="text-gray-600 text-sm">Archive lookup requires a full URL (including https://)</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-emerald-600/50 font-mono text-sm">NO.WAYBACK.CAPTURES.FOUND</p>
                    <p className="text-gray-600 text-sm">No archived copies were found for this exact URL.</p>
                    <p className="text-gray-600 text-sm">This does NOT mean the content never existed.</p>
                    <p className="text-gray-600 text-sm">Try a homepage, press page, or a related article URL.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {rawInput && (
              <Card className="bg-amber-50 border-amber-200 shadow-sm">
                <CardContent className="p-4">
                  <h3 className="text-amber-900 font-mono font-bold text-sm mb-3 flex items-center gap-2">
                    <LinkIcon className="h-4 w-4" />
                    SUGGESTIONS TO FIND ARCHIVED PAGES
                  </h3>

                  <div className="space-y-3">
                    <p className="text-amber-900 text-xs leading-relaxed">
                      Pages like press releases, news, and reports are archived more often than regular pages because they are frequently linked by journalists, government reports, and documents.
                    </p>

                    <div>
                      <p className="text-amber-900 text-xs font-semibold mb-2">
                        Archive-friendly page paths to try:
                      </p>
                      <div className="bg-white/50 rounded p-3 font-mono text-xs text-amber-900 space-y-1">
                        <div>/news</div>
                        <div>/press</div>
                        <div>/press-releases</div>
                        <div>/media</div>
                        <div>/blog</div>
                        <div>/about</div>
                        <div>/about-us</div>
                        <div>/reports</div>
                        <div>/investigations</div>
                        <div>/statements</div>
                        <div>/publications</div>
                        <div>/documents</div>
                        <div>/archive</div>
                      </div>
                    </div>

                    <div>
                      <p className="text-amber-900 text-xs font-semibold mb-2">
                        Examples:
                      </p>
                      <div className="bg-white/50 rounded p-3 font-mono text-xs text-amber-900 space-y-1">
                        <div>https://example.com/press</div>
                        <div>https://example.org/reports</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          filteredArchiveResults.map((result) => {
            const isHighlighted = closestCapture?.id === result.id;
            return (
              <Card
                key={result.id}
                id={`capture-${result.id}`}
                className={`transition-all ${
                  isHighlighted
                    ? 'bg-yellow-50 border-yellow-400 border-2 shadow-lg'
                    : 'bg-white border-emerald-200 hover:border-emerald-300 hover:shadow-md'
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-gray-900 font-medium font-mono text-sm">{result.title}</h3>
                        {result.confidence === 1.0 && (
                          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 text-xs border border-emerald-200 font-mono">
                            CLOSEST
                          </Badge>
                        )}
                        {isHighlighted && (
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-xs border border-yellow-400 font-mono">
                            PINPOINTED
                          </Badge>
                        )}
                      </div>
                      {result.captured_at && (
                        <p className="text-xs text-gray-500 mb-2 font-mono">
                          Captured {formatDistanceToNow(new Date(result.captured_at), { addSuffix: true })}
                        </p>
                      )}
                      {result.url && (
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-emerald-600 hover:text-emerald-700 underline break-all font-mono block mb-2"
                        >
                          {result.url}
                        </a>
                      )}
                      {result.snippet && (
                        <p className="text-sm text-gray-700">{linkifyText(result.snippet)}</p>
                      )}
                    </div>
                    {result.url && (
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-600 hover:text-emerald-700"
                          title="Open in new tab"
                        >
                          <ExternalLink className="h-5 w-5" />
                        </a>
                        {isHighlighted && (
                          <Button
                            size="sm"
                            asChild
                            className="bg-yellow-600 hover:bg-yellow-700 text-white font-mono text-xs px-2 py-1 h-auto"
                          >
                            <a
                              href={result.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              OPEN
                            </a>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </TabsContent>

      <TabsContent value="queries" className="space-y-3 mt-4">
        {searchResults.length === 0 ? (
          <Card className="bg-white border-emerald-200 shadow-sm">
            <CardContent className="text-center py-12 text-emerald-600/50 font-mono text-sm">
              NO.SEARCH.QUERIES
            </CardContent>
          </Card>
        ) : (
          <>
            <Alert className="bg-blue-50 border-blue-200">
              <Info className="h-4 w-4 text-blue-700" />
              <AlertTitle className="text-blue-900 font-mono font-bold text-sm">DISCOVERY QUERIES</AlertTitle>
              <AlertDescription className="text-blue-900 text-xs space-y-1 mt-2">
                <p className="font-semibold">These queries are designed to maximize the chance of finding surviving traces of deleted or altered content across the web.</p>
                <p className="mt-2">Each query targets specific patterns of how information persists over time: structural pages that are frequently archived, documents that outlive web pages, third-party citations, time-anchored content, and government/oversight records.</p>
              </AlertDescription>
            </Alert>

            {(() => {
              const groupedResults: Record<string, typeof searchResults> = {};
              searchResults.forEach((result) => {
                const category = (result as any).category || 'Other';
                if (!groupedResults[category]) {
                  groupedResults[category] = [];
                }
                groupedResults[category].push(result);
              });

              const categoryOrder = [
                'Basic Search',
                'Structural Pages',
                'File-Based Survivors',
                'External Mentions',
                'Time Anchors',
                'Authority & Oversight',
                'Other'
              ];

              return categoryOrder.map((category) => {
                const categoryResults = groupedResults[category];
                if (!categoryResults || categoryResults.length === 0) return null;

                return (
                  <div key={category} className="space-y-2">
                    <div className="flex items-center gap-2 pt-2">
                      <div className="h-px flex-1 bg-emerald-200" />
                      <h3 className="text-emerald-700 font-mono font-bold text-xs uppercase tracking-wide">
                        {category}
                      </h3>
                      <div className="h-px flex-1 bg-emerald-200" />
                    </div>

                    {categoryResults.map((result) => {
                      const googleSearchUrl = result.snippet
                        ? `https://www.google.com/search?q=${encodeURIComponent(result.snippet)}`
                        : null;

                      const handleCopyQuery = () => {
                        if (result.snippet) {
                          navigator.clipboard.writeText(result.snippet);
                          toast.success('Query copied to clipboard');
                        }
                      };

                      return (
                        <Card key={result.id} className="bg-white border-emerald-200 hover:border-emerald-300 hover:shadow-md transition-all">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h3 className="text-gray-900 font-medium font-mono text-sm">{result.title}</h3>
                                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 text-xs border border-emerald-200 font-mono">
                                    {(result.confidence * 100).toFixed(0)}% SIGNAL
                                  </Badge>
                                </div>
                                {result.snippet && (
                                  <div className="relative group">
                                    <code className="block text-sm text-emerald-700 bg-gray-50 p-3 rounded mt-2 font-mono border border-emerald-200 cursor-pointer select-all"
                                      onClick={handleCopyQuery}
                                      title="Click to copy"
                                    >
                                      {result.snippet}
                                    </code>
                                    <Button
                                      onClick={handleCopyQuery}
                                      size="sm"
                                      variant="ghost"
                                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                              {googleSearchUrl && (
                                <a
                                  href={googleSearchUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-600 hover:text-emerald-700 flex-shrink-0"
                                  title="Search on Google"
                                >
                                  <ExternalLink className="h-5 w-5" />
                                </a>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                );
              });
            })()}
          </>
        )}
      </TabsContent>

      <TabsContent value="notes" className="mt-4">
        <Card className="bg-white border-emerald-200 shadow-sm">
          <CardContent className="p-4 space-y-4">
            <Textarea
              placeholder="Add investigation notes..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              className="min-h-[200px] bg-white border-emerald-200 text-gray-900 placeholder:text-gray-400 font-mono focus:border-emerald-500"
            />
            <div className="flex justify-between items-center">
              {note && (
                <p className="text-xs text-gray-500 font-mono">
                  UPDATED {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true }).toUpperCase()}
                </p>
              )}
              <Button
                onClick={handleSaveNote}
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white ml-auto font-mono"
              >
                {saving ? 'SAVING...' : 'SAVE.NOTE'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="official" className="mt-4">
        <OfficialSources rawInput={rawInput || ''} />
      </TabsContent>
    </Tabs>
  );
}
