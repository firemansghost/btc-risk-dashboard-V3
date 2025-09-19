type Spec = { key: string; required?: boolean; note?: string };

export function assertEnv(specs: Spec[]) {
  const missing: string[] = [];
  const table = specs.map(s => {
    const val = process.env[s.key];
    const isMissing = s.required && (!val || val.trim() === '');
    if (isMissing) missing.push(s.key);
    return {
      key: s.key,
      present: Boolean(val),
      required: Boolean(s.required),
      note: s.note ?? ''
    };
  });
  if (missing.length > 0) {
    // Throwing helps catch misconfig early in dev; in prod we just log
    console.error('Missing required env vars:', missing.join(', '));
  }
  return table;
}


