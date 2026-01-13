// lib/whatIf/presets.ts
// SSOT presets for alternative weight configurations

export type PresetKey = 'official_30_30' | 'liq_35_25' | 'mom_25_35';

export interface Preset {
  key: PresetKey;
  label: string;
  description: string;
  weights: {
    liquidity: number;
    momentum: number;
    leverage: number;
    macro: number;
    social: number;
  };
}

export const PRESETS: Preset[] = [
  {
    key: 'official_30_30',
    label: 'Official (30/30)',
    description: 'Liquidity 30%, Momentum 30%, Term 20%, Macro 10%, Social 10%',
    weights: {
      liquidity: 0.30,
      momentum: 0.30,
      leverage: 0.20,
      macro: 0.10,
      social: 0.10
    }
  },
  {
    key: 'liq_35_25',
    label: 'Liquidity-Heavy (35/25)',
    description: 'Liquidity 35%, Momentum 25%, Leverage 20%, Macro 10%, Social 10%',
    weights: {
      liquidity: 0.35,
      momentum: 0.25,
      leverage: 0.20,
      macro: 0.10,
      social: 0.10
    }
  },
  {
    key: 'mom_25_35',
    label: 'Momentum-Tilted (25/35)',
    description: 'Liquidity 25%, Momentum 35%, Leverage 20%, Macro 10%, Social 10%',
    weights: {
      liquidity: 0.25,
      momentum: 0.35,
      leverage: 0.20,
      macro: 0.10,
      social: 0.10
    }
  }
];

export function getPreset(key: PresetKey | string): Preset | undefined {
  return PRESETS.find(p => p.key === key);
}

export function getPresetLabel(key: PresetKey | string): string {
  const preset = getPreset(key);
  return preset?.label || 'Official';
}

export function getPresetShortLabel(key: PresetKey | string): string {
  const preset = getPreset(key);
  if (!preset) return '30/30';
  // Extract numbers from description: "Liquidity 35%, Momentum 25%" -> "35/25"
  const match = preset.description.match(/Liquidity (\d+)%.*Momentum (\d+)%/);
  return match ? `${match[1]}/${match[2]}` : '30/30';
}
