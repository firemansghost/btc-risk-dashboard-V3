export async function withTimeout<T>(promise: Promise<T>, ms = 10000, label = 'operation'): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Timeout after ${ms}ms: ${label}`));
    }, ms);
  });
  try {
    const result = await Promise.race([promise, timeout]);
    return result as T;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}


