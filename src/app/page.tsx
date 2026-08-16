import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <img
          src="/logo.png"
          alt="Logo"
          className="h-12 mx-auto mb-6 object-contain"
        />
        <h1 className="font-display text-4xl mb-10">Open House Team</h1>

        <div className="space-y-4">
          <Link
            href="/report"
            className="block w-full rounded-lg border border-charcoal/10 bg-white px-6 py-4 text-left shadow-sm hover:border-gold transition-colors"
          >
            <span className="font-medium">Submit Weekly Report</span>
            <p className="text-sm text-ink/60 mt-1">
              Groups, leads, and buyer follow-up notes
            </p>
          </Link>

          <Link
            href="/leads"
            className="block w-full rounded-lg border border-charcoal/10 bg-white px-6 py-4 text-left shadow-sm hover:border-gold transition-colors"
          >
            <span className="font-medium">View Walk-in Leads</span>
            <p className="text-sm text-ink/60 mt-1">
              Live submissions from the site
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}