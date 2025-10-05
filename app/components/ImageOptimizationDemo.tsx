'use client';

import OptimizedImage from './OptimizedImage';

export default function ImageOptimizationDemo() {
  return (
    <div className="p-6 bg-white rounded-lg shadow-sm border">
      <h3 className="text-lg font-semibold mb-4">Image Optimization Demo</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Open Graph Image Example */}
        <div className="space-y-2">
          <h4 className="font-medium">Open Graph Image</h4>
          <OptimizedImage
            src="/og-default.png"
            alt="GhostGauge Open Graph Image"
            width={400}
            height={200}
            className="rounded-lg border"
            priority={true}
            quality={90}
          />
        </div>

        {/* SVG Icon Example */}
        <div className="space-y-2">
          <h4 className="font-medium">SVG Icon</h4>
          <OptimizedImage
            src="/og-default.svg"
            alt="GhostGauge Logo"
            width={100}
            height={100}
            className="rounded-lg border"
            quality={100}
          />
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        <p><strong>Benefits:</strong></p>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li>Automatic WebP/AVIF format conversion</li>
          <li>Responsive image sizing</li>
          <li>Lazy loading by default</li>
          <li>Loading states and error handling</li>
          <li>Optimized caching</li>
        </ul>
      </div>
    </div>
  );
}
