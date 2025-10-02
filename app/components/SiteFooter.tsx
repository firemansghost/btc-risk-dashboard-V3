// app/components/SiteFooter.tsx
export default function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-gray-200 py-6 text-xs text-gray-600">
      <div className="mx-auto max-w-6xl px-4 space-y-1">
        <div>
          <a className="underline hover:text-gray-900" href="/disclaimer">Not investment advice</a>
        </div>
        <div>
          <a className="underline hover:text-gray-900" href="/disclaimer">Disclaimer</a> ·{' '}
          <a className="underline hover:text-gray-900" href="/methodology">Methodology</a> ·{' '}
          <a className="underline hover:text-gray-900" href="/alerts">Alerts</a> ·{' '}
          <a className="underline hover:text-gray-900" href="/brand">Brand Card</a>
        </div>
      </div>
    </footer>
  );
}
