import { promises as fs } from 'node:fs';
import path from 'node:path';

const POSSIBLE_PATHS = [
  path.join(process.cwd(), 'public', 'data', 'latest.json'),
  path.join(process.cwd(), '..', 'public', 'data', 'latest.json'),
  './public/data/latest.json',
  '../public/data/latest.json',
];

export type LatestArtifact = Record<string, unknown> & {
  ok?: boolean;
  composite_score?: number;
  band?: {
    label?: string;
    range?: [number, number];
    key?: string;
    color?: string;
    recommendation?: string;
  };
  factors?: Array<Record<string, unknown>>;
};

/** Read public/data/latest.json and optionally fix band/score mismatch via SSOT. */
export async function readLatestArtifact(): Promise<{ data: LatestArtifact; filePath: string }> {
  let content: string | null = null;
  let filePath: string | null = null;

  for (const testPath of POSSIBLE_PATHS) {
    try {
      content = await fs.readFile(testPath, 'utf8');
      filePath = testPath;
      break;
    } catch {
      // try next path
    }
  }

  if (!content || !filePath) {
    throw new Error('Could not find latest.json in any expected location');
  }

  const latestData = JSON.parse(content) as LatestArtifact;

  if (latestData.composite_score !== null && latestData.composite_score !== undefined) {
    const score = latestData.composite_score;
    const currentBand = latestData.band;

    if (currentBand?.range) {
      const bandMatches = score >= currentBand.range[0] && score <= currentBand.range[1];
      if (!bandMatches) {
        const { getBandForScore } = await import('@/lib/riskConfig.server');
        latestData.band = getBandForScore(score);
      }
    }
  }

  return { data: latestData, filePath };
}
