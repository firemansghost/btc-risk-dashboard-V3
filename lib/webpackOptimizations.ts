// Webpack optimization configurations for better bundle splitting

export const webpackOptimizations = {
  // Tree-shaking configuration
  treeShaking: {
    usedExports: true,
    sideEffects: false,
    providedExports: true,
  },

  // Code splitting configuration
  codeSplitting: {
    chunks: 'all',
    minSize: 20000,
    maxSize: 244000,
    cacheGroups: {
      // Vendor chunks
      vendor: {
        test: /[\\/]node_modules[\\/]/,
        name: 'vendors',
        chunks: 'all',
        priority: 10,
      },
      // Common chunks
      common: {
        name: 'common',
        minChunks: 2,
        chunks: 'all',
        priority: 5,
        reuseExistingChunk: true,
      },
      // React chunks
      react: {
        test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
        name: 'react',
        chunks: 'all',
        priority: 20,
      },
      // Next.js chunks
      nextjs: {
        test: /[\\/]node_modules[\\/]next[\\/]/,
        name: 'nextjs',
        chunks: 'all',
        priority: 15,
      },
      // Chart libraries
      charts: {
        test: /[\\/]node_modules[\\/](recharts|d3|chart\.js)[\\/]/,
        name: 'charts',
        chunks: 'all',
        priority: 12,
      },
      // UI libraries
      ui: {
        test: /[\\/]node_modules[\\/](tailwindcss|@tailwindcss)[\\/]/,
        name: 'ui',
        chunks: 'all',
        priority: 8,
      },
    },
  },

  // Bundle optimization
  optimization: {
    minimize: true,
    minimizer: [
      // Terser for JavaScript minification
      '...',
      // CSS minification
      '...',
    ],
    splitChunks: {
      chunks: 'all',
      minSize: 20000,
      maxSize: 244000,
      cacheGroups: {
        default: {
          minChunks: 2,
          priority: -20,
          reuseExistingChunk: true,
        },
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: -10,
          chunks: 'all',
        },
      },
    },
  },

  // Performance optimizations
  performance: {
    hints: 'warning',
    maxEntrypointSize: 400000,
    maxAssetSize: 400000,
    assetFilter: (assetFilename: string) => {
      return !assetFilename.endsWith('.map');
    },
  },

  // Module optimization
  module: {
    rules: [
      // Tree-shaking for ES modules
      {
        test: /\.js$/,
        sideEffects: false,
      },
      // CSS optimization
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: [
                  'autoprefixer',
                  'cssnano',
                ],
              },
            },
          },
        ],
      },
    ],
  },

  // Resolve optimization
  resolve: {
    alias: {
      // Alias for better tree-shaking
      'react': 'react/index.js',
      'react-dom': 'react-dom/index.js',
    },
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
  },
};

// Bundle analysis configuration
export const bundleAnalysisConfig = {
  // Bundle analyzer options
  analyzer: {
    analyzerMode: 'static',
    openAnalyzer: false,
    generateStatsFile: true,
    statsFilename: 'bundle-stats.json',
    reportFilename: 'bundle-report.html',
  },

  // Performance budgets
  budgets: [
    {
      type: 'initial',
      maximumWarning: '400kb',
      maximumError: '500kb',
    },
    {
      type: 'anyComponentStyle',
      maximumWarning: '2kb',
      maximumError: '4kb',
    },
  ],

  // Bundle size monitoring
  monitoring: {
    enabled: true,
    thresholds: {
      warning: 400000, // 400KB
      error: 500000,   // 500KB
    },
    exclude: [
      'node_modules',
      '.next',
      'public',
    ],
  },
};

// Tree-shaking optimization
export const treeShakingOptimizations = {
  // ES module optimization
  esModules: {
    usedExports: true,
    sideEffects: false,
    providedExports: true,
  },

  // CommonJS optimization
  commonJS: {
    usedExports: true,
    sideEffects: false,
  },

  // Import optimization
  imports: {
    // Optimize named imports
    namedImports: true,
    // Optimize default imports
    defaultImports: true,
    // Optimize namespace imports
    namespaceImports: true,
  },

  // Dead code elimination
  deadCodeElimination: {
    enabled: true,
    // Remove unused exports
    removeUnusedExports: true,
    // Remove unused imports
    removeUnusedImports: true,
    // Remove unused variables
    removeUnusedVariables: true,
  },
};

// Bundle splitting strategies
export const bundleSplittingStrategies = {
  // Route-based splitting
  routeBased: {
    strategy: 'route-based',
    chunks: 'all',
    minSize: 20000,
    maxSize: 244000,
  },

  // Component-based splitting
  componentBased: {
    strategy: 'component-based',
    chunks: 'all',
    minSize: 10000,
    maxSize: 100000,
  },

  // Feature-based splitting
  featureBased: {
    strategy: 'feature-based',
    chunks: 'all',
    minSize: 30000,
    maxSize: 200000,
  },

  // Priority-based splitting
  priorityBased: {
    strategy: 'priority-based',
    chunks: 'all',
    minSize: 15000,
    maxSize: 150000,
  },
};

// Performance monitoring
export const performanceMonitoring = {
  // Bundle size monitoring
  bundleSize: {
    enabled: true,
    thresholds: {
      warning: 400000,
      error: 500000,
    },
  },

  // Load time monitoring
  loadTime: {
    enabled: true,
    thresholds: {
      warning: 3000,
      error: 5000,
    },
  },

  // Memory usage monitoring
  memoryUsage: {
    enabled: true,
    thresholds: {
      warning: 100000000, // 100MB
      error: 200000000,   // 200MB
    },
  },
};
