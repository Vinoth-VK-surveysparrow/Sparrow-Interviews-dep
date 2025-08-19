import React, { useEffect, useState } from 'react';

interface CircularTimerProps {
  duration: number; // in seconds
  onTimeUp?: () => void;
  isActive: boolean;
}

export function CircularTimer({ duration, onTimeUp, isActive }: CircularTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(duration);

  useEffect(() => {
    setTimeRemaining(duration);
  }, [duration]);

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          onTimeUp?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, onTimeUp]);

  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const progress = timeRemaining / duration;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="flex justify-center mb-4">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
          <circle 
            cx="32" 
            cy="32" 
            r={radius} 
            stroke="currentColor" 
            strokeWidth="4" 
            fill="none" 
            className="text-gray-200 dark:text-gray-600"
          />
          <circle 
            cx="32" 
            cy="32" 
            r={radius} 
            stroke="currentColor" 
            strokeWidth="4" 
            fill="none" 
            className="text-teal-primary transition-all duration-1000 ease-linear"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-semibold text-gray-900 dark:text-white">
            {timeRemaining}
          </span>
        </div>
      </div>
    </div>
  );
}
