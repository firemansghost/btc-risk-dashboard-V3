export default function Page() {
  const name = process.env.NEXT_PUBLIC_APP_NAME || "Bitcoin Risk Dashboard";
  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">{name}</h1>
      <p className="text-sm text-neutral-600">
        Scaffold is running. Next we'll add the API routes, factor logic, and the dashboard UI.
      </p>
      <div className="rounded-xl border p-4 bg-white">
        <div className="font-medium mb-2">Sanity check</div>
        <ul className="list-disc ml-5 text-sm">
          <li>Run <code>npm run dev</code> and open <code>http://localhost:3000</code>.</li>
          <li>Health endpoint: <a href="/api/health">/api/health</a></li>
        </ul>
      </div>
    </main>
  );
}
