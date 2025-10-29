import { Metadata } from 'next';
import WeightsSandbox from '@/app/components/WeightsSandbox';

export const metadata: Metadata = {
  title: 'Weights Sandbox (Experimental) — GhostGauge',
  description: 'Compare alternative pillar weightings against the official G-Score. Experimental feature for research and education only.',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
  other: {
    'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
  },
};

export default function WeightsSandboxPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <WeightsSandbox />
      </div>
    </div>
  );
}
