import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseServer } from '@/lib/supabase-server';
import {
  detectInputType,
  normalizeInput,
  generateMockSearchQueries,
} from '@/lib/query-utils';
import { isValidUrl, isWaybackUrl, parseWaybackUrl, canonicalizeUrl } from '@/lib/url-utils';

async function fetchWaybackData(url: string) {
  try {
    console.log('[fetchWaybackData] Starting for URL:', url);
    const canonicalUrl = canonicalizeUrl(url);
    console.log('[fetchWaybackData] Canonical URL:', canonicalUrl);

    console.log('[fetchWaybackData] Calling Promise.all for availability and CDX...');
    const [availabilityData, cdxData] = await Promise.all([
      fetchAvailability(canonicalUrl),
      fetchCDXData(canonicalUrl)
    ]);

    console.log('[fetchWaybackData] Promise.all completed');
    console.log('[fetchWaybackData] availabilityData:', availabilityData ? 'present' : 'null');
    console.log('[fetchWaybackData] cdxData length:', cdxData ? cdxData.length : 0);

    const result = {
      canonicalUrl,
      closestCapture: availabilityData,
      captures: cdxData
    };

    console.log('[fetchWaybackData] Returning result with', result.captures?.length || 0, 'captures');
    return result;
  } catch (error) {
    console.error('[fetchWaybackData] ERROR:', error);
    console.error('[fetchWaybackData] Error stack:', error instanceof Error ? error.stack : 'no stack');
    return null;
  }
}

