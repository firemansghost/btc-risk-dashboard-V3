import React, { useState } from 'react';

function PredictionSettings() {
  const [settings, setSettings] = useState({
    predictionHorizon: 7,
    confidenceLevel: 80,
    modelSelection: 'ensemble',
    autoUpdate: true,
    notifications: true
  });

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <div className="w-full">
      <div className="mb-4">
        <h4 className="text-lg font-semibold text-gray-900">Prediction Settings</h4>
        <p className="text-sm text-gray-600">Configure your forecasting preferences</p>
      </div>
      
      <div className="space-y-6">
        {/* Prediction Horizon */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Prediction Horizon
          </label>
          <select 
            value={settings.predictionHorizon}
            onChange={(e) => handleSettingChange('predictionHorizon', parseInt(e.target.value))}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value={1}>1 Day</option>
            <option value={3}>3 Days</option>
            <option value={7}>7 Days</option>
            <option value={14}>14 Days</option>
            <option value={30}>30 Days</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            How far into the future to predict
          </p>
        </div>

        {/* Confidence Level */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Confidence Level: {settings.confidenceLevel}%
          </label>
          <input
            type="range"
            min="60"
            max="95"
            value={settings.confidenceLevel}
            onChange={(e) => handleSettingChange('confidenceLevel', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>60%</span>
            <span>95%</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Minimum confidence for predictions
          </p>
        </div>

        {/* Model Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Model Selection
          </label>
          <div className="space-y-2">
            {[
              { value: 'ensemble', label: 'Ensemble (Recommended)', description: 'Combines multiple models for best accuracy' },
              { value: 'arima', label: 'ARIMA Time Series', description: 'Classical time series forecasting' },
              { value: 'lstm', label: 'LSTM Neural Network', description: 'Deep learning approach' },
              { value: 'random_forest', label: 'Random Forest', description: 'Machine learning ensemble' }
            ].map((option) => (
              <label key={option.value} className="flex items-start">
                <input
                  type="radio"
                  name="modelSelection"
                  value={option.value}
                  checked={settings.modelSelection === option.value}
                  onChange={(e) => handleSettingChange('modelSelection', e.target.value)}
                  className="mt-1 mr-3"
                />
                <div>
                  <div className="text-sm font-medium text-gray-900">{option.label}</div>
                  <div className="text-xs text-gray-600">{option.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Auto Update */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-900">Auto Update</div>
            <div className="text-xs text-gray-600">Automatically refresh predictions</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoUpdate}
              onChange={(e) => handleSettingChange('autoUpdate', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Notifications */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-900">Notifications</div>
            <div className="text-xs text-gray-600">Get alerts for significant changes</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.notifications}
              onChange={(e) => handleSettingChange('notifications', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      {/* Save Button */}
      <div className="mt-6">
        <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
          Save Settings
        </button>
      </div>
    </div>
  );
}

export default PredictionSettings;
