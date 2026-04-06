/** Dev-only trace; stripped from production bundles via NODE_ENV. */
export function debugLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId?: string
) {
  if (process.env.NODE_ENV !== 'development') return;
  // eslint-disable-next-line no-console -- intentional dev trace
  console.debug('[debug]', hypothesisId ?? '', location, message, data);
}
