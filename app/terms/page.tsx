import Link from 'next/link';

export const metadata = {
  title: 'Terms & legal — Archive Intel',
  description: 'Terms of Service and legal information for Archive Intel',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container max-w-3xl mx-auto px-4 py-10">
        <Link href="/" className="text-sm text-emerald-700 hover:text-emerald-800 font-mono mb-8 inline-block">
          ← Home
        </Link>
        <h1 className="text-2xl font-mono font-bold text-emerald-900 mb-2">Terms &amp; legal</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: replace this date when counsel reviews.</p>

        <section className="prose prose-sm max-w-none text-gray-800 space-y-6">
          <h2 className="text-lg font-semibold text-emerald-800 font-mono">Terms of Service (placeholder)</h2>
          <p>
            Replace this page with your lawyer-approved Terms of Service and Privacy Policy. The in-app dialog shows a
            short summary; this URL should host the full documents users can read before or after accepting.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Eligibility and account responsibilities</li>
            <li>Acceptable use (lawful research, no harassment, no unauthorized access)</li>
            <li>Intellectual property and user content</li>
            <li>Subscriptions, billing, and cancellation (if applicable)</li>
            <li>Disclaimer of warranties and limitation of liability</li>
            <li>Governing law and dispute resolution</li>
            <li>Contact information for legal notices</li>
          </ul>

          <h2 className="text-lg font-semibold text-emerald-800 font-mono">Privacy Policy (placeholder)</h2>
          <p>
            Describe what you collect (e.g. account data from Clerk, case data in Supabase), why, retention, cookies,
            third parties (Stripe, hosting), and user rights (access, deletion — your delete-data flow may belong here).
          </p>
        </section>
      </div>
    </div>
  );
}
