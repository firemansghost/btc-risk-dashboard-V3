import React from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ETF Flow Predictions | Bitcoin Risk Dashboard',
  description: 'AI-powered forecasting for Bitcoin ETF flows with confidence intervals and trend analysis',
};

export default function ETFPredictionsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-4xl font-bold mb-4">ETF Flow Predictions</h1>
          <p className="text-xl text-blue-100">
            AI-powered forecasting for Bitcoin ETF flows with confidence intervals
          </p>
          <p className="text-lg text-blue-200 mt-2">
            Using advanced time series models and machine learning to predict future ETF flows
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">ETF Predictions Coming Soon</h2>
          <p className="text-gray-600">
            This page is under development. Advanced ETF flow prediction models will be available soon.
          </p>
        </div>
      </div>
    </div>
  );
}