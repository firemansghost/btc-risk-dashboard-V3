// app/components/MacroCard.tsx
import PillarBadge from './PillarBadge';

export default function MacroCard() {
  return (
    <div className="rounded-xl border p-4 bg-gray-50 border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <PillarBadge pillar="macro" />
          <span className="text-sm text-gray-500">Weight 10%</span>
        </div>
        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
          <span className="text-lg font-bold text-gray-400">—</span>
        </div>
      </div>
      
      <h3 className="font-medium text-gray-900 mb-2">Macro Overlay</h3>
      
      <div className="flex items-center gap-2 mb-3">
        <span className="px-2 py-1 text-xs font-medium bg-gray-200 text-gray-600 rounded-full">
          Coming soon
        </span>
      </div>
      
      <div className="text-sm text-gray-500">
        <p>Macroeconomic indicators and cross-asset signals will be integrated here.</p>
        <p className="mt-1">This factor is excluded from the composite calculation.</p>
      </div>
    </div>
  );
}
