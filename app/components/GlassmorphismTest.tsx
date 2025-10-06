'use client';

import React, { useState } from 'react';

export default function GlassmorphismTest() {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Glassmorphism Test Component</h2>
      
      {/* Test Button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="mb-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
      >
        {isVisible ? 'Hide' : 'Show'} Glassmorphism Test
      </button>

      {/* Glassmorphism Test Card */}
      {isVisible && (
        <div className="glass-card p-6 rounded-xl">
          <h3 className="text-xl font-semibold mb-4">Glassmorphism Test Card</h3>
          <p className="text-gray-700 mb-4">
            This is a test of the glassmorphism effect. If you can see this with a glass-like appearance,
            the CSS is working correctly.
          </p>
          <div className="flex space-x-4">
            <button className="glass-md glass-hover glass-focus glass-active px-4 py-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95">
              Glass Button
            </button>
            <button className="glass-blue glass-hover glass-focus glass-active px-4 py-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95">
              Blue Glass Button
            </button>
          </div>
          
          {/* Enhanced Glassmorphism Examples */}
          <div className="mt-6 space-y-4">
            <h4 className="text-lg font-semibold">Enhanced Glassmorphism Examples:</h4>
            
            {/* Glass Cards with different styles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-sm p-4 rounded-lg">
                <h5 className="font-semibold mb-2">Small Glass Effect</h5>
                <p className="text-sm">This uses the glass-sm class</p>
              </div>
              
              <div className="glass-md p-4 rounded-lg">
                <h5 className="font-semibold mb-2">Medium Glass Effect</h5>
                <p className="text-sm">This uses the glass-md class</p>
              </div>
              
              <div className="glass-lg p-4 rounded-lg">
                <h5 className="font-semibold mb-2">Large Glass Effect</h5>
                <p className="text-sm">This uses the glass-lg class</p>
              </div>
              
              <div className="glass-xl p-4 rounded-lg">
                <h5 className="font-semibold mb-2">Extra Large Glass Effect</h5>
                <p className="text-sm">This uses the glass-xl class</p>
              </div>
            </div>
            
            {/* Colored Glass Effects */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass-blue p-4 rounded-lg">
                <h5 className="font-semibold mb-2 text-blue-900">Blue Glass</h5>
                <p className="text-sm text-blue-800">Blue tinted glass effect</p>
              </div>
              
              <div className="glass-purple p-4 rounded-lg">
                <h5 className="font-semibold mb-2 text-purple-900">Purple Glass</h5>
                <p className="text-sm text-purple-800">Purple tinted glass effect</p>
              </div>
              
              <div className="glass-green p-4 rounded-lg">
                <h5 className="font-semibold mb-2 text-green-900">Green Glass</h5>
                <p className="text-sm text-green-800">Green tinted glass effect</p>
              </div>
            </div>
            
            {/* Interactive Glass Buttons */}
            <div className="space-y-2">
              <h5 className="font-semibold">Interactive Glass Buttons:</h5>
              <div className="flex flex-wrap gap-2">
                <button className="glass-md glass-hover glass-focus glass-active px-4 py-2 rounded-lg transition-all duration-200">
                  Hover Me
                </button>
                <button className="glass-purple glass-hover glass-focus glass-active px-4 py-2 rounded-lg transition-all duration-200">
                  Purple Glass
                </button>
                <button className="glass-green glass-hover glass-focus glass-active px-4 py-2 rounded-lg transition-all duration-200">
                  Green Glass
                </button>
                <button className="glass-amber glass-hover glass-focus glass-active px-4 py-2 rounded-lg transition-all duration-200">
                  Amber Glass
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Background for testing */}
      <div className="mt-8 p-8 bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500 rounded-xl">
        <h3 className="text-white text-xl font-semibold mb-4">Background Test</h3>
        <p className="text-white/90 mb-4">
          This background should show through the glassmorphism effects above.
        </p>
      </div>
    </div>
  );
}
