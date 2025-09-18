// lib/artifactFetch.ts
// Helper function to fetch artifacts with cache busting and dev fallback

const ARTIFACT_BASE = process.env.NEXT_PUBLIC_ARTIFACT_BASE || '/';
const PROD_BASE = process.env.NEXT_PUBLIC_PROD_BASE || 'https://ghostgauge.com';

export async function fetchArtifact(path: string, version?: number): Promise<Response> {
  const versionParam = version || Date.now();
  const url = `${ARTIFACT_BASE}${path}${path.includes('?') ? '&' : '?'}v=${versionParam}`;
  
  console.log(`Fetching artifact: ${url}`);
  
  try {
    const response = await fetch(url, { cache: 'no-store' });
    console.log(`Response for ${path}:`, { status: response.status, ok: response.ok });
    
    // If 404 and in development, try production fallback
    if (response.status === 404 && process.env.NODE_ENV === 'development') {
      console.log(`Dev fallback: fetching ${path} from production`);
      const prodUrl = `${PROD_BASE}${path}${path.includes('?') ? '&' : '?'}v=${versionParam}`;
      const prodResponse = await fetch(prodUrl, { cache: 'no-store' });
      if (!prodResponse.ok) throw new Error(`Fetch failed: ${prodResponse.status} ${prodUrl}`);
      return prodResponse;
    }
    
    if (!response.ok) throw new Error(`Fetch failed: ${response.status} ${url}`);
    return response;
  } catch (error) {
    console.error(`Fetch error for ${path}:`, error);
    // If fetch fails and in development, try production fallback
    if (process.env.NODE_ENV === 'development') {
      console.log(`Dev fallback: fetching ${path} from production (error: ${error})`);
      const prodUrl = `${PROD_BASE}${path}${path.includes('?') ? '&' : '?'}v=${versionParam}`;
      const prodResponse = await fetch(prodUrl, { cache: 'no-store' });
      if (!prodResponse.ok) throw new Error(`Fetch failed: ${prodResponse.status} ${prodUrl}`);
      return prodResponse;
    }
    throw error;
  }
}

export function isUsingProdFallback(): boolean {
  return process.env.NODE_ENV === 'development' && ARTIFACT_BASE === '/';
}
