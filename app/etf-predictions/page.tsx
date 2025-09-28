import React from 'react';
import { Metadata } from 'next';
import ForecastCard from '@/components/ForecastCard';
import PredictionChart from '@/components/PredictionChart';
import IndividualETFPredictions from '@/components/IndividualETFPredictions';
import ModelPerformance from '@/components/ModelPerformance';
import PredictionSettings from '@/components/PredictionSettings';

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
        {/* Quick Forecasts */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Forecasts</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ForecastCard 
              title="Tomorrow's Flow"
              prediction="$45.2M"
              confidence="85%"
              trend="up"
              description="Expected daily flow for tomorrow"
            />
            <ForecastCard 
              title="This Week"
              prediction="$312.4M"
              confidence="78%"
              trend="stable"
              description="7-day rolling sum forecast"
            />
            <ForecastCard 
              title="Next Week"
              prediction="$298.7M"
              confidence="72%"
              trend="down"
              description="Following week projection"
            />
          </div>
        </div>

        {/* Detailed Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Flow Predictions</h3>
            <PredictionChart />
          </div>
          
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Individual ETF Forecasts</h3>
            <IndividualETFPredictions />
          </div>
        </div>

        {/* Model Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Model Performance</h3>
            <ModelPerformance />
          </div>
          
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Prediction Settings</h3>
            <PredictionSettings />
          </div>
        </div>

        {/* Historical Accuracy */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-semibold mb-4">Historical Accuracy</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">87.3%</div>
              <div className="text-sm text-gray-600">1-Day Accuracy</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">82.1%</div>
              <div className="text-sm text-gray-600">7-Day Accuracy</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">76.8%</div>
              <div className="text-sm text-gray-600">30-Day Accuracy</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
