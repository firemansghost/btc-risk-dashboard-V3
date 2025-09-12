// app/components/PillarBadge.tsx
import { PILLAR_LABELS, PILLAR_COLORS } from '@/lib/weights';
import type { PillarKey } from '@/lib/types';

interface PillarBadgeProps {
  pillar: PillarKey;
  className?: string;
}

export default function PillarBadge({ pillar, className = '' }: PillarBadgeProps) {
  const label = PILLAR_LABELS[pillar];
  const colors = PILLAR_COLORS[pillar];
  
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${colors} ${className}`}>
      {label}
    </span>
  );
}
