// #region agent log
const DEBUG_ENDPOINT = 'http://127.0.0.1:7242/ingest/e0a55016-0dba-46c8-8112-7b93c9c9c645';
export function debugLog(location: string, message: string, data: Record<string, unknown>, hypothesisId?: string) {
  fetch(DEBUG_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location, message, data, timestamp: Date.now(), hypothesisId }) }).catch(() => {});
}
// #endregion
