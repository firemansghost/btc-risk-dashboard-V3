import ComingSoonPage from '../components/ComingSoonPage';

export default function TSLAPage() {
  const factorPreviews = {
    liquidity: [
      'Options put/call tilt, volume vs 90-day average, ETF inclusion flow proxy'
    ],
    momentum: [
      'Distance to 200-day SMA, weekly RSI, 52-week percentile'
    ],
    termStructure: [
      'Implied − realized vol spread and skew/tilt proxy'
    ],
    macro: [
      'Rates sensitivity and SPX beta context'
    ],
    social: [
      'Light narrative intensity'
    ],
    adjustment: 'Spike (Volatility) only'
  };

  return (
    <ComingSoonPage 
      asset="TSLA"
      assetDisplay="Tesla"
      factorPreviews={factorPreviews}
    />
  );
}

export const metadata = {
  title: 'GhostGauge — Tesla G-Score — Coming Soon',
  description: 'We\'re adapting the GhostGauge framework to Tesla. Same 0–100 score and band taxonomy, with factors tuned to TSLA\'s market structure.',
  robots: {
    index: false,
    follow: false,
  },
  // TODO: When live, change to: robots: { index: true }, and add canonical: '/tsla'
};
