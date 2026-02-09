'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2, Search, ChevronDown, ChevronUp } from 'lucide-react';

type LookupState = 'idle' | 'loading' | 'found' | 'not_found' | 'error';

interface LookupResult {
  found: boolean;
  closest?: { timestamp: string; url: string };
  captures?: { timestamp: string; waybackUrl: string }[];
  error?: string;
}

interface ArchiveLookupProps {
  activeTopic?: string;
}

export function ArchiveLookup({ activeTopic }: ArchiveLookupProps) {
  const [url, setUrl] = useState('');
  const [year, setYear] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [state, setState] = useState<LookupState>('idle');
  const [result, setResult] = useState<LookupResult | null>(null);
  const prevTopicRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (prevTopicRef.current !== undefined && activeTopic !== prevTopicRef.current) {
      setUrl('');
      setResult(null);
      setState('idle');
      setYear('');
      setFromDate('');
      setToDate('');
      setShowAdvanced(false);
    }
    prevTopicRef.current = activeTopic;
  }, [activeTopic]);

  const handleSearch = async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      setState('error');
      setResult({ found: false, error: 'URL must start with http:// or https://' });
      return;
    }

    setState('loading');
    setResult(null);

    const hasFromTo = fromDate.trim() && toDate.trim();

    if (hasFromTo) {
      console.log('[ArchiveLookup] calling CDX route (date range)', { url: trimmedUrl, from: fromDate, to: toDate });
      try {
        const params = new URLSearchParams({
          url: trimmedUrl,
          from: fromDate.trim(),
          to: toDate.trim(),
        });
        const res = await fetch(`/api/wayback/cdx?${params.toString()}`);
        const data = await res.json();

        if (!res.ok) {
          setState('error');
          const errMsg = data?.details ? `${data.error || 'Request failed'}: ${data.details}` : (data?.error || 'Request failed');
          setResult({ found: false, error: errMsg });
          return;
        }

        if (data.ok && data.captures?.length > 0) {
          setState('found');
          setResult({
            found: true,
            closest: data.captures[0]
              ? { timestamp: data.captures[0].timestamp, url: data.captures[0].waybackUrl }
              : undefined,
            captures: data.captures.map((c: { timestamp: string; waybackUrl: string }) => ({
              timestamp: c.timestamp,
              waybackUrl: c.waybackUrl,
            })),
          });
        } else {
          setState('not_found');
          setResult({ found: false });
        }
      } catch (err) {
        setState('error');
        setResult({ found: false, error: 'Network error. Please try again.' });
      }
    } else {
      const useYear = year.trim();
      const timestamp = useYear ? (useYear.length === 4 ? useYear + '0101' : useYear) : null;
      console.log('[ArchiveLookup] calling available route', { url: trimmedUrl, timestamp });
      try {
        const params = new URLSearchParams({ url: trimmedUrl });
        if (timestamp) params.set('timestamp', timestamp);
        const res = await fetch(`/api/wayback/available?${params.toString()}`);
        const data = await res.json();

        if (!res.ok) {
          setState('error');
          setResult({ found: false, error: data?.error || 'Request failed' });
          return;
        }

        if (data.ok && data.found && data.closest?.url) {
          setState('found');
          setResult({
            found: true,
            closest: {
              timestamp: data.closest.timestamp || '',
              url: data.closest.url,
            },
          });
        } else {
          setState('not_found');
          setResult({ found: false });
        }
      } catch (err) {
        setState('error');
        setResult({ found: false, error: 'Network error. Please try again.' });
      }
    }
  };

  const formatTimestamp = (ts: string) => {
    if (!ts || ts.length < 8) return ts;
    const y = ts.slice(0, 4);
    const m = ts.slice(4, 6);
    const d = ts.slice(6, 8);
    return `${y}-${m}-${d}`;
  };

  return (
    <Card className="bg-white border-emerald-200 shadow-sm">
      <CardContent className="p-4 space-y-4">
        <h3 className="text-emerald-700 font-mono font-bold text-sm uppercase tracking-wide">
          ARCHIVE LOOKUP
        </h3>
        <p className="text-xs text-gray-600 font-mono">
          Paste a URL to find the closest archived snapshot.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-mono text-gray-700 mb-1">URL (required)</label>
            <input
              type="url"
              placeholder="https://example.com/page"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono border border-emerald-200 rounded focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-gray-700 mb-1">Year (optional)</label>
            <input
              type="text"
              placeholder="e.g. 2008"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              maxLength={4}
              className="w-full px-3 py-2 text-sm font-mono border border-emerald-200 rounded focus:outline-none focus:border-emerald-500 max-w-[120px]"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-xs font-mono text-emerald-600 hover:text-emerald-700"
          >
            {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Advanced
          </button>

          {showAdvanced && (
            <div className="flex gap-3">
              <div>
                <label className="block text-xs font-mono text-gray-700 mb-1">From (YYYY-MM-DD)</label>
                <input
                  type="text"
                  placeholder="2008-01-01"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-emerald-200 rounded focus:outline-none focus:border-emerald-500 max-w-[140px]"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-gray-700 mb-1">To (YYYY-MM-DD)</label>
                <input
                  type="text"
                  placeholder="2008-12-31"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-emerald-200 rounded focus:outline-none focus:border-emerald-500 max-w-[140px]"
                />
              </div>
            </div>
          )}

          <Button
            onClick={handleSearch}
            disabled={state === 'loading'}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono"
          >
            {state === 'loading' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            Search Archive
          </Button>
        </div>

        {state === 'found' && result && (
          <div className="pt-3 border-t border-emerald-200 space-y-2">
            {result.closest && (
              <>
                <p className="text-sm font-mono text-emerald-700 font-semibold">
                  Closest snapshot: {formatTimestamp(result.closest.timestamp)}
                </p>
                <a
                  href={result.closest.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-mono text-sm"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Snapshot
                </a>
              </>
            )}
            {result.captures && result.captures.length > 1 && (
              <div className="mt-3 space-y-1">
                <p className="text-xs font-mono text-gray-600 font-semibold">All captures in range:</p>
                <ul className="max-h-40 overflow-y-auto space-y-1">
                  {result.captures.map((c, i) => (
                    <li key={i} className="text-xs font-mono">
                      <a
                        href={c.waybackUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-600 hover:text-emerald-700"
                      >
                        {formatTimestamp(c.timestamp)}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {state === 'not_found' && (
          <p className="text-sm font-mono text-gray-600 pt-3 border-t border-emerald-200">
            No captures found for this URL.
          </p>
        )}

        {state === 'error' && result?.error && (
          <p className="text-sm font-mono text-red-600 pt-3 border-t border-emerald-200">
            {result.error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
