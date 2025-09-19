'use client';

export default function Error({ error }: { error: Error }) {
  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold mb-2">Something went wrong.</h1>
      <pre className="text-sm text-gray-700 whitespace-pre-wrap">{error.message}</pre>
    </main>
  );
}


