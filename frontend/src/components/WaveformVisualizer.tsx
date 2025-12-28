import React, { useMemo } from 'react';

export interface WaveformVisualizerProps {
  audioLevel: number;
  isActive: boolean;
  variant: 'listening' | 'speaking' | 'processing';
  className?: string;
}

export function WaveformVisualizer({ 
  audioLevel, 
  isActive, 
  variant, 
  className = '' 
}: WaveformVisualizerProps) {
  // Generate waveform bars based on audio level and variant
  const waveformBars = useMemo(() => {
    const barCount = 12;
    const bars = [];
    
    for (let i = 0; i < barCount; i++) {
      // Create varied heights for visual interest
      const baseHeight = 20 + (i % 3) * 10;
      let height = baseHeight;
      
      if (isActive) {
        switch (variant) {
          case 'listening':
            // Responsive to audio level with some randomness
            height = baseHeight + (audioLevel * 40) + (Math.random() * 10);
            break;
          case 'speaking':
            // Animated speaking pattern
            height = baseHeight + Math.sin((Date.now() / 100) + i) * 15 + 20;
            break;
          case 'processing':
            // Pulsing pattern for processing
            height = baseHeight + Math.sin((Date.now() / 200) + i * 0.5) * 10 + 15;
            break;
        }
      }
      
      bars.push(Math.max(8, Math.min(60, height)));
    }
    
    return bars;
  }, [audioLevel, isActive, variant]);

  // Color classes based on variant
  const colorClasses = useMemo(() => {
    switch (variant) {
      case 'listening':
        return 'bg-blue-500';
      case 'speaking':
        return 'bg-green-500';
      case 'processing':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
    }
  }, [variant]);

  // Animation classes
  const animationClasses = useMemo(() => {
    if (!isActive) return '';
    
    switch (variant) {
      case 'listening':
        return 'animate-pulse';
      case 'speaking':
        return 'animate-bounce';
      case 'processing':
        return 'animate-pulse';
      default:
        return '';
    }
  }, [isActive, variant]);

  return (
    <div 
      className={`flex items-end justify-center space-x-1 h-16 ${className}`}
      role="img"
      aria-label={`Voice ${variant} indicator`}
    >
      {waveformBars.map((height, index) => (
        <div
          key={index}
          className={`
            w-2 rounded-t-sm transition-all duration-100 ease-out
            ${colorClasses}
            ${animationClasses}
            ${!isActive ? 'opacity-30' : 'opacity-100'}
          `}
          style={{
            height: `${height}px`,
            animationDelay: `${index * 50}ms`
          }}
        />
      ))}
    </div>
  );
}

export default WaveformVisualizer;