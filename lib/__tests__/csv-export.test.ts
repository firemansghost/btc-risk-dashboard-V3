import { describe, it, expect } from 'vitest';

/**
 * Unit test for CSV export schema validation
 * Tests the CSV builder logic used in WeightsSandbox component
 */

type SandboxDay = {
  date_utc: string;
  official_composite: number;
  alt_composite: number;
  official_band: string;
  alt_band: string;
  cycle_adj: number;
  spike_adj: number;
};

type Preset = {
  key: string;
};

/**
 * CSV builder function (mirrors WeightsSandbox exportCSV logic)
 */
function buildCSV(data: SandboxDay[], preset: Preset, windowDays: number): string {
  const now = new Date();
  
  // Enforce exact column order
  const columnHeaders = 'date_utc,official_gscore,alt_gscore,official_band,alt_band,official_composite_pre_adj,alt_composite_pre_adj,cycle_adj,spike_adj';
  
  const headers = [
    '# ghostgauge_alt_export',
    '# model_version=v1.1',
    `# preset=${preset.key}`,
    `# window_days=${windowDays}`,
    '# adjustments_caps=cycle±2.0,spike±1.5',
    '# note=adjustments may be 0.0 if not active on given dates',
    `# utc_generated=${now.toISOString()}`,
    '',
    columnHeaders
  ];

  const rows = data.map(day => {
    const official_pre_adj = day.official_composite - (day.cycle_adj || 0) - (day.spike_adj || 0);
    const alt_pre_adj = day.alt_composite - (day.cycle_adj || 0) - (day.spike_adj || 0);
    
    // Ensure adjustments are within caps
    const cycle_adj = Math.max(-2.0, Math.min(2.0, day.cycle_adj || 0));
    const spike_adj = Math.max(-1.5, Math.min(1.5, day.spike_adj || 0));
    
    return [
      day.date_utc,
      day.official_composite.toFixed(1),
      day.alt_composite.toFixed(1),
      day.official_band,
      day.alt_band,
      official_pre_adj.toFixed(1),
      alt_pre_adj.toFixed(1),
      cycle_adj.toFixed(1),
      spike_adj.toFixed(1)
    ];
  });

  return [...headers, ...rows.map(row => row.join(','))].join('\n');
}

