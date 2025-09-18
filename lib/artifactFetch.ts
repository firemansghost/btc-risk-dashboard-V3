// lib/artifactFetch.ts
// Helper function to fetch artifacts with cache busting and dev fallback

// Fix: Always use relative paths for local artifacts to avoid CSP issues
const PROD_BASE = process.env.NEXT_PUBLIC_PROD_BASE || 'https://ghostgauge.com';

export async function fetchArtifact(path: string, version?: number): Promise<Response> {
  const versionParam = version || Date.now();
  // Force relative path by ensuring path starts with '/' and using relative URL
  const relativePath = path.startsWith('/') ? path : `/${path}`;
  const url = `${relativePath}${path.includes('?') ? '&' : '?'}v=${versionParam}`;
  
  // Debug: log the constructed URL to see what's happening
  console.log(`[fetchArtifact] Constructed URL: "${url}"`);
  
  try {
    const response = await fetch(url, { cache: 'no-store' });
    
    // If 404 and in development, try production fallback
    if (response.status === 404 && process.env.NODE_ENV === 'development') {
      const prodUrl = `${PROD_BASE}${relativePath}${path.includes('?') ? '&' : '?'}v=${versionParam}`;
      const prodResponse = await fetch(prodUrl, { cache: 'no-store' });
      if (!prodResponse.ok) throw new Error(`Fetch failed: ${prodResponse.status} ${prodUrl}`);
      return prodResponse;
    }
    
    if (!response.ok) throw new Error(`Fetch failed: ${response.status} ${url}`);
    return response;
  } catch (error) {
    // If fetch fails and in development, try production fallback
    if (process.env.NODE_ENV === 'development') {
      const prodUrl = `${PROD_BASE}${relativePath}${path.includes('?') ? '&' : '?'}v=${versionParam}`;
      const prodResponse = await fetch(prodUrl, { cache: 'no-store' });
      if (!prodResponse.ok) throw new Error(`Fetch failed: ${prodResponse.status} ${prodUrl}`);
      return prodResponse;
    }
    throw error;
  }
}

export function isUsingProdFallback(): boolean {
  return process.env.NODE_ENV === 'development';
}
