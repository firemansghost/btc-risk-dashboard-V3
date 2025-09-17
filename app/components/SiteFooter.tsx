// app/components/SiteFooter.tsx
export default function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-white/10 py-6 text-xs text-white/60">
      <div className="mx-auto max-w-6xl px-4 space-y-1">
        <div>For information only. Not investment advice.</div>
        <div>
          <a className="underline hover:text-white" href="/methodology">Methodology</a> ·{' '}
          <a className="underline hover:text-white" href="/docs/BRAND_CARD.md">Brand Card</a> ·{' '}
          <a className="underline hover:text-white" href="/api/config">Current Config</a>
        </div>
      </div>
    </footer>
  );
}