async function fetchAvailability(url: string) {
  const availabilityUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;

  try {
    console.log('[fetchAvailability] Fetching:', availabilityUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(availabilityUrl, {
      signal: controller.signal
    });

    clearTimeout(timeout);

    console.log('[fetchAvailability] Response status:', response.status);

    if (!response.ok) {
      console.error('[fetchAvailability] HTTP error:', response.status);
      return null;
    }

    const data = await response.json();
    console.log('[fetchAvailability] Response data:', JSON.stringify(data));
    const result = data.archived_snapshots?.closest || null;
    console.log('[fetchAvailability] Returning:', result ? 'closest capture found' : 'null');
    return result;
  } catch (error) {
    console.error('[fetchAvailability] ERROR:', error);
    console.error('[fetchAvailability] Error message:', error instanceof Error ? error.message : 'unknown');
    return null;
  }
}

async function fetchCDXData(url: string) {
  const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&fl=timestamp,original,statuscode,mimetype&filter=statuscode:200&collapse=digest&limit=50`;

  try {
    console.log('[fetchCDXData] Fetching:', cdxUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(cdxUrl, {
      signal: controller.signal
    });

    clearTimeout(timeout);

    console.log('[fetchCDXData] Response status:', response.status);

    if (!response.ok) {
      console.error('[fetchCDXData] HTTP error:', response.status);
      return [];
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      console.log('[fetchCDXData] CDX returned no data or empty array');
      return [];
    }

    const headers = data[0];
    const rows = data.slice(1);

    console.log('[fetchCDXData] CDX returned', rows.length, 'raw captures');
    console.log('[fetchCDXData] First row sample:', JSON.stringify(rows[0]));

    const canonicalUrlLower = url.toLowerCase();
    console.log('[fetchCDXData] Filtering for canonical URL:', canonicalUrlLower);

    const captures = rows
      .filter((row: string[]) => {
        const original = row[headers.indexOf('original')];
        const canonicalOriginal = original ? canonicalizeUrl(original).toLowerCase() : '';
        const matches = canonicalOriginal === canonicalUrlLower;
        if (!matches && original) {
          console.log('[fetchCDXData] Filtered out:', original, '(canonical:', canonicalOriginal, ')');
        }
        return matches;
      })
      .map((row: string[]) => ({
        timestamp: row[headers.indexOf('timestamp')],
        original: row[headers.indexOf('original')],
        statuscode: row[headers.indexOf('statuscode')],
        mimetype: row[headers.indexOf('mimetype')],
        waybackUrl: `https://web.archive.org/web/${row[headers.indexOf('timestamp')]}/${row[headers.indexOf('original')]}`
      }))
      .reverse();

    console.log('[fetchCDXData] Filtered to', captures.length, 'matching captures');
    if (captures.length > 0) {
      console.log('[fetchCDXData] First capture:', JSON.stringify(captures[0]));
    }

    return captures;
  } catch (error) {
    console.error('[fetchCDXData] ERROR:', error);
    console.error('[fetchCDXData] Error message:', error instanceof Error ? error.message : 'unknown');
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { caseId, rawInput } = body;

    if (!caseId || !rawInput) {
      return NextResponse.json(
        { error: 'caseId and rawInput are required' },
        { status: 400 }
      );
    }

    const { data: caseRow } = await (supabaseServer
      .from('cases') as any)
      .select('id, user_id')
      .eq('id', caseId)
      .single();

    if (!caseRow) {
      return NextResponse.json({ error: 'Case not found or access denied' }, { status: 404 });
    }
    if (caseRow.user_id != null && caseRow.user_id !== userId) {
      return NextResponse.json({ error: 'Case not found or access denied' }, { status: 404 });
    }

    const inputType = detectInputType(rawInput);
    const normalizedInput = normalizeInput(rawInput, inputType);

    const { data: query, error: queryError } = await (supabaseServer
      .from('queries') as any)
      .insert({
        case_id: caseId,
        raw_input: rawInput,
        normalized_input: normalizedInput,
        input_type: inputType,
        status: 'running',
        user_id: userId,
      })
      .select()
      .single();

    if (queryError) {
      return NextResponse.json(
        { error: queryError.message },
        { status: 500 }
      );
    }

    setTimeout(async () => {
      const allResults: any[] = [];

      if (isValidUrl(rawInput)) {
        if (isWaybackUrl(rawInput)) {
          const snapshot = parseWaybackUrl(rawInput);

          if (snapshot) {
            allResults.push({
              query_id: query.id,
              user_id: userId,
              source: 'wayback',
              title: `Direct Wayback Snapshot (${snapshot.captureDate.toLocaleDateString()})`,
              url: snapshot.waybackUrl,
              captured_at: snapshot.captureDate.toISOString(),
              snippet: `Original URL: ${snapshot.originalUrl}`,
              confidence: 1.0,
            });
          }
        } else {
          try {
            console.log('[SEARCH API] Fetching Wayback data for:', rawInput);

            const waybackData = await fetchWaybackData(rawInput);

            console.log('[SEARCH API] Wayback data response received');
            console.log('[SEARCH API] waybackData is null?', waybackData === null);
            if (waybackData) {
              console.log('[SEARCH API] waybackData.closestCapture:', waybackData.closestCapture ? 'present' : 'null');
              console.log('[SEARCH API] waybackData.captures length:', waybackData.captures?.length || 0);
            }

            if (waybackData) {
              console.log('Wayback data received:', {
                hasClosest: !!waybackData.closestCapture,
                captureCount: waybackData.captures?.length || 0
              });

              if (waybackData.closestCapture) {
                const closestResult = {
                  query_id: query.id,
                  user_id: userId,
                  source: 'wayback' as const,
                  title: `Closest Capture (${new Date(waybackData.closestCapture.timestamp * 1000).toLocaleDateString()})`,
                  url: waybackData.closestCapture.url,
                  captured_at: new Date(waybackData.closestCapture.timestamp * 1000).toISOString(),
                  snippet: `Status: ${waybackData.closestCapture.status}`,
                  confidence: 1.0,
                };
                console.log('Adding closest capture:', closestResult);
                allResults.push(closestResult);
              }

              if (waybackData.captures && waybackData.captures.length > 0) {
                console.log('Processing', waybackData.captures.length, 'captures');
                waybackData.captures.forEach((capture: any, index: number) => {
                  const captureDate = new Date(
                    capture.timestamp.slice(0, 4) + '-' +
                    capture.timestamp.slice(4, 6) + '-' +
                    capture.timestamp.slice(6, 8) + 'T' +
                    capture.timestamp.slice(8, 10) + ':' +
                    capture.timestamp.slice(10, 12) + ':' +
                    capture.timestamp.slice(12, 14)
                  );

                  const captureResult = {
                    query_id: query.id,
                    user_id: userId,
                    source: 'wayback' as const,
                    title: captureDate.toLocaleString(),
                    url: capture.waybackUrl,
                    captured_at: captureDate.toISOString(),
                    snippet: `${capture.mimetype} | Status: ${capture.statuscode}`,
                    confidence: 0.95,
                  };

                  if (index === 0) {
                    console.log('Sample capture result:', captureResult);
                  }

                  allResults.push(captureResult);
                });
                console.log('Total wayback results after processing captures:', allResults.filter(r => r.source === 'wayback').length);
              }
            } else {
              console.error('Failed to fetch Wayback data - waybackData is null');
            }
          } catch (error) {
            console.error('Wayback fetch error:', error);
          }
        }
      }

      const searchResults = generateMockSearchQueries(normalizedInput, inputType);
      allResults.push(...searchResults.map((result) => ({
        query_id: query.id,
        user_id: userId,
        ...result,
      })));

      console.log('[SEARCH API] === FINAL RESULTS SUMMARY ===');
      console.log('[SEARCH API] Total results to insert:', allResults.length);
      const waybackResults = allResults.filter(r => r.source === 'wayback');
      const searchQueryResults = allResults.filter(r => r.source === 'search');
      console.log('[SEARCH API] Wayback results:', waybackResults.length);
      console.log('[SEARCH API] Search results:', searchQueryResults.length);

      if (waybackResults.length > 0) {
        console.log('[SEARCH API] First wayback result:', JSON.stringify(waybackResults[0]));
      }

      if (allResults.length > 0) {
        const rowsToInsert = allResults.map((r: any) => {
          const url = r.url ?? (r.source === 'search' && r.snippet
            ? `https://www.google.com/search?q=${encodeURIComponent(r.snippet)}`
            : null);
          return {
            query_id: r.query_id,
            user_id: r.user_id,
            source: r.source,
            title: r.title,
            url,
            captured_at: r.captured_at ?? null,
            snippet: r.snippet ?? null,
            confidence: r.confidence ?? 0.75,
            category: r.source === 'search' ? (r.category ?? null) : null,
          };
        });
        console.log('[SEARCH API] Inserting', rowsToInsert.length, 'results into database...');
        const { error: insertError } = await (supabaseServer
          .from('results') as any)
          .insert(rowsToInsert);

        if (insertError) {
          console.error('[SEARCH API] Failed to insert results:', insertError);
          console.error('[SEARCH API] Insert error details:', JSON.stringify(insertError));
        } else {
          console.log('[SEARCH API] Successfully inserted', allResults.length, 'results');
        }
      } else {
        console.log('[SEARCH API] No results to insert');
      }

      const { error: updateError } = await (supabaseServer
        .from('queries') as any)
        .update({ status: 'complete' })
        .eq('id', query.id)
        .eq('user_id', userId);

      if (updateError) {
        console.error('Failed to update query status:', updateError);
      }
    }, 1000);

    return NextResponse.json({
      queryId: query.id,
      query: {
        id: query.id,
        case_id: query.case_id,
        raw_input: query.raw_input,
        normalized_input: query.normalized_input,
        input_type: query.input_type,
        status: query.status,
        created_at: query.created_at,
      },
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create query' },
      { status: 500 }
    );
  }
}
