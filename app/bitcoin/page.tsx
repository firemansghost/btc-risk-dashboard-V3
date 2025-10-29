import { Suspense } from 'react';
import CanaryPage from '../page';

export default function BitcoinPage() {
  // Render the same component as the root page
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CanaryPage />
    </Suspense>
  );
}

export const metadata = {
  title: 'GhostGauge — Bitcoin G-Score',
  description: 'Real-time Bitcoin risk assessment using a 0–100 G-Score. Five-pillar framework: Liquidity, Momentum, Leverage, Macro, Social.',
};
