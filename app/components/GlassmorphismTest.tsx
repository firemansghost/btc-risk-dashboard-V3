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
            <button className="glass-button px-4 py-2 rounded-lg">
              Glass Button
            </button>
            <button className="glass-button-secondary px-4 py-2 rounded-lg">
              Secondary Glass
            </button>
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
