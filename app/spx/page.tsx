import ComingSoonPage from '../components/ComingSoonPage';

export default function SPXPage() {
  const factorPreviews = {
    liquidity: [
      'Advance/decline participation and ETF flow breadth across large SPX funds'
    ],
    momentum: [
      'Distance to 200-day SMA, weekly RSI, 52-week percentile'
    ],
    termStructure: [
      'VIX futures curve and implied − realized volatility'
    ],
    macro: [
      'Rates (2s/10s), credit spreads (HY–IG), and USD impulse'
    ],
    social: [
      'Light narrative intensity'
    ],
    adjustment: 'Spike (Volatility) only—no power-law cycle'
  };

  return (
    <ComingSoonPage 
      asset="SPX"
      assetDisplay="S&P 500"
      factorPreviews={factorPreviews}
    />
  );
}

export const metadata = {
  title: 'GhostGauge — S&P 500 G-Score — Coming Soon',
  description: 'We\'re adapting the GhostGauge framework to S&P 500. Same 0–100 score and band taxonomy, with factors tuned to SPX\'s market structure.',
  robots: {
    index: false,
    follow: false,
  },
  // TODO: When live, change to: robots: { index: true }, and add canonical: '/spx'
};
