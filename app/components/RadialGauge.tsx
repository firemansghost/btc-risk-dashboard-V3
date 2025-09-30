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
  const centerX = 140;
  const centerY = 140; // Centered for -180 to 0 arc
  const radius = 100;
  const startAngle = -180; // Start at -180 degrees (true horizontal)
  const endAngle = 0;      // End at 0 degrees (true horizontal)
  const sweepAngle = endAngle - startAngle; // 180 degrees total

  // Calculate needle angle
  const needleAngle = startAngle + (animatedScore / 100) * sweepAngle;

  // Convert degrees to radians
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  // Risk bands configuration
  const bands = [
    { min: 0, max: 14, label: 'Aggressive Buying' },
    { min: 15, max: 34, label: 'Regular DCA Buying' },
    { min: 35, max: 49, label: 'Moderate Buying' },
    { min: 50, max: 64, label: 'Hold & Wait' },
    { min: 65, max: 79, label: 'Reduce Risk' },
    { min: 80, max: 100, label: 'High Risk' }
  ];

  // Create band-colored arc segments
  const createBandSegments = () => {
    const segments: ReactElement[] = [];
    const bandColors = [
      '#8B5CF6', // Purple (Aggressive Buying)
      '#3B82F6', // Blue (Regular DCA)
      '#22C55E', // Green (Moderate Buying)
      '#EAB308', // Yellow (Hold & Wait)
      '#F97316', // Orange (Reduce Risk)
      '#EF4444'  // Red (High Risk)
    ];
    
    bands.forEach((band, index) => {
      const startPercent = band.min / 100;
      const endPercent = band.max / 100;
      const segmentStartAngle = startAngle + startPercent * sweepAngle;
      const segmentEndAngle = startAngle + endPercent * sweepAngle;
      
      
      segments.push(
        <path
          key={band.label}
          d={createArcPath(segmentStartAngle, segmentEndAngle, radius)}
          fill="none"
          stroke={bandColors[index]}
          strokeWidth="8"
          strokeLinecap="round"
          opacity="0.3"
        />
      );
    });
    
    return segments;
  };

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
    
    // Calculate the angle difference to determine if we need large arc
    const angleDiff = Math.abs(endAngle - startAngle);
    const largeArcFlag = angleDiff > 180 ? "1" : "0";
    
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
  };

  // Create tick marks with enhanced hierarchy
  const createTicks = () => {
    const ticks: ReactElement[] = [];
    for (let i = 0; i <= 100; i += 10) {
      const angle = startAngle + (i / 100) * sweepAngle;
      const isMajorTick = i % 50 === 0; // Major ticks at 0, 50, 100
      const tickLength = isMajorTick ? 16 : 10; // Slightly longer minor ticks
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
          stroke={isMajorTick ? "#374151" : "#6B7280"} // Darker major ticks
          strokeWidth={isMajorTick ? 3 : 2} // Slightly thicker minor ticks
          opacity={isMajorTick ? 0.9 : 0.8} // Higher opacity for minor ticks
          className={isMajorTick ? "drop-shadow-sm" : ""} // Subtle shadow for major ticks
        />
      );
    }
    return ticks;
  };

  // Create tick labels with enhanced typography
  const createTickLabels = () => {
    const labels: ReactElement[] = [];
    const labelRadius = radius + 24; // Slightly further out for better spacing
    
    // Show key labels with enhanced styling
    [0, 25, 50, 75, 100].forEach(value => {
      const angle = startAngle + (value / 100) * sweepAngle;
      const labelX = centerX + labelRadius * Math.cos(toRadians(angle));
      const labelY = centerY + labelRadius * Math.sin(toRadians(angle));
      
      // Enhanced styling for major labels (0, 50, 100)
      const isMajorLabel = value % 50 === 0;
      
      labels.push(
        <text
          key={value}
          x={labelX}
          y={labelY}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={isMajorLabel ? "14" : "12"} // Larger font for major labels
          fill={isMajorLabel ? "#1F2937" : "#4B5563"} // Darker color for major labels
          fontWeight={isMajorLabel ? "700" : "600"} // Bolder font weight for major labels
          className={isMajorLabel ? "drop-shadow-sm" : ""} // Subtle shadow for major labels
        >
          {value}
        </text>
      );
    });
    return labels;
  };

  return (
    <div className={`relative transition-all duration-300 hover:scale-105 hover:drop-shadow-xl ${className}`}>
      <svg
        width="280"
        height="180"
        viewBox="0 0 280 180"
        className="w-full h-auto"
        aria-hidden="true"
        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }} // Subtle overall shadow
      >
        {/* Band-colored arc segments */}
        {createBandSegments()}
        
        {/* Background track arc (subtle) */}
        <path
          d={createArcPath(startAngle, endAngle, radius)}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.5"
        />
        
        {/* Tick marks */}
        {createTicks()}
        
        {/* Tick labels */}
        {createTickLabels()}
        
        {/* Enhanced Needle */}
        <g className="drop-shadow-lg">
          {/* Needle shadow */}
          <line
            x1={centerX + 1}
            y1={centerY + 1}
            x2={needleEndX + 1}
            y2={needleEndY + 1}
            stroke="#000000"
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.2"
          />
          {/* Main needle */}
          <line
            x1={centerX}
            y1={centerY}
            x2={needleEndX}
            y2={needleEndY}
            stroke="#1F2937"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* Needle tip with gradient */}
          <circle
            cx={needleEndX}
            cy={needleEndY}
            r="6"
            fill="#1F2937"
            stroke="#FFFFFF"
            strokeWidth="2"
          />
        </g>
        
        {/* Enhanced center dot */}
        <circle
          cx={centerX}
          cy={centerY}
          r="10"
          fill="#1F2937"
          stroke="#FFFFFF"
          strokeWidth="3"
          className="drop-shadow-md"
        />
      </svg>
      
      {/* Center content removed - now displayed separately in parent component */}
    </div>
  );
}
