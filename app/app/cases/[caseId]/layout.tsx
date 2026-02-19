// Force dynamic so [caseId] is available on first paint (fixes brief section not showing on Vercel).
export const dynamic = 'force-dynamic';

export default function CaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
