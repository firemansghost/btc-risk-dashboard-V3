'use client';

import { useState, useEffect, ReactNode } from 'react';

interface OptimisticUIProps {
  children: ReactNode;
  action: () => Promise<any>;
  onSuccess?: (result: any) => void;
  onError?: (error: any) => void;
  successMessage?: string;
  errorMessage?: string;
  className?: string;
  disabled?: boolean;
}

type OptimisticState = 'idle' | 'pending' | 'success' | 'error';

export default function OptimisticUI({
  children,
  action,
  onSuccess,
  onError,
  successMessage = 'Success!',
  errorMessage = 'Something went wrong',
  className = '',
  disabled = false
}: OptimisticUIProps) {
  const [state, setState] = useState<OptimisticState>('idle');
  const [message, setMessage] = useState<string>('');

  const handleAction = async () => {
    if (disabled || state === 'pending') return;

    setState('pending');
    setMessage('');

    try {
      const result = await action();
      setState('success');
      setMessage(successMessage);
      onSuccess?.(result);
      
      // Reset to idle after 2 seconds
      setTimeout(() => {
        setState('idle');
        setMessage('');
      }, 2000);
    } catch (error) {
      setState('error');
      setMessage(errorMessage);
      onError?.(error);
      
      // Reset to idle after 3 seconds
      setTimeout(() => {
        setState('idle');
        setMessage('');
      }, 3000);
    }
  };

  const getStateClasses = () => {
    switch (state) {
      case 'pending':
        return 'optimistic-loading';
      case 'success':
        return 'optimistic-success';
      case 'error':
        return 'optimistic-error';
      default:
        return '';
    }
  };

  const getMessageClasses = () => {
    switch (state) {
      case 'success':
        return 'text-green-800 bg-green-50 border-green-200';
      case 'error':
        return 'text-red-800 bg-red-50 border-red-200';
      default:
        return '';
    }
  };

  return (
    <div className={`optimistic-ui ${getStateClasses()} ${className}`}>
      <div onClick={handleAction} className="cursor-pointer">
        {children}
      </div>
      
      {state === 'pending' && (
        <div className="flex items-center justify-center p-2">
          <div className="spinner spinner-sm mr-2"></div>
          <span className="text-sm text-gray-600">Loading...</span>
        </div>
      )}
      
      {message && (
        <div className={`mt-2 p-2 rounded-md border text-sm font-medium ${getMessageClasses()}`}>
          {message}
        </div>
      )}
    </div>
  );
}
