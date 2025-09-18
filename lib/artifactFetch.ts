// lib/artifactFetch.ts
// Helper function to fetch artifacts with cache busting and dev fallback

const ARTIFACT_BASE = process.env.NEXT_PUBLIC_ARTIFACT_BASE || '/';
const PROD_BASE = process.env.NEXT_PUBLIC_PROD_BASE || 'https://ghostgauge.com';

export async function fetchArtifact(path: string, version?: number): Promise<Response> {
  const versionParam = version || Date.now();
  const url = `${ARTIFACT_BASE}${path}?v=${versionParam}`;
  
  try {
    const response = await fetch(url, { cache: 'no-store' });
    
    // If 404 and in development, try production fallback
    if (response.status === 404 && process.env.NODE_ENV === 'development') {
      console.log(`Dev fallback: fetching ${path} from production`);
      const prodUrl = `${PROD_BASE}${path}?v=${versionParam}`;
      return await fetch(prodUrl, { cache: 'no-store' });
    }
    
    return response;
  } catch (error) {
    // If fetch fails and in development, try production fallback
    if (process.env.NODE_ENV === 'development') {
      console.log(`Dev fallback: fetching ${path} from production (error: ${error})`);
      const prodUrl = `${PROD_BASE}${path}?v=${versionParam}`;
      return await fetch(prodUrl, { cache: 'no-store' });
    }
    throw error;
  }
}

export function isUsingProdFallback(): boolean {
  return process.env.NODE_ENV === 'development' && ARTIFACT_BASE === '/';
}
