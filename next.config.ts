import type { NextConfig } from "next";

// Bundle analyzer configuration
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  
  // Advanced webpack optimizations
  webpack: (config, { dev, isServer }) => {
    // Tree-shaking optimization
    config.optimization = {
      ...config.optimization,
      usedExports: true,
      sideEffects: false,
      providedExports: true,
    };

    // Aggressive code splitting optimization
    config.optimization.splitChunks = {
      chunks: 'all',
      minSize: 10000,
      maxSize: 100000,
      cacheGroups: {
        // React chunks - highest priority
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
          name: 'react',
          chunks: 'all',
          priority: 30,
          enforce: true,
        },
        // Next.js chunks
        nextjs: {
          test: /[\\/]node_modules[\\/]next[\\/]/,
          name: 'nextjs',
          chunks: 'all',
          priority: 25,
          enforce: true,
        },
        // Chart libraries
        charts: {
          test: /[\\/]node_modules[\\/](recharts|d3|chart\.js)[\\/]/,
          name: 'charts',
          chunks: 'all',
          priority: 20,
          enforce: true,
        },
        // UI libraries
        ui: {
          test: /[\\/]node_modules[\\/](tailwindcss|@tailwindcss)[\\/]/,
          name: 'ui',
          chunks: 'all',
          priority: 15,
          enforce: true,
        },
        // Other vendor chunks
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: 10,
          enforce: true,
        },
        // Common chunks
        common: {
          name: 'common',
          minChunks: 2,
          chunks: 'all',
          priority: 5,
          reuseExistingChunk: true,
          enforce: true,
        },
        // Default chunks
        default: {
          minChunks: 2,
          priority: -20,
          reuseExistingChunk: true,
          enforce: true,
        },
      },
    };

    // Performance optimization
    config.performance = {
      hints: 'warning',
      maxEntrypointSize: 500000,
      maxAssetSize: 500000,
      assetFilter: (assetFilename: string) => {
        return !assetFilename.endsWith('.map');
      },
    };

    // Module optimization
    config.module.rules.push({
      test: /\.js$/,
      sideEffects: false,
    });

    return config;
  },

  // Experimental features for better performance
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['recharts', 'react-icons'],
  },

  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  async headers() {
    return [
      {
        // Apply cache headers to data artifacts
        source: '/data/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
      {
        // Apply cache headers to extras artifacts
        source: '/extras/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
      {
        // Apply cache headers to signals artifacts
        source: '/signals/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
      {
        // Apply cache headers to alerts artifacts
        source: '/alerts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
      {
        // Security headers for all routes
        source: '/(.*)',
        headers: [
          // CSP is now configured in vercel.json
          // {
          //   key: 'Content-Security-Policy',
          //   value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.exchange.coinbase.com https://api.coingecko.com https://api.alternative.me https://fred.stlouisfed.org https://api.metals.live https://www.alphavantage.co https://stooq.com; frame-src 'self' https://vercel.live;",
          // },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
