'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getTermsAcceptance, setTermsAccepted } from '@/lib/terms-acceptance';

/**
 * Shown once per user (per TERMS_VERSION) after sign-in on /app routes until they accept.
 * Stored in localStorage — for audit-grade proof, persist server-side later.
 */
export function TermsAcceptanceDialog() {
  const { user, isLoaded } = useUser();
  const userId = user?.id;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isLoaded || !userId) return;
    const existing = getTermsAcceptance(userId);
    if (!existing) setOpen(true);
  }, [isLoaded, userId]);

  const handleAccept = () => {
    if (!userId) return;
    setTermsAccepted(userId);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        hideClose
        className="max-w-lg max-h-[90vh] flex flex-col sm:max-w-xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="font-mono text-emerald-800">Terms and acceptable use</DialogTitle>
          <DialogDescription className="text-left text-gray-600">
            Before using Archive Intel, please read and accept the following. For the full text, see{' '}
            <Link href="/terms" className="text-emerald-700 underline font-mono" target="_blank" rel="noopener noreferrer">
              Terms &amp; legal
            </Link>
            .
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-emerald-100 bg-emerald-50/40 p-4 text-sm text-gray-700 space-y-3">
          <p>
            <strong className="text-emerald-900">Authorized use.</strong> You agree to use this platform only for lawful,
            authorized OSINT and research purposes in compliance with applicable laws and regulations.
          </p>
          <p>
            <strong className="text-emerald-900">No warranties.</strong> The service is provided &quot;as is&quot; without
            guarantees of accuracy, completeness, or fitness for a particular purpose.
          </p>
          <p>
            <strong className="text-emerald-900">Limitation of liability.</strong> To the extent permitted by law, Archive
            Intel and its operators are not liable for damages arising from your use of the service or reliance on its
            outputs.
          </p>
          <p className="text-xs text-gray-500 border-t border-emerald-100 pt-3">
            This summary is a placeholder. Replace with counsel-reviewed Terms of Service and Privacy Policy on the{' '}
            <Link href="/terms" className="text-emerald-700 underline" target="_blank" rel="noopener noreferrer">
              /terms
            </Link>{' '}
            page before production.
          </p>
        </div>
        <DialogFooter className="shrink-0 sm:justify-end gap-2">
          <Button type="button" className="font-mono bg-emerald-600 hover:bg-emerald-700" onClick={handleAccept}>
            I have read and agree
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
