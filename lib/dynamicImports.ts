import dynamic from 'next/dynamic';

// Utility for creating consistent dynamic imports
export const createDynamicImport = (
  importFn: () => Promise<any>,
  options: {
    loading?: 'modal' | 'card' | 'chart' | 'small' | 'medium' | 'large';
    ssr?: boolean;
  } = {}
) => {
  const { loading = 'medium', ssr = false } = options;

  const getLoadingComponent = () => {
    const baseClasses = "flex items-center justify-center";
    const spinnerSizes = {
      small: "spinner-sm",
      medium: "spinner-md", 
      large: "spinner-lg"
    };

    switch (loading) {
      case 'modal':
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className={`spinner ${spinnerSizes.large}`}></div>
          </div>
        );
      case 'card':
        return (
          <div className="h-32 bg-gray-100 rounded-lg animate-pulse flex items-center justify-center">
            <div className={`spinner ${spinnerSizes.small}`}></div>
          </div>
        );
      case 'chart':
        return (
          <div className="h-64 bg-gray-100 rounded-lg animate-pulse flex items-center justify-center">
            <div className={`spinner ${spinnerSizes.large}`}></div>
          </div>
        );
      case 'small':
        return (
          <div className={`${baseClasses} h-16`}>
            <div className={`spinner ${spinnerSizes.small}`}></div>
          </div>
        );
      case 'medium':
        return (
          <div className={`${baseClasses} h-32`}>
            <div className={`spinner ${spinnerSizes.medium}`}></div>
          </div>
        );
      case 'large':
        return (
          <div className={`${baseClasses} h-64`}>
            <div className={`spinner ${spinnerSizes.large}`}></div>
          </div>
        );
      default:
        return (
          <div className={`${baseClasses} h-32`}>
            <div className={`spinner ${spinnerSizes.medium}`}></div>
          </div>
        );
    }
  };

  return dynamic(importFn, {
    loading: getLoadingComponent,
    ssr
  });
};

// Pre-configured dynamic imports for common patterns
export const createModalImport = (importFn: () => Promise<any>) => 
  createDynamicImport(importFn, { loading: 'modal' });

export const createCardImport = (importFn: () => Promise<any>) => 
  createDynamicImport(importFn, { loading: 'card' });

export const createChartImport = (importFn: () => Promise<any>) => 
  createDynamicImport(importFn, { loading: 'chart' });
