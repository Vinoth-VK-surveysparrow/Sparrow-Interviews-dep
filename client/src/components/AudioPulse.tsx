import React from 'react';

interface AudioPulseProps {
  volume: number;
  speaking?: boolean;
  className?: string;
}

const AudioPulse: React.FC<AudioPulseProps> = ({ 
  volume, 
  speaking = false, 
  className = '' 
}) => {
  // Normalize volume to 0-1 range and apply scaling
  const normalizedVolume = Math.min(Math.max(volume * 20, 0), 1);
  
  return (
    <div className={`audio-pulse ${className}`}>
      <div className="pulse-container">
        {/* Core circle */}
        <div 
          className="pulse-core"
          style={{
            transform: `scale(${1 + normalizedVolume * 0.3})`,
            backgroundColor: speaking ? '#10b981' : '#6366f1',
          }}
        />
        
        {/* Animated rings */}
        <div 
          className="pulse-ring pulse-ring-1"
          style={{
            transform: `scale(${1.2 + normalizedVolume * 0.5})`,
            opacity: normalizedVolume * 0.6,
            borderColor: speaking ? '#10b981' : '#6366f1',
          }}
        />
        <div 
          className="pulse-ring pulse-ring-2"
          style={{
            transform: `scale(${1.4 + normalizedVolume * 0.7})`,
            opacity: normalizedVolume * 0.4,
            borderColor: speaking ? '#10b981' : '#6366f1',
          }}
        />
        <div 
          className="pulse-ring pulse-ring-3"
          style={{
            transform: `scale(${1.6 + normalizedVolume * 0.9})`,
            opacity: normalizedVolume * 0.2,
            borderColor: speaking ? '#10b981' : '#6366f1',
          }}
        />
      </div>
      
      <style dangerouslySetInnerHTML={{
        __html: `
        .audio-pulse {
          position: relative;
          width: 120px;
          height: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .pulse-container {
          position: relative;
          width: 60px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .pulse-core {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          transition: all 0.1s ease-out;
          position: relative;
          z-index: 2;
        }
        
        .pulse-ring {
          position: absolute;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          border: 2px solid;
          transition: all 0.1s ease-out;
          animation: pulse 2s infinite;
        }
        
        .pulse-ring-1 {
          animation-delay: 0s;
        }
        
        .pulse-ring-2 {
          animation-delay: 0.3s;
        }
        
        .pulse-ring-3 {
          animation-delay: 0.6s;
        }
        
        @keyframes pulse {
          0% {
            transform: scale(1);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.5;
          }
          100% {
            transform: scale(1.2);
            opacity: 0;
          }
        }
        `
      }} />
    </div>
  );
};

export default AudioPulse;
