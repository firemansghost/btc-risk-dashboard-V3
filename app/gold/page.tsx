import ComingSoonPage from '../components/ComingSoonPage';

export default function GoldPage() {
  const factorPreviews = {
    liquidity: [
      'ETF net shares/tonnage and flow breadth (GLD/IAU aggregate)'
    ],
    momentum: [
      'Distance to 200-day SMA, 20/50/200 cross state, weekly RSI'
    ],
    termStructure: [
      'Futures front–back spread (curve tightness)'
    ],
    macro: [
      'USD (DXY) and real yields (TIPS)'
    ],
    social: [
      'Light narrative intensity'
    ],
    adjustment: 'Spike (Volatility) only'
  };

  return (
    <ComingSoonPage 
      asset="GOLD"
      assetDisplay="Gold"
      factorPreviews={factorPreviews}
    />
  );
}

export const metadata = {
  title: 'GhostGauge — Gold G-Score — Coming Soon',
  description: 'We\'re adapting the GhostGauge framework to Gold. Same 0–100 score and band taxonomy, with factors tuned to XAU\'s market structure.',
  robots: 'noindex',
};
