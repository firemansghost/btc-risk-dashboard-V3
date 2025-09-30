'use client';

import React, { useEffect, useState } from 'react';

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
  const centerY = 130;
  const radius = 100;
  const startAngle = -120; // Start at -120 degrees
  const endAngle = 120;    // End at +120 degrees
  const sweepAngle = endAngle - startAngle; // 240 degrees total

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
    
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
  };

  // Create tick marks
  const createTicks = () => {
    const ticks: JSX.Element[] = [];
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
    const labels: JSX.Element[] = [];
    const labelRadius = radius + 20;
    
    [0, 50, 100].forEach(value => {
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
        width="260"
        height="140"
        viewBox="0 0 260 140"
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
