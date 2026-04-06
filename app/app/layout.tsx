import { TermsAcceptanceDialog } from '@/components/terms-acceptance-dialog';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TermsAcceptanceDialog />
      {children}
    </>
  );
}
