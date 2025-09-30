'use client';

import React, { useEffect, useState, ReactElement } from 'react';

interface RadialGaugeProps {
  score: number;
  bandLabel: string;
  className?: string;
}

interface TooltipData {
  x: number;
  y: number;
  content: string;
  visible: boolean;
}

export default function RadialGauge({ score, bandLabel, className = '' }: RadialGaugeProps) {
  const [animatedScore, setAnimatedScore] = useState(score);
  const [isAnimating, setIsAnimating] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipData>({ x: 0, y: 0, content: '', visible: false });
  const [focusedElement, setFocusedElement] = useState<string | null>(null);
  const [needleAngle, setNeedleAngle] = useState(0);
  const [bandsVisible, setBandsVisible] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [particles, setParticles] = useState<Array<{id: number, x: number, y: number, opacity: number}>>([]);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Gauge configuration (moved up to avoid dependency issues)
  const centerX = 140;
  const centerY = 140; // Centered for -180 to 0 arc
  const radius = 100;
  const startAngle = -180; // Start at -180 degrees (true horizontal)
  const endAngle = 0;      // End at 0 degrees (true horizontal)
  const sweepAngle = endAngle - startAngle; // 180 degrees total

  // Animation effect with smooth needle rotation
  useEffect(() => {
    if (score !== animatedScore) {
      setIsAnimating(true);
      
      // Animate needle rotation smoothly
      const currentAngle = (animatedScore / 100) * sweepAngle + startAngle;
      const targetAngle = (score / 100) * sweepAngle + startAngle;
      
      // Respect reduced motion preference
      if (prefersReducedMotion) {
        // Skip animation for reduced motion users
        setNeedleAngle(targetAngle);
        setAnimatedScore(score);
        setIsAnimating(false);
        setAnnouncement(`Bitcoin G-Score updated to ${score}, ${bandLabel} risk band`);
      } else {
        // Use requestAnimationFrame for smooth needle animation
        let startTime: number;
        const duration = 800; // 800ms animation duration
        
        const animateNeedle = (timestamp: number) => {
          if (!startTime) startTime = timestamp;
          const progress = Math.min((timestamp - startTime) / duration, 1);
          
          // Easing function for smooth animation
          const easeOutCubic = 1 - Math.pow(1 - progress, 3);
          const interpolatedAngle = currentAngle + (targetAngle - currentAngle) * easeOutCubic;
          
          setNeedleAngle(interpolatedAngle);
          
          if (progress < 1) {
            requestAnimationFrame(animateNeedle);
          } else {
            setAnimatedScore(score);
            setIsAnimating(false);
            // Announce score change to screen readers
            setAnnouncement(`Bitcoin G-Score updated to ${score}, ${bandLabel} risk band`);
          }
        };
        
        requestAnimationFrame(animateNeedle);
      }
    }
  }, [score, animatedScore, startAngle, sweepAngle, bandLabel, prefersReducedMotion]);

  // Trigger band animation on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setBandsVisible(true);
      setIsLoading(false);
      
      // Only create particle effect if user doesn't prefer reduced motion
      if (!prefersReducedMotion) {
        const newParticles = Array.from({ length: 8 }, (_, i) => ({
          id: i,
          x: centerX + (Math.random() - 0.5) * 40,
          y: centerY + (Math.random() - 0.5) * 40,
          opacity: Math.random() * 0.6 + 0.2
        }));
        setParticles(newParticles);
        
        // Fade out particles after 2 seconds
        setTimeout(() => {
          setParticles([]);
        }, 2000);
      }
    }, prefersReducedMotion ? 0 : 200); // Skip delay for reduced motion users
    return () => clearTimeout(timer);
  }, [centerX, centerY, prefersReducedMotion]);

  // Detect high contrast mode
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    setIsHighContrast(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => setIsHighContrast(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Detect reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Memory cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up any pending animations or timers
      setTooltip({ x: 0, y: 0, content: '', visible: false });
      setParticles([]);
      setAnnouncement('');
    };
  }, []);

  // Enhanced keyboard navigation with arrow keys
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      // Show tooltip for focused element
      if (focusedElement) {
        const content = focusedElement.includes('band') 
          ? `${focusedElement.replace('band-', '')} risk band`
          : `Score: ${focusedElement}`;
        setTooltip({ x: 140, y: 90, content, visible: true });
        setTimeout(() => setTooltip(prev => ({ ...prev, visible: false })), 3000);
      }
    }
    if (event.key === 'Escape') {
      setTooltip(prev => ({ ...prev, visible: false }));
      setFocusedElement(null);
    }
    // Arrow key navigation between score ranges
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const currentScore = Math.round(animatedScore);
      const increment = event.key === 'ArrowRight' ? 5 : -5;
      const newScore = Math.max(0, Math.min(100, currentScore + increment));
      
      // Announce navigation to screen readers
      setAnnouncement(`Navigating to score ${newScore}`);
      
      // Update focused element for visual feedback
      setFocusedElement(`score-${newScore}`);
    }
  };

  // Calculate needle angle (removed duplicate - using animated version below)

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

  // Create band-colored arc segments with staggered animation and gradients
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
    const gradientIds = [
      'purpleGradient',
      'blueGradient', 
      'greenGradient',
      'yellowGradient',
      'orangeGradient',
      'redGradient'
    ];
    
    bands.forEach((band, index) => {
      const startPercent = band.min / 100;
      const endPercent = band.max / 100;
      const segmentStartAngle = startAngle + startPercent * sweepAngle;
      const segmentEndAngle = startAngle + endPercent * sweepAngle;
      
      // Create invisible hit area for better interaction
      const hitAreaRadius = radius + 10; // Adjusted to match new tick positioning
      const hitAreaPath = createArcPath(segmentStartAngle, segmentEndAngle, hitAreaRadius);
      
      segments.push(
        <g key={band.label}>
          {/* Invisible hit area for better interaction */}
          <path
            d={hitAreaPath}
            fill="transparent"
            stroke="transparent"
            strokeWidth="20"
            onMouseEnter={(e) => showTooltip(e, `${band.label} (${band.min}-${band.max}): ${getBandRecommendation(band.label)}`)}
            onMouseLeave={hideTooltip}
            style={{ cursor: 'pointer' }}
          />
          {/* Visible band segment with gradients, glow effects, and high contrast support */}
          <path
            d={createArcPath(segmentStartAngle, segmentEndAngle, radius)}
            fill="none"
            stroke={isHighContrast ? '#000000' : `url(#${gradientIds[index]})`}
            strokeWidth={isHighContrast ? '16' : '12'}
            strokeLinecap="round"
            opacity={isHighContrast ? '0.8' : '0.5'}
            filter="url(#glow)"
            className={`transition-all duration-300 hover:opacity-80 hover:stroke-width-16 hover:drop-shadow-lg ${
              bandsVisible ? 'animate-fade-in' : 'opacity-0'
            }`}
            style={{
              animationDelay: `${index * 100}ms`, // Staggered appearance
              animationFillMode: 'forwards'
            }}
          />
        </g>
      );
    });
    
    return segments;
  };

  // Helper function to get band recommendations
  const getBandRecommendation = (bandLabel: string): string => {
    const recommendations: { [key: string]: string } = {
      'Aggressive Buying': 'High confidence buying opportunity',
      'Regular DCA Buying': 'Good time for dollar-cost averaging',
      'Moderate Buying': 'Consider small position additions',
      'Hold & Wait': 'Hold existing positions',
      'Reduce Risk': 'Consider reducing exposure',
      'High Risk': 'High risk environment - be cautious'
    };
    return recommendations[bandLabel] || 'Risk assessment';
  };

  // Calculate needle end point with smooth animation
  const needleLength = 80;
  const currentNeedleAngle = needleAngle || ((score / 100) * sweepAngle + startAngle);
  const needleEndX = centerX + needleLength * Math.cos(toRadians(currentNeedleAngle));
  const needleEndY = centerY + needleLength * Math.sin(toRadians(currentNeedleAngle));

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

  // Tooltip helper functions
  const showTooltip = (event: React.MouseEvent, content: string) => {
    const rect = (event.target as SVGElement).getBoundingClientRect();
    const svgRect = (event.currentTarget as SVGElement).getBoundingClientRect();
    
    // Calculate position relative to SVG, ensuring tooltip stays within bounds
    const x = event.clientX - svgRect.left;
    const y = Math.max(30, event.clientY - svgRect.top - 20); // Ensure minimum 30px from top
    
    setTooltip({
      x,
      y,
      content,
      visible: true
    });
  };

  const hideTooltip = () => {
    setTooltip(prev => ({ ...prev, visible: false }));
  };

  // Create tick marks with enhanced hierarchy and interactions
  const createTicks = () => {
    const ticks: ReactElement[] = [];
    for (let i = 0; i <= 100; i += 10) {
      const angle = startAngle + (i / 100) * sweepAngle;
      const isMajorTick = i % 50 === 0; // Major ticks at 0, 50, 100
      const tickLength = isMajorTick ? 16 : 10; // Slightly longer minor ticks
      const tickRadius = radius + 10; // Moved further out to accommodate thicker arc
      
      const tickStartX = centerX + (tickRadius - tickLength) * Math.cos(toRadians(angle));
      const tickStartY = centerY + (tickRadius - tickLength) * Math.sin(toRadians(angle));
      const tickEndX = centerX + tickRadius * Math.cos(toRadians(angle));
      const tickEndY = centerY + tickRadius * Math.sin(toRadians(angle));
      
      // Create larger invisible hit area for better interaction
      const hitAreaRadius = tickRadius + 15; // Much larger hit area
      const hitStartX = centerX + (hitAreaRadius - tickLength - 15) * Math.cos(toRadians(angle));
      const hitStartY = centerY + (hitAreaRadius - tickLength - 15) * Math.sin(toRadians(angle));
      const hitEndX = centerX + hitAreaRadius * Math.cos(toRadians(angle));
      const hitEndY = centerY + hitAreaRadius * Math.sin(toRadians(angle));
      
      ticks.push(
        <g key={i}>
          {/* Much larger invisible hit area for easier interaction */}
          <line
            x1={hitStartX}
            y1={hitStartY}
            x2={hitEndX}
            y2={hitEndY}
            stroke="transparent"
            strokeWidth="20" // Much thicker hit area
            onMouseEnter={(e) => showTooltip(e, `Score: ${i}${isMajorTick ? ' (Major)' : ''}`)}
            onMouseLeave={hideTooltip}
            style={{ cursor: 'pointer' }}
          />
          {/* Visible tick mark */}
          <line
            x1={tickStartX}
            y1={tickStartY}
            x2={tickEndX}
            y2={tickEndY}
            stroke={isMajorTick ? "#374151" : "#6B7280"} // Darker major ticks
            strokeWidth={isMajorTick ? 3 : 2} // Slightly thicker minor ticks
            opacity={isMajorTick ? 0.9 : 0.8} // Higher opacity for minor ticks
            className={`${isMajorTick ? "drop-shadow-sm" : ""} transition-all duration-200 hover:opacity-100 hover:stroke-width-${isMajorTick ? '4' : '3'}`} // Hover effects
          />
        </g>
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
    <div className={`relative transition-all duration-300 hover:scale-105 hover:drop-shadow-xl focus-within:ring-2 focus-within:ring-emerald-500 focus-within:ring-opacity-50 ${className}`}>
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 0.3; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fadeIn 0.6s ease-out;
        }
        @keyframes loading-spin {
          from { stroke-dashoffset: 94; }
          to { stroke-dashoffset: 0; }
        }
        .animate-spin {
          animation: loading-spin 1.5s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-fade-in,
          .animate-spin,
          .animate-pulse {
            animation: none !important;
          }
          * {
            transition-duration: 0.01ms !important;
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
      <svg
        width="280"
        height="200"
        viewBox="0 0 280 200"
        className="w-full h-auto"
        role="img"
        aria-label={`Bitcoin G-Score gauge showing ${score} out of 100, currently in ${bandLabel} risk band`}
        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }} // Subtle overall shadow
        onKeyDown={handleKeyDown}
        tabIndex={0}
        aria-live="polite"
        aria-atomic="true"
      >
        {/* Gradient definitions for enhanced visual effects */}
        <defs>
          <linearGradient id="purpleGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.6"/>
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.9"/>
          </linearGradient>
          <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.6"/>
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.9"/>
          </linearGradient>
          <linearGradient id="greenGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22C55E" stopOpacity="0.6"/>
            <stop offset="100%" stopColor="#22C55E" stopOpacity="0.9"/>
          </linearGradient>
          <linearGradient id="yellowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#EAB308" stopOpacity="0.6"/>
            <stop offset="100%" stopColor="#EAB308" stopOpacity="0.9"/>
          </linearGradient>
          <linearGradient id="orangeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#F97316" stopOpacity="0.6"/>
            <stop offset="100%" stopColor="#F97316" stopOpacity="0.9"/>
          </linearGradient>
          <linearGradient id="redGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#EF4444" stopOpacity="0.6"/>
            <stop offset="100%" stopColor="#EF4444" stopOpacity="0.9"/>
          </linearGradient>
          {/* Glow filter for hover effects */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Loading spinner animation */}
        {isLoading && (
          <g>
            <circle
              cx={centerX}
              cy={centerY}
              r="60"
              fill="none"
              stroke="#E5E7EB"
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.3"
            />
            <circle
              cx={centerX}
              cy={centerY}
              r="60"
              fill="none"
              stroke="#3B82F6"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="94 94"
              strokeDashoffset={prefersReducedMotion ? "0" : "94"}
              className={prefersReducedMotion ? "" : "animate-spin"}
              style={{
                animation: prefersReducedMotion ? 'none' : 'loading-spin 1.5s linear infinite',
                transformOrigin: 'center'
              }}
            />
          </g>
        )}
        
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
          {/* Main needle with interactions and micro-animations */}
          <line
            x1={centerX}
            y1={centerY}
            x2={needleEndX}
            y2={needleEndY}
            stroke="#1F2937"
            strokeWidth="4"
            strokeLinecap="round"
            onMouseEnter={(e) => showTooltip(e, `Current Score: ${score} - ${bandLabel}`)}
            onMouseLeave={hideTooltip}
            style={{ cursor: 'pointer' }}
            className="transition-all duration-300 hover:stroke-width-6 hover:drop-shadow-lg"
          />
          {/* Needle tip with gradient and micro-animations */}
          <circle
            cx={needleEndX}
            cy={needleEndY}
            r="6"
            fill="#1F2937"
            stroke="#FFFFFF"
            strokeWidth="2"
            className="transition-all duration-300 hover:r-8 hover:drop-shadow-md"
          />
        </g>
        
        {/* Enhanced center dot with micro-animations */}
        <circle
          cx={centerX}
          cy={centerY}
          r="10"
          fill="#1F2937"
          stroke="#FFFFFF"
          strokeWidth="3"
          className="drop-shadow-md transition-all duration-300 hover:r-12 hover:drop-shadow-lg"
        />
        
        {/* Subtle particle effects */}
        {particles.map((particle) => (
          <circle
            key={particle.id}
            cx={particle.x}
            cy={particle.y}
            r="2"
            fill="#3B82F6"
            opacity={particle.opacity}
            className="animate-pulse"
          />
        ))}
        
        {/* Enhanced Tooltip */}
        {tooltip.visible && (
          <g>
            {/* Tooltip background with better positioning */}
            <rect
              x={Math.max(10, tooltip.x - 100)} // Ensure tooltip doesn't go off left edge
              y={tooltip.y - 30}
              width="200"
              height="25"
              fill="#1F2937"
              stroke="#374151"
              strokeWidth="1"
              rx="6"
              className="drop-shadow-lg"
            />
            {/* Tooltip text with better positioning */}
            <text
              x={Math.max(110, tooltip.x + 100)} // Center text within tooltip
              y={tooltip.y - 15}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="12"
              fill="#FFFFFF"
              fontWeight="500"
            >
              {tooltip.content}
            </text>
          </g>
        )}
      </svg>
      
      {/* Screen reader announcements */}
      <div 
        aria-live="polite" 
        aria-atomic="true" 
        className="sr-only"
        role="status"
      >
        {announcement}
      </div>
      
      {/* Center content removed - now displayed separately in parent component */}
    </div>
  );
}