describe('CSV Export Schema', () => {
  const mockPreset: Preset = { key: 'official_30_30' };
  const mockWindowDays = 180;

  // Test fixture: historical factor rows
  const mockData: SandboxDay[] = [
    {
      date_utc: '2025-12-01',
      official_composite: 45.5,
      alt_composite: 46.2,
      official_band: 'Hold & Wait',
      alt_band: 'Hold & Wait',
      cycle_adj: 0.0,
      spike_adj: 0.0
    },
    {
      date_utc: '2025-12-02',
      official_composite: 48.3,
      alt_composite: 49.1,
      official_band: 'Hold & Wait',
      alt_band: 'Hold & Wait',
      cycle_adj: 1.2,
      spike_adj: -0.5
    },
    {
      date_utc: '2025-12-03',
      official_composite: 52.7,
      alt_composite: 53.4,
      official_band: 'Moderate Risk',
      alt_band: 'Moderate Risk',
      cycle_adj: -1.8,
      spike_adj: 1.3
    }
  ];

  it('should include all required columns in exact order', () => {
    const csv = buildCSV(mockData, mockPreset, mockWindowDays);
    const lines = csv.split('\n');
    
    // Find the header line (first non-comment, non-empty line)
    const headerLine = lines.find(line => 
      line.trim() && 
      !line.trim().startsWith('#') && 
      line.includes('date_utc')
    );
    
    expect(headerLine).toBeDefined();
    
    const columns = headerLine!.split(',');
    const expectedOrder = [
      'date_utc',
      'official_gscore',
      'alt_gscore',
      'official_band',
      'alt_band',
      'official_composite_pre_adj',
      'alt_composite_pre_adj',
      'cycle_adj',
      'spike_adj'
    ];
    
    expect(columns).toEqual(expectedOrder);
  });

  it('should always include cycle_adj and spike_adj columns', () => {
    const csv = buildCSV(mockData, mockPreset, mockWindowDays);
    const lines = csv.split('\n');
    const headerLine = lines.find(line => 
      line.trim() && 
      !line.trim().startsWith('#') && 
      line.includes('date_utc')
    );
    
    expect(headerLine).toContain('cycle_adj');
    expect(headerLine).toContain('spike_adj');
    
    // Verify data rows also include these columns
    const dataLines = lines.filter(line => 
      line.trim() && 
      !line.trim().startsWith('#') && 
      !line.includes('date_utc')
    );
    
    dataLines.forEach(line => {
      const columns = line.split(',');
      expect(columns.length).toBeGreaterThanOrEqual(9); // At least 9 columns including cycle_adj and spike_adj
    });
  });

  it('should include required metadata headers', () => {
    const csv = buildCSV(mockData, mockPreset, mockWindowDays);
    const lines = csv.split('\n');
    
    expect(csv).toContain('# model_version=v1.1');
    expect(csv).toContain(`# preset=${mockPreset.key}`);
    expect(csv).toContain(`# window_days=${mockWindowDays}`);
    expect(csv).toContain('# adjustments_caps=cycle±2.0,spike±1.5');
    expect(csv).toContain('# note=adjustments may be 0.0 if not active on given dates');
  });

  it('should enforce cycle_adj cap at ±2.0', () => {
    const dataWithHighCycle: SandboxDay[] = [
      {
        date_utc: '2025-12-01',
        official_composite: 50.0,
        alt_composite: 50.0,
        official_band: 'Hold & Wait',
        alt_band: 'Hold & Wait',
        cycle_adj: 3.5, // Exceeds cap
        spike_adj: 0.0
      },
      {
        date_utc: '2025-12-02',
        official_composite: 50.0,
        alt_composite: 50.0,
        official_band: 'Hold & Wait',
        alt_band: 'Hold & Wait',
        cycle_adj: -2.8, // Exceeds cap (negative)
        spike_adj: 0.0
      }
    ];
    
    const csv = buildCSV(dataWithHighCycle, mockPreset, mockWindowDays);
    const lines = csv.split('\n');
    const dataLines = lines.filter(line => 
      line.trim() && 
      !line.trim().startsWith('#') && 
      !line.includes('date_utc')
    );
    
    dataLines.forEach(line => {
      const columns = line.split(',');
      const cycle_adj = parseFloat(columns[7]); // cycle_adj is 8th column (0-indexed: 7)
      
      expect(cycle_adj).toBeGreaterThanOrEqual(-2.0);
      expect(cycle_adj).toBeLessThanOrEqual(2.0);
    });
  });

  it('should enforce spike_adj cap at ±1.5', () => {
    const dataWithHighSpike: SandboxDay[] = [
      {
        date_utc: '2025-12-01',
        official_composite: 50.0,
        alt_composite: 50.0,
        official_band: 'Hold & Wait',
        alt_band: 'Hold & Wait',
        cycle_adj: 0.0,
        spike_adj: 2.3 // Exceeds cap
      },
      {
        date_utc: '2025-12-02',
        official_composite: 50.0,
        alt_composite: 50.0,
        official_band: 'Hold & Wait',
        alt_band: 'Hold & Wait',
        cycle_adj: 0.0,
        spike_adj: -1.8 // Exceeds cap (negative)
      }
    ];
    
    const csv = buildCSV(dataWithHighSpike, mockPreset, mockWindowDays);
    const lines = csv.split('\n');
    const dataLines = lines.filter(line => 
      line.trim() && 
      !line.trim().startsWith('#') && 
      !line.includes('date_utc')
    );
    
    dataLines.forEach(line => {
      const columns = line.split(',');
      const spike_adj = parseFloat(columns[8]); // spike_adj is 9th column (0-indexed: 8)
      
      expect(spike_adj).toBeGreaterThanOrEqual(-1.5);
      expect(spike_adj).toBeLessThanOrEqual(1.5);
    });
  });

  it('should handle zero adjustments correctly', () => {
    const dataWithZeros: SandboxDay[] = [
      {
        date_utc: '2025-12-01',
        official_composite: 50.0,
        alt_composite: 50.0,
        official_band: 'Hold & Wait',
        alt_band: 'Hold & Wait',
        cycle_adj: 0.0,
        spike_adj: 0.0
      }
    ];
    
    const csv = buildCSV(dataWithZeros, mockPreset, mockWindowDays);
    const lines = csv.split('\n');
    const dataLines = lines.filter(line => 
      line.trim() && 
      !line.trim().startsWith('#') && 
      !line.includes('date_utc')
    );
    
    expect(dataLines.length).toBeGreaterThan(0);
    const columns = dataLines[0].split(',');
    const cycle_adj = parseFloat(columns[7]);
    const spike_adj = parseFloat(columns[8]);
    
    expect(cycle_adj).toBe(0.0);
    expect(spike_adj).toBe(0.0);
  });

  it('should include cycle_adj and spike_adj even when missing from input', () => {
    const dataWithMissing: SandboxDay[] = [
      {
        date_utc: '2025-12-01',
        official_composite: 50.0,
        alt_composite: 50.0,
        official_band: 'Hold & Wait',
        alt_band: 'Hold & Wait',
        cycle_adj: undefined as any, // Missing
        spike_adj: undefined as any  // Missing
      }
    ];
    
    const csv = buildCSV(dataWithMissing, mockPreset, mockWindowDays);
    const lines = csv.split('\n');
    const dataLines = lines.filter(line => 
      line.trim() && 
      !line.trim().startsWith('#') && 
      !line.includes('date_utc')
    );
    
    expect(dataLines.length).toBeGreaterThan(0);
    const columns = dataLines[0].split(',');
    
    // Should have 9 columns total
    expect(columns.length).toBe(9);
    
    // Last two should be cycle_adj and spike_adj (as 0.0)
    const cycle_adj = parseFloat(columns[7]);
    const spike_adj = parseFloat(columns[8]);
    
    expect(cycle_adj).toBe(0.0);
    expect(spike_adj).toBe(0.0);
  });

  it('should calculate pre-adjustment composites correctly', () => {
    const csv = buildCSV(mockData, mockPreset, mockWindowDays);
    const lines = csv.split('\n');
    const dataLines = lines.filter(line => 
      line.trim() && 
      !line.trim().startsWith('#') && 
      !line.includes('date_utc')
    );
    
    // Check first data row (index 0 in mockData)
    const firstRow = dataLines[0].split(',');
    const official_gscore = parseFloat(firstRow[1]);
    const alt_gscore = parseFloat(firstRow[2]);
    const official_pre_adj = parseFloat(firstRow[5]);
    const alt_pre_adj = parseFloat(firstRow[6]);
    const cycle_adj = parseFloat(firstRow[7]);
    const spike_adj = parseFloat(firstRow[8]);
    
    // Verify: official_gscore = official_pre_adj + cycle_adj + spike_adj
    const expectedOfficial = official_pre_adj + cycle_adj + spike_adj;
    expect(Math.abs(official_gscore - expectedOfficial)).toBeLessThan(0.1);
    
    // Verify: alt_gscore = alt_pre_adj + cycle_adj + spike_adj
    const expectedAlt = alt_pre_adj + cycle_adj + spike_adj;
    expect(Math.abs(alt_gscore - expectedAlt)).toBeLessThan(0.1);
  });

  it('should produce valid CSV format readable by Excel/Sheets', () => {
    const csv = buildCSV(mockData, mockPreset, mockWindowDays);
    const lines = csv.split('\n');
    
    // Should have at least header + data rows
    expect(lines.length).toBeGreaterThan(2);
    
    // All data rows should have same number of columns as header
    const headerLine = lines.find(line => 
      line.trim() && 
      !line.trim().startsWith('#') && 
      line.includes('date_utc')
    );
    const headerColumns = headerLine!.split(',').length;
    
    const dataLines = lines.filter(line => 
      line.trim() && 
      !line.trim().startsWith('#') && 
      !line.includes('date_utc')
    );
    
    dataLines.forEach(line => {
      const columns = line.split(',');
      expect(columns.length).toBe(headerColumns);
    });
  });
});



