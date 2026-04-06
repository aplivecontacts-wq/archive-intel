/** Bump when terms text changes materially so users see the dialog again. */
export const TERMS_VERSION = '1';

const storageKey = () => `archiveintel_terms_accepted_v${TERMS_VERSION}`;

export type TermsAcceptanceRecord = {
  userId: string;
  acceptedAt: string;
};

export function getTermsAcceptance(userId: string): TermsAcceptanceRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TermsAcceptanceRecord;
    if (parsed.userId !== userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setTermsAccepted(userId: string): void {
  if (typeof window === 'undefined') return;
  const record: TermsAcceptanceRecord = {
    userId,
    acceptedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(storageKey(), JSON.stringify(record));
}
