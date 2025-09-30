'use client';

import React, { useEffect, useState, ReactElement } from 'react';

interface RadialGaugeProps {
  score: number;
  bandLabel: string;
  className?: string;
}

export default function RadialGauge({ score, bandLabel, className = '' }: RadialGaugeProps) {
  const [animatedScore, setAnimatedScore] = useState(score);
  const [isAnimating, setIsAnimating] = useState(false);

  // Animation effect
  useEffect(() => {
    if (score !== animatedScore) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setAnimatedScore(score);
        setIsAnimating(false);
      }, 50); // Small delay to ensure smooth animation start
      return () => clearTimeout(timer);
    }
  }, [score, animatedScore]);

  // Gauge configuration
  const centerX = 130;
  const centerY = 140; // Adjusted for better horizontal positioning
  const radius = 100;
  const startAngle = -150; // Start at -150 degrees (more horizontal)
  const endAngle = 30;    // End at +30 degrees (more horizontal)
  const sweepAngle = endAngle - startAngle; // 180 degrees total

  // Calculate needle angle
  const needleAngle = startAngle + (animatedScore / 100) * sweepAngle;

  // Convert degrees to radians
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  // Calculate needle end point
  const needleLength = 80;
  const needleEndX = centerX + needleLength * Math.cos(toRadians(needleAngle));
  const needleEndY = centerY + needleLength * Math.sin(toRadians(needleAngle));

  // Create arc path for background track
  const createArcPath = (startAngle: number, endAngle: number, radius: number) => {
    const start = {
      x: centerX + radius * Math.cos(toRadians(startAngle)),
      y: centerY + radius * Math.sin(toRadians(startAngle))
    };
    const end = {
      x: centerX + radius * Math.cos(toRadians(endAngle)),
      y: centerY + radius * Math.sin(toRadians(endAngle))
    };
    
    // For a 240-degree arc, we need the large arc flag
    const largeArcFlag = "1"; // Always use large arc for 240 degrees
    
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
  };

  // Create tick marks
  const createTicks = () => {
    const ticks: ReactElement[] = [];
    for (let i = 0; i <= 100; i += 10) {
      const angle = startAngle + (i / 100) * sweepAngle;
      const isMajorTick = i % 50 === 0; // Major ticks at 0, 50, 100
      const tickLength = isMajorTick ? 12 : 6;
      const tickRadius = radius + 5;
      
      const tickStartX = centerX + (tickRadius - tickLength) * Math.cos(toRadians(angle));
      const tickStartY = centerY + (tickRadius - tickLength) * Math.sin(toRadians(angle));
      const tickEndX = centerX + tickRadius * Math.cos(toRadians(angle));
      const tickEndY = centerY + tickRadius * Math.sin(toRadians(angle));
      
      ticks.push(
        <line
          key={i}
          x1={tickStartX}
          y1={tickStartY}
          x2={tickEndX}
          y2={tickEndY}
          stroke="#6B7280"
          strokeWidth={isMajorTick ? 2 : 1}
          opacity={0.6}
        />
      );
    }
    return ticks;
  };

  // Create tick labels
  const createTickLabels = () => {
    const labels: ReactElement[] = [];
    const labelRadius = radius + 20;
    
    // Show more labels to make the 0-100 scale clear
    [0, 25, 50, 75, 100].forEach(value => {
      const angle = startAngle + (value / 100) * sweepAngle;
      const labelX = centerX + labelRadius * Math.cos(toRadians(angle));
      const labelY = centerY + labelRadius * Math.sin(toRadians(angle));
      
      labels.push(
        <text
          key={value}
          x={labelX}
          y={labelY}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="12"
          fill="#6B7280"
          fontWeight="500"
        >
          {value}
        </text>
      );
    });
    return labels;
  };

  return (
    <div className={`relative ${className}`}>
      <svg
        width="280"
        height="180"
        viewBox="0 0 280 180"
        className="w-full h-auto"
        aria-hidden="true"
      >
        {/* Background track arc */}
        <path
          d={createArcPath(startAngle, endAngle, radius)}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="8"
          strokeLinecap="round"
        />
        
        {/* Tick marks */}
        {createTicks()}
        
        {/* Tick labels */}
        {createTickLabels()}
        
        {/* Needle */}
        <g className={`transition-transform duration-700 ease-out ${isAnimating ? 'transform-gpu' : ''}`}>
          <line
            x1={centerX}
            y1={centerY}
            x2={needleEndX}
            y2={needleEndY}
            stroke="#1F2937"
            strokeWidth="3"
            strokeLinecap="round"
            style={{
              transformOrigin: `${centerX}px ${centerY}px`,
              transform: `rotate(${needleAngle}deg)`
            }}
          />
          {/* Needle tip */}
          <circle
            cx={needleEndX}
            cy={needleEndY}
            r="4"
            fill="#1F2937"
          />
        </g>
        
        {/* Center dot */}
        <circle
          cx={centerX}
          cy={centerY}
          r="6"
          fill="#1F2937"
        />
      </svg>
      
      {/* Center content area for score and band */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <div className="text-3xl font-bold text-gray-900 mb-1">
            {score}
          </div>
          <div className="text-xs text-gray-600 font-medium">
            {bandLabel}
          </div>
        </div>
      </div>
    </div>
  );
}
