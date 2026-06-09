import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { readLatestArtifact } from '@/lib/latestArtifact';

describe('readLatestArtifact', () => {
  it('returns composite_score matching public/data/latest.json', async () => {
    const rawPath = path.join(process.cwd(), 'public', 'data', 'latest.json');
    const onDisk = JSON.parse(readFileSync(rawPath, 'utf8')) as {
      composite_score?: number;
    };

    const { data } = await readLatestArtifact();

    expect(typeof data.composite_score).toBe('number');
    expect(data.composite_score).toBe(onDisk.composite_score);
    expect(data.ok).toBe(true);
    expect(Array.isArray(data.factors)).toBe(true);
  });
});
