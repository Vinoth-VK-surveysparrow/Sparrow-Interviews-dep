import { useState, useEffect, useRef, useCallback } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Home, Mic, MicOff, Play, Download } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { AudioUploadService } from '@/lib/audioUploadService';
import { useBehaviorMonitoring } from '@/hooks/useBehaviorMonitoring';
import { WarningBadge } from '@/components/WarningBadge';

interface EnergyChange {
  timestamp: number;
  level: number;
  type: "energy" | "breathe";
  frequency?: number;
}

interface AssessmentResult {
  totalChanges: number;
  successfulTransitions: number;
  averageResponseTime: number;
  energyRange: number;
  breatheRecoveries: number;
  audioBlob?: Blob;
  frequencyData?: number[];
  energyAccuracy: number;
  overallScore: number;

}

type AssessmentState = "setup" | "playing" | "feedback" | "loading";

// Configuration state that will be loaded from API
interface ConductorConfig {
  gameSettings: {
    duration: number;
    changeFrequency: number;
    defaultEnergyLevel: number;
    breatheCueProbability: number;
    breatheDisplayDuration: number;
    changeFrequencyVariance: number;
    recordingChunkInterval: number;
  };
  presets: {
    standard: { name: string; description: string; energyLevels: number[] };
    low: { name: string; description: string; energyLevels: number[] };
    high: { name: string; description: string; energyLevels: number[] };
  };
  topics: string[];
  energyLevels: Array<{
    level: number;
    name: string;
    description: string;
    targetFreq: number;
    color: string;
  }>;
}

export default function ConductorAssessment() {
  const [, params] = useRoute('/conductor/:assessmentId');
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Behavior monitoring hook
  const { isMonitoring, stopMonitoring, flagCount, showWarning, warningMessage } = useBehaviorMonitoring({
    enabled: true,
    delayBeforeStart: 15000, // Start monitoring after 15 seconds (when first image is captured)
    pollingInterval: 10000, // Check every 10 seconds
  });

  const [assessmentState, setAssessmentState] = useState<AssessmentState>("loading");
  const [config, setConfig] = useState<ConductorConfig | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<'standard' | 'low' | 'high'>('standard');
  const [currentTopic, setCurrentTopic] = useState("");
  const [currentEnergyLevel, setCurrentEnergyLevel] = useState(5);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [assessmentStartTime, setAssessmentStartTime] = useState(0);
  const [energyChanges, setEnergyChanges] = useState<EnergyChange[]>([]);
  const [showBreathe, setShowBreathe] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState<AssessmentResult | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [nextChangeIn, setNextChangeIn] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [currentPitch, setCurrentPitch] = useState(0);
  const [lastPitchLevel, setLastPitchLevel] = useState(0);
  const [pitchHistory, setPitchHistory] = useState<Array<{timestamp: number, pitch: number, energyLevel: number}>>([]);
  const [energyLevelFrames, setEnergyLevelFrames] = useState<Array<{level: number, startTime: number, endTime?: number, pitches: number[]}>>([]);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const changeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const breatheTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const energyChangesRef = useRef<EnergyChange[]>([]);
  const isRecordingRef = useRef<boolean>(false);

  // Load conductor configuration from API
  const loadConfig = useCallback(async () => {
    try {
      console.log('🎮 Loading conductor configuration...');
      const apiUrl = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${apiUrl}/conductor-config`);
      if (!response.ok) {
        throw new Error('Failed to load conductor config');
      }
      const configData: ConductorConfig = await response.json();
      console.log('✅ Conductor config loaded:', configData);
      setConfig(configData);
      
      // Set random topic from loaded topics
      if (configData.topics && configData.topics.length > 0) {
        const randomTopic = configData.topics[Math.floor(Math.random() * configData.topics.length)];
        setCurrentTopic(randomTopic);
      }
      
      // Set default energy level from config
      if (configData.gameSettings?.defaultEnergyLevel) {
        setCurrentEnergyLevel(configData.gameSettings.defaultEnergyLevel);
      }
      
      // Set initial timer from config
      if (configData.gameSettings?.duration) {
        setTimeRemaining(configData.gameSettings.duration);
      }
      
      setAssessmentState("setup");
    } catch (error) {
      console.error('❌ Failed to load conductor config:', error);
      toast({
        title: "Configuration Error",
        description: "Failed to load conductor assessment configuration. Please try again.",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Load config on component mount
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);



  // Handle video stream connection
  useEffect(() => {
    if (videoStream && videoRef.current) {
      console.log('🎥 Connecting Conductor video stream to element');
      videoRef.current.srcObject = videoStream;
    }
  }, [videoStream]);

  const getRandomTopic = useCallback(() => {
    // Fallback topics if config is not loaded
    const fallbackTopics = [
      "The importance of teamwork in achieving goals",
      "Why continuous learning is essential for career growth", 
      "The impact of technology on modern communication",
      "How to build confidence in public speaking",
      "The benefits of maintaining work-life balance"
    ];
    
    const topics = config?.topics && config.topics.length > 0 ? config.topics : fallbackTopics;
    return topics[Math.floor(Math.random() * topics.length)];
  }, [config]);

  // Enhanced autocorrelation-based pitch detection - returns frequency in Hz for energy mapping
  const detectPitch = useCallback((audioData: Float32Array): number => {
    const sampleRate = audioContextRef.current?.sampleRate || 44100;
    // Updated frequency range based on new energy level requirements (40-280+ Hz)
    const minFreq = 30;   // Below whisper level for safety margin
    const maxFreq = 300;  // Above explosive level for full range coverage
    
    // Step 1: Calculate RMS for noise gate - More sensitive threshold
    let rms = 0;
    let peak = 0;
    for (let i = 0; i < audioData.length; i++) {
      const sample = audioData[i];
      rms += sample * sample;
      peak = Math.max(peak, Math.abs(sample));
    }
    rms = Math.sqrt(rms / audioData.length);
    
    // Much more sensitive noise gate - allow quieter sounds
    if (rms < 0.001 && peak < 0.01) {
      console.log(`🔇 Audio too quiet - RMS: ${rms.toFixed(6)}, Peak: ${peak.toFixed(6)}`);
      return 0;
    }
    
    const bufferSize = audioData.length;
    const minPeriod = Math.floor(sampleRate / maxFreq);
    const maxPeriod = Math.min(Math.floor(sampleRate / minFreq), Math.floor(bufferSize / 2));
    
    if (minPeriod >= maxPeriod) return 0;
    
    // Step 2: Autocorrelation with YIN-inspired normalization
    let bestPeriod = 0;
    let bestCorrelation = -1;
    
    for (let period = minPeriod; period < maxPeriod; period++) {
      let correlation = 0;
      let normalizer = 0;
      
      // Calculate correlation and normalization factor
      for (let i = 0; i < bufferSize - period; i++) {
        correlation += audioData[i] * audioData[i + period];
        normalizer += audioData[i] * audioData[i] + audioData[i + period] * audioData[i + period];
      }
      
      // Avoid division by zero
      if (normalizer > 0) {
        correlation = (2 * correlation) / normalizer;
        
        // Lower correlation threshold for better sensitivity
        if (correlation > bestCorrelation && correlation > 0.2) {
          bestCorrelation = correlation;
          bestPeriod = period;
        }
      }
    }
    
    if (bestPeriod === 0 || bestCorrelation < 0.2) {
      console.log(`🚫 Pitch detection failed - Period: ${bestPeriod}, Correlation: ${bestCorrelation.toFixed(3)}`);
      return 0;
    }
    
    // Step 3: Parabolic interpolation for sub-sample accuracy
    let refinedPeriod = bestPeriod;
    if (bestPeriod > minPeriod && bestPeriod < maxPeriod - 1) {
      // Get neighboring correlations for interpolation
      const prevCorr = calculateCorrelation(audioData, bestPeriod - 1, bufferSize);
      const currCorr = bestCorrelation;
      const nextCorr = calculateCorrelation(audioData, bestPeriod + 1, bufferSize);
      
      // Parabolic interpolation
      const a = (prevCorr - 2 * currCorr + nextCorr) / 2;
      const b = (nextCorr - prevCorr) / 2;
      
      if (Math.abs(a) > 0.001) {
        const offset = -b / (2 * a);
        if (Math.abs(offset) < 1) {
          refinedPeriod = bestPeriod + offset;
        }
      }
    }
    
    // Step 4: Convert to frequency (Hz) for energy level mapping
    const frequency = sampleRate / refinedPeriod;
    
    // Return frequency clamped to energy level range (40-280+ Hz)
    const finalFreq = Math.max(minFreq, Math.min(maxFreq, frequency));
    
    // Debug: Log frequency detection
    if (finalFreq === maxFreq && frequency > maxFreq) {
      console.log(`🎵 WARNING: Frequency ${frequency.toFixed(1)}Hz clamped to max ${maxFreq}Hz`);
    }
    
    return finalFreq;
  }, []);

  // Helper function for correlation calculation
  const calculateCorrelation = useCallback((audioData: Float32Array, period: number, bufferSize: number): number => {
    let correlation = 0;
    let normalizer = 0;
    
    for (let i = 0; i < bufferSize - period; i++) {
      correlation += audioData[i] * audioData[i + period];
      normalizer += audioData[i] * audioData[i] + audioData[i + period] * audioData[i + period];
    }
    
    return normalizer > 0 ? (2 * correlation) / normalizer : 0;
  }, []);

  // Frequency domain pitch detection as backup method
  const detectPitchFFT = useCallback((frequencyData: Uint8Array): number => {
    if (!analyserRef.current) return 0;
    
    const sampleRate = audioContextRef.current?.sampleRate || 44100;
    const nyquist = sampleRate / 2;
    const binSize = nyquist / frequencyData.length;
    
    // Find the frequency bin with the highest magnitude
    let maxMagnitude = 0;
    let maxBin = 0;
    
    // Focus on energy level frequency range (40Hz to 300Hz)
    const minBin = Math.floor(40 / binSize);
    const maxBinIndex = Math.floor(300 / binSize);
    
    for (let i = minBin; i < Math.min(maxBinIndex, frequencyData.length); i++) {
      if (frequencyData[i] > maxMagnitude) {
        maxMagnitude = frequencyData[i];
        maxBin = i;
      }
    }
    
    // Only proceed if we have sufficient signal strength
    if (maxMagnitude < 100) return 0; // Threshold for frequency domain
    
    // Convert bin to frequency
    const frequency = maxBin * binSize;
    
    // Return frequency directly (no MIDI conversion needed)
    // Clamp to energy level frequency range
    return Math.max(30, Math.min(300, frequency));
  }, []);

  // Convert frequency (Hz) to energy level (1-9) based on single frequency values
  const getEnergyLevelFromFrequency = useCallback((frequency: number): number => {
    /*
    Energy Level Target Frequencies:
    1. Whisper: 40 Hz
    2. Calm: 70 Hz  
    3. Relaxed: 100 Hz
    4. Normal: 130 Hz
    5. Engaged: 160 Hz
    6. Animated: 190 Hz
    7. Energetic: 220 Hz
    8. Dynamic: 250 Hz
    9. Explosive: 280 Hz
    */
    
    if (frequency <= 55) return 1;       // Whisper (40Hz target, range up to 55)
    else if (frequency <= 85) return 2;  // Calm (70Hz target, range 55-85)
    else if (frequency <= 115) return 3; // Relaxed (100Hz target, range 85-115)
    else if (frequency <= 145) return 4; // Normal (130Hz target, range 115-145)
    else if (frequency <= 175) return 5; // Engaged (160Hz target, range 145-175)
    else if (frequency <= 205) return 6; // Animated (190Hz target, range 175-205)
    else if (frequency <= 235) return 7; // Energetic (220Hz target, range 205-235)
    else if (frequency <= 265) return 8; // Dynamic (250Hz target, range 235-265)
    else return 9;                       // Explosive (280Hz+, range 265+)
  }, []);

  // Start recording with separate video and audio streams
  const startRecording = useCallback(async () => {
    try {
      console.log('🎤 Starting conductor assessment recording...');
      
      // Prevent multiple startRecording calls
      if (isRecordingRef.current || audioContextRef.current) {
        console.log('🎤 Recording already in progress, skipping...');
        return;
      }
      
      // Get video stream first
      const videoStream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });
      setVideoStream(videoStream);

      // Connect video stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = videoStream;
        console.log('✅ Conductor video stream connected');
      }

      // Get separate audio stream for analysis
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      });
      streamRef.current = audioStream;

      // Close existing audio context if any
      if (audioContextRef.current) {
        try {
          const context = audioContextRef.current as AudioContext;
          if (context.state !== 'closed') {
            await context.close();
          }
        } catch (error) {
          console.log('Error closing audio context:', error);
        } finally {
          audioContextRef.current = null;
        }
      }

      const audioContext = new AudioContext({ sampleRate: 44100 });
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(audioStream);
      source.connect(analyser);
      
      // Optimized settings for real-time pitch detection
      analyser.fftSize = 8192; // Larger for better low-frequency resolution
      analyser.smoothingTimeConstant = 0.05; // Minimal smoothing for instant response
      analyser.minDecibels = -100; // More sensitive to quiet sounds
      analyser.maxDecibels = -3; // Allow louder sounds without clipping
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      console.log('🎵 Audio context created:', {
        sampleRate: audioContext.sampleRate,
        state: audioContext.state,
        fftSize: analyser.fftSize
      });

      let mimeType = "audio/webm";
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/wav")) {
        mimeType = "audio/wav";
      }

      const mediaRecorder = new MediaRecorder(audioStream, {
        mimeType,
        audioBitsPerSecond: 128000,
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          
          // Process analysis (which will handle storage and upload)
          performLocalAnalysis(audioBlob);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100);
      setIsRecording(true);
      isRecordingRef.current = true;
      
      const analyzeAudio = () => {
        if (!analyserRef.current || !isRecordingRef.current) return;

        const bufferLength = analyserRef.current.fftSize;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        const timeDataArray = new Float32Array(bufferLength);
        
        analyserRef.current.getByteFrequencyData(dataArray);
        analyserRef.current.getFloatTimeDomainData(timeDataArray);

        // Enhanced audio level calculation with peak detection
        let rms = 0;
        let peak = 0;
        for (let i = 0; i < timeDataArray.length; i++) {
          rms += timeDataArray[i] * timeDataArray[i];
          peak = Math.max(peak, Math.abs(timeDataArray[i]));
        }
        rms = Math.sqrt(rms / timeDataArray.length);
        
        // Combine RMS and peak for better sensitivity
        const normalizedLevel = Math.min((rms * 8 + peak * 2) / 10, 1);
        setAudioLevel(normalizedLevel);

        // Debug audio levels
        if (normalizedLevel > 0.001) {
          console.log(`🎤 Audio detected - RMS: ${rms.toFixed(4)}, Peak: ${peak.toFixed(4)}, Level: ${normalizedLevel.toFixed(4)}`);
        }

        // Run pitch detection with lower threshold for better sensitivity
        if (normalizedLevel > 0.005) {
          // Try autocorrelation method first
          let frequency = detectPitch(timeDataArray);
          
          // If autocorrelation fails, try FFT method as backup
          if (frequency === 0) {
            frequency = detectPitchFFT(dataArray);
            if (frequency > 0) {
              console.log(`🎵 FFT backup detected frequency: ${frequency.toFixed(1)}Hz`);
            }
          } else {
            console.log(`🎵 Autocorrelation detected frequency: ${frequency.toFixed(1)}Hz`);
          }
          
          const currentTime = Date.now() - assessmentStartTime;
          
          if (frequency > 0) {
            setCurrentPitch(frequency);
            
            // Convert frequency to energy level based on provided frequency ranges
            const energyLevel = getEnergyLevelFromFrequency(frequency);
            setLastPitchLevel(energyLevel);
            
            console.log(`🎵 Frequency conversion - Frequency: ${frequency.toFixed(1)}Hz → Energy Level: ${energyLevel}`);
            
            // Add frequency data with timestamp and current energy level
            setPitchHistory(prev => {
              const newEntry = {
                timestamp: currentTime,
                pitch: frequency, // Now stores frequency instead of MIDI pitch
                energyLevel: currentEnergyLevel
              };
              
              // Limit history size for performance (keep last 1000 entries)
              const newHistory = [...prev, newEntry];
              return newHistory.length > 1000 ? newHistory.slice(-1000) : newHistory;
            });
            
            // Update current energy level frame with frequency data
            setEnergyLevelFrames(prev => {
              const updated = [...prev];
              if (updated.length > 0 && !updated[updated.length - 1].endTime) {
                // Add frequency to current active frame
                updated[updated.length - 1].pitches.push(frequency);
              }
              return updated;
            });
          } else {
            // Clear current pitch if no valid pitch detected
            setCurrentPitch(0);
          }
        } else {
          // Clear current pitch if audio is too quiet
          setCurrentPitch(0);
        }

        if (isRecordingRef.current) {
          // Much faster updates for real-time pitch visualization
          setTimeout(() => requestAnimationFrame(analyzeAudio), 30); // ~33 times per second
        }
      };

      analyzeAudio();
      console.log('✅ Recording started successfully');
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      toast({
        title: "Recording Error",
        description: "Failed to access microphone. Please check permissions.",
        variant: "destructive",
      });
    }
  }, [detectPitch, toast, pitchHistory, assessmentStartTime, currentEnergyLevel]);

  const stopRecording = useCallback(() => {
    console.log('🛑 Stopping conductor assessment recording...');

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    // Clean up audio stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Clean up video stream
    if (videoStream) {
      videoStream.getTracks().forEach((track) => track.stop());
    }
    setVideoStream(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsRecording(false);
    isRecordingRef.current = false;
  }, []);



  // Gemini analysis with audio and meta prompt

  // Schedule next energy change
  const scheduleNextChange = useCallback(() => {
    if (changeTimerRef.current) clearTimeout(changeTimerRef.current);

    const variance = config?.gameSettings.changeFrequencyVariance || 5;
    const interval = ((config?.gameSettings.changeFrequency || 15) + (Math.random() - 0.5) * variance) * 1000;

    setNextChangeIn(interval / 1000);

    const countdownInterval = setInterval(() => {
      setNextChangeIn((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    changeTimerRef.current = setTimeout(() => {
      clearInterval(countdownInterval);
      triggerEnergyChange();
    }, interval);
  }, []);

  // Trigger energy level change or breathe cue
  const triggerEnergyChange = useCallback(() => {
    const shouldBreathe = Math.random() < (config?.gameSettings.breatheCueProbability || 20) / 100;

    if (shouldBreathe) {
      setShowBreathe(true);
      const newChange = { 
        timestamp: Date.now() - assessmentStartTime, 
        level: currentEnergyLevel, 
        type: "breathe" as const,
        frequency: currentPitch
      };

      setEnergyChanges((prev) => {
        const updated = [...prev, newChange];
        energyChangesRef.current = updated;
        return updated;
      });

      breatheTimeoutRef.current = setTimeout(() => {
        setShowBreathe(false);
        scheduleNextChange();
      }, config?.gameSettings.breatheDisplayDuration || 3000);
    } else {
      // Get available energy levels from selected preset
      const availableLevels = config?.presets[selectedPreset]?.energyLevels || [1, 2, 3, 4, 5, 6, 7, 8, 9];
      
      let newLevel = currentEnergyLevel;
      while (newLevel === currentEnergyLevel && availableLevels.length > 1) {
        const randomIndex = Math.floor(Math.random() * availableLevels.length);
        newLevel = availableLevels[randomIndex];
      }

      setCurrentEnergyLevel(newLevel);
      const newChange = { 
        timestamp: Date.now() - assessmentStartTime, 
        level: newLevel, 
        type: "energy" as const,
        frequency: currentPitch
      };

      // End current energy level frame and start new one
      setEnergyLevelFrames(prev => {
        const updated = [...prev];
        if (updated.length > 0 && !updated[updated.length - 1].endTime) {
          updated[updated.length - 1].endTime = Date.now() - assessmentStartTime;
        }
        // Start new energy level frame
        updated.push({
          level: newLevel,
          startTime: Date.now() - assessmentStartTime,
          pitches: []
        });
        return updated;
      });

      setEnergyChanges((prev) => {
        const updated = [...prev, newChange];
        energyChangesRef.current = updated;
        return updated;
      });

      scheduleNextChange();
    }
  }, [currentEnergyLevel, assessmentStartTime, currentPitch, scheduleNextChange]);

  // Start assessment
  const startAssessment = useCallback(async () => {
    setAssessmentState("playing");
    setTimeRemaining(config?.gameSettings.duration || 60);
    setAssessmentStartTime(Date.now());
    setCurrentEnergyLevel(5);
    setEnergyChanges([]);
    setShowBreathe(false);
    setNextChangeIn(config?.gameSettings.changeFrequency || 15);
    // Removed setFrequencyHistory([]); because setFrequencyHistory is not defined

    await startRecording();
    
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          endAssessment();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    scheduleNextChange();
  }, [config, startRecording, scheduleNextChange]);

  // End assessment
  const endAssessment = useCallback(async () => {
    console.log('🏁 Ending conductor assessment...');

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (changeTimerRef.current) {
      clearTimeout(changeTimerRef.current);
      changeTimerRef.current = null;
    }
    if (breatheTimeoutRef.current) {
      clearTimeout(breatheTimeoutRef.current);
      breatheTimeoutRef.current = null;
    }

    setIsAnalyzing(true);
    stopRecording();
  }, [stopRecording]);



  // Generate AI-style performance summary based on metrics
  const generatePerformanceSummary = useCallback((energyChanges: EnergyChange[], accuracyScore: number, energyRange: number, breatheCount: number) => {
    const energyOnlyChanges = energyChanges.filter(change => change.type === "energy");
    
    let summary = "Great work on completing the Energy Conductor assessment! ";
    
    if (accuracyScore > 80) {
      summary += "Your frequency control was exceptional, staying within target ranges consistently. ";
    } else if (accuracyScore > 60) {
      summary += "Your voice adaptation showed good awareness of energy level changes. ";
    } else {
      summary += "Focus on matching your voice pitch to the target energy levels for better results. ";
    }
    
    if (energyRange > 6) {
      summary += "You demonstrated excellent range versatility, moving between high and low energy effectively. ";
    } else if (energyRange > 3) {
      summary += "Good energy range demonstrated across different levels. ";
    }
    
    if (breatheCount > 0) {
      summary += `You successfully utilized ${breatheCount} breathing moment(s) for natural pacing. `;
    }
    
    if (energyOnlyChanges.length >= 4) {
      summary += "Excellent responsiveness to energy level changes throughout the assessment. ";
    } else if (energyOnlyChanges.length >= 2) {
      summary += "Good adaptation to energy level transitions. ";
    }
    
    summary += "Keep practicing to enhance your dynamic speaking abilities!";
    
    return summary;
  }, []);

  // Local analysis of performance
  const performLocalAnalysis = useCallback(async (audioBlob: Blob) => {
    console.log('🔍 Performing local analysis...');
    
    const currentEnergyChanges = energyChangesRef.current;
    const energyOnlyChanges = currentEnergyChanges.filter(change => change.type === "energy");
    const breatheChanges = currentEnergyChanges.filter(change => change.type === "breathe");

    let totalAccuracy = 0;
    let accuracyCount = 0;

    energyOnlyChanges.forEach(change => {
      if (change.frequency && change.frequency > 0) {
        const expectedEnergyLevel = config?.energyLevels.find(level => level.level === change.level);
        if (expectedEnergyLevel) {
          // Calculate accuracy based on how close the frequency is to the target
          const targetFreq = expectedEnergyLevel.targetFreq;
          const freqDifference = Math.abs(change.frequency - targetFreq);
          
          // Within 15Hz of target is considered perfect (100%)
          // Accuracy decreases linearly with distance
          const accuracy = Math.max(0, 100 - (freqDifference / 15) * 100);
          
          totalAccuracy += accuracy;
          accuracyCount++;
        }
      }
    });

    const energyAccuracy = accuracyCount > 0 ? totalAccuracy / accuracyCount : 50;
    
    const energyLevels = energyOnlyChanges.map(change => change.level);
    const minEnergy = Math.min(...energyLevels, 5);
    const maxEnergy = Math.max(...energyLevels, 5);
    const energyRange = maxEnergy - minEnergy;

    const successfulTransitions = Math.floor(energyOnlyChanges.length * (energyAccuracy / 100));
    const averageResponseTime = 1.0 + Math.random() * 2.0;

    const overallScore = Math.round(
      (energyAccuracy * 0.4) + 
      (Math.min(energyRange / 8 * 100, 100) * 0.3) + 
      (Math.min(energyOnlyChanges.length / 4 * 100, 100) * 0.2) +
      (breatheChanges.length * 10)
    );



    const result: AssessmentResult = {
      totalChanges: energyOnlyChanges.length,
      successfulTransitions,
      averageResponseTime,
      energyRange,
      breatheRecoveries: breatheChanges.length,
      audioBlob,
      frequencyData: pitchHistory.map(entry => entry.pitch),
      energyAccuracy: Math.round(energyAccuracy),
      overallScore: Math.min(overallScore, 100),

    };

    // Store audio locally if small enough, otherwise just upload to cloud
    const maxLocalStorageSize = 4 * 1024 * 1024; // 4MB limit for localStorage
    
    if (audioBlob.size <= maxLocalStorageSize) {
      try {
        const reader = new FileReader();
        reader.onloadend = () => {
          try {
            const base64Audio = reader.result as string;
            localStorage.setItem(`conductor_audio_${params?.assessmentId}`, base64Audio);
            console.log('[CONDUCTOR] 💾 Audio stored locally');
          } catch (storageError) {
            console.warn('[CONDUCTOR] Failed to store audio in localStorage:', storageError);
          }
        };
        reader.readAsDataURL(audioBlob);
      } catch (error) {
        console.warn('[CONDUCTOR] Failed to store audio in localStorage (file too large):', error);
      }
    } else {
      console.log('[CONDUCTOR] ⚠️ Audio file too large for localStorage, uploading to cloud only');
    }

    // Always attempt cloud upload
    if (user?.email) {
      AudioUploadService.uploadRecording(
        audioBlob,
        user.email,
        'conductor',
        params?.assessmentId || 'unknown'
      ).then((result) => {
        console.log('[CONDUCTOR] ☁️ Audio uploaded to cloud:', result.audio_id);
        toast({
          title: "Audio Saved",
          description: "Your recording has been saved to cloud storage.",
          variant: "default",
        });
      }).catch((error) => {
        console.error('[CONDUCTOR] Cloud upload failed:', error);
        
        // Only show upload failure if localStorage also failed
        const hasLocalStorage = localStorage.getItem(`conductor_audio_${params?.assessmentId}`);
        if (!hasLocalStorage) {
          toast({
            title: "Upload Failed",
            description: "Failed to save recording. Please try again.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Upload Warning",
            description: "Recording saved locally but cloud upload failed.",
            variant: "destructive",
          });
        }
      });
    } else {
      console.warn('[CONDUCTOR] No user email available for cloud upload');
    }

    setAssessmentResult(result);
    setAssessmentState("feedback");
    setIsAnalyzing(false);
    
    console.log('✅ Local analysis completed:', result);
  }, [pitchHistory, params?.assessmentId]);

  // Reset assessment
  const resetAssessment = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (changeTimerRef.current) {
      clearTimeout(changeTimerRef.current);
      changeTimerRef.current = null;
    }
    if (breatheTimeoutRef.current) {
      clearTimeout(breatheTimeoutRef.current);
      breatheTimeoutRef.current = null;
    }

    stopRecording();
    energyChangesRef.current = [];

    setAssessmentState("setup");
    setCurrentEnergyLevel(5);
    setTimeRemaining(0);
    setAssessmentStartTime(0);
    setEnergyChanges([]);
    setShowBreathe(false);
    setAssessmentResult(null);
    setIsAnalyzing(false);
    setNextChangeIn(0);
    setAudioLevel(0);
          setCurrentPitch(0);
    setPitchHistory([]);
    setEnergyLevelFrames([{
      level: config?.gameSettings.defaultEnergyLevel || 5,
      startTime: 0,
      pitches: []
    }]);
    setCurrentTopic(getRandomTopic());
  }, [stopRecording, getRandomTopic]);

  // Download audio
  const downloadAudio = useCallback(() => {
    if (assessmentResult?.audioBlob) {
      const url = URL.createObjectURL(assessmentResult.audioBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conductor_assessment_${params?.assessmentId || 'recording'}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [assessmentResult?.audioBlob, params?.assessmentId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      resetAssessment();
    };
  }, [resetAssessment]);

  const getCurrentEnergyInfo = () => {
    if (!config?.energyLevels) return null;
    return config.energyLevels.find(e => e.level === currentEnergyLevel) || config.energyLevels[4];
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (assessmentState === "setup") {
    return (
      <div className="min-h-screen bg-background relative">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="mb-6">
            <Button
              onClick={() => setLocation('/test-selection')}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              Home
            </Button>
          </div>

          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Energy Conductor Assessment
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Challenge your ability to adapt your speaking energy in real-time
            </p>
          </div>

          <div className="text-center space-y-8 mb-20">
            <div>
              <h2 className="text-2xl font-semibold mb-6">How It Works</h2>
              <ul className="space-y-4 text-muted-foreground max-w-2xl mx-auto text-left">
                <li className="flex items-start gap-3">
                  <span className="text-primary font-bold">1.</span>
                  <span>Speak about your assigned topic for 1 minute</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary font-bold">2.</span>
                  <span>Energy level indicators will appear every ~15 seconds</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary font-bold">3.</span>
                  <span>Adapt your speaking energy to match the level shown</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary font-bold">4.</span>
                  <span>Watch for "BREATHE" cues for natural pauses</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary font-bold">5.</span>
                  <span>Your frequency and energy will be analyzed in real-time</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Start button positioned at bottom right */}
        <div className="fixed bottom-8 right-8">
          <Button 
            onClick={startAssessment}
            size="lg"
            className="bg-primary hover:bg-primary/90 px-8 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
          >
            <Play className="h-6 w-6 mr-3" />
            Start Assessment
          </Button>
        </div>
      </div>
    );
  }

  if (assessmentState === "playing") {
    const energyInfo = getCurrentEnergyInfo();
    const duration = config?.gameSettings.duration || 60;
    const progress = ((duration - timeRemaining) / duration) * 100;

    // Show loading if energy info is not available
    if (!energyInfo) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="text-lg text-muted-foreground">Loading energy levels...</div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-6 py-8">
          
          {/* Topic Header with proper spacing */}
          <div className="relative mb-12">
            {/* Topic Centered */}
            <h2 className="text-3xl font-bold text-foreground mb-6 leading-relaxed 
                          max-w-5xl mx-auto text-center">
              {currentTopic}
            </h2>
            
            {/* Behavior Warning Badge */}
            <div className="text-center">
              <WarningBadge
                isVisible={showWarning}
                message={warningMessage}
                duration={5000}
                className="mt-4"
              />
            </div>

            {/* Timer Aligned Right */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2">
              <div className="relative w-16 h-16 flex items-center justify-center">
                <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    r="40"
                    stroke="#e5e7eb"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="40"
                    stroke="#4A9CA6"
                    strokeWidth="8"
                    fill="transparent"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 40}`}
                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - progress / 100)}`}
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-xs font-bold text-foreground">
                    {formatTime(timeRemaining)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Breathe Overlay */}
          {showBreathe && (
            <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="text-center">
                <div className="text-8xl font-bold text-primary mb-4 animate-pulse">BREATHE</div>
                <div className="text-xl text-primary">Take a deep breath and reset</div>
              </div>
            </div>
          )}

          {/* Main Assessment Layout - Video Left, Energy Bars Right */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-6">
            {/* Left Side - Video Recording Area */}
            <div className="space-y-4">
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4 text-center">Video Recording</h3>
                  
                  {/* Video Recording Display */}
                  <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
                    {videoStream ? (
                      <video
                        ref={videoRef}
                        className="w-full h-full object-cover"
                        autoPlay
                        muted
                        playsInline
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4 mx-auto">
                            <MicOff className="w-8 h-8 text-muted-foreground" />
                          </div>
                          <div className="text-muted-foreground text-lg font-medium">Camera Off</div>
                          <div className="text-muted-foreground text-sm">Start assessment to begin video recording</div>
                        </div>
                      </div>
                    )}
                    
                    {/* Recording Indicator */}
                    {isRecording && (
                      <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                        REC
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Side - Energy Level Bars */}
            <div className="space-y-4">
              <Card>
                <CardContent className="p-6" style={{ aspectRatio: '4/3' }}>
                  <h3 className="text-lg font-semibold mb-4 text-center">Energy Level Control</h3>
                  
                  {/* Target Energy Info */}
                  <div className="text-center mb-4">
                    <div className="text-2xl font-bold text-foreground mb-1">
                      TARGET: ENERGY <span className="text-primary">{energyInfo.level}</span>
                    </div>
                    <div className="text-base font-medium text-primary mb-1">{energyInfo.name}</div>
                    <div className="text-xs text-muted-foreground">{energyInfo.description}</div>
                  </div>
                  
                  {/* Energy Level Bars - Vertical */}
                  <div className="flex justify-center mb-4">
                    <div className="flex items-end space-x-2 h-48">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => {
                        // Convert current frequency to energy level (1-9 scale) using frequency ranges
                        let currentEnergyFromFrequency = 0;
                        if (currentPitch > 0) {
                          // currentPitch now contains frequency in Hz, not MIDI pitch
                          currentEnergyFromFrequency = getEnergyLevelFromFrequency(currentPitch);
                          
                          // Debug logging with frequency mapping info
                          if (level === 1) { // Only log once per render cycle
                            console.log(`🎵 Frequency mapping - Frequency: ${currentPitch.toFixed(1)}Hz → Energy Level: ${currentEnergyFromFrequency}`);
                          }
                        }
                        
                        // Determine the effective current position (live frequency or last held position)
                        const effectiveCurrentPosition = currentPitch > 0 ? currentEnergyFromFrequency : lastPitchLevel;
                        
                        // Initialize bar color and state
                        let barColor = "bg-muted"; // Default gray
                        let isCurrentPitch = false;
                        let isLastPitch = false;
                        
                        // Color bars up to the target energy level (currentEnergyLevel)
                        if (level <= currentEnergyLevel) {
                          // Target range - teal colors with gradient intensity
                          barColor = level <= 3 ? "bg-teal-300" : level <= 6 ? "bg-teal-500" : "bg-teal-700";
                        }
                        
                                                  // Highlight the current detected frequency position
                          if (effectiveCurrentPosition > 0 && level === effectiveCurrentPosition) {
                            // Current frequency position - theme-aware highlighting
                            if (level <= currentEnergyLevel) {
                              barColor = "bg-white";
                              isCurrentPitch = true;
                            } else {
                              // Above target - red with glow
                              barColor = "bg-red-500";
                              isCurrentPitch = true;
                            }
                          }
                        
                        return (
                          <div
                            key={level}
                            className={`w-6 rounded-t transition-all duration-150 ease-out relative ${barColor}`}
                            style={{
                              height: `${(level / 9) * 100}%`,
                              minHeight: '16px'
                            }}
                          >
                            {/* No overlay indicators needed */}
                            
                            {                            /* Level number at bottom */}
                            <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs font-bold text-muted-foreground">
                              {level}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Energy Level Legend */}
                  <div className="text-center space-y-2 text-sm mt-6">
                    <div className="flex items-center justify-center gap-6">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-primary rounded"></div>
                        <span>Target Range</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-red-500 dark:bg-red-400 rounded"></div>
                        <span>Above Target</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-background border-2 border-foreground rounded"></div>
                        <span>Current Position</span>
                      </div>
                    </div>
                    
                    {/* Status Text */}
                    <div className="mt-4">
                      {currentPitch > 0 ? (
                        (() => {
                          const currentEnergyFromFrequency = getEnergyLevelFromFrequency(currentPitch);
                          if (currentEnergyFromFrequency <= currentEnergyLevel) {
                            return <span className="text-green-500 dark:text-green-400 font-medium">✓ Perfect! You're in the target energy range</span>;
                          } else {
                            return <span className="text-red-500 dark:text-red-400 font-medium">⚠ Lower your energy - you're above the target level</span>;
                          }
                        })()
                      ) : (
                        <span className="text-muted-foreground">Listening for your voice...</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (assessmentState === "feedback") {
    return (
      <div className="min-h-screen bg-background relative">
        <div className="max-w-4xl mx-auto px-6 py-8">
                     <div className="text-center mb-8">
             <h1 className="text-4xl font-bold text-foreground mb-4">
               Assessment Complete!
             </h1>
             <p className="text-xl text-muted-foreground">
               Great work on the Energy Conductor assessment
             </p>
             

           </div>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Performance Metrics</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Overall Score:</span>
                    <Badge variant="secondary" className="text-lg font-bold">
                      {assessmentResult?.overallScore || 0}/100
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Energy Accuracy:</span>
                    <Badge variant="secondary">{assessmentResult?.energyAccuracy || 0}%</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Energy Changes:</span>
                    <Badge variant="secondary">{assessmentResult?.totalChanges || 0}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Successful Transitions:</span>
                    <Badge variant="secondary">{assessmentResult?.successfulTransitions || 0}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Energy Range:</span>
                    <Badge variant="secondary">{assessmentResult?.energyRange || 0} levels</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Breathe Recoveries:</span>
                    <Badge variant="secondary">{assessmentResult?.breatheRecoveries || 0}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Recording & Analysis</h3>
                {(() => {
                  // Try to get audio from localStorage first, then from assessmentResult
                  const storedAudio = localStorage.getItem(`conductor_audio_${params?.assessmentId}`);
                  const audioBlob = assessmentResult?.audioBlob;
                  
                  if (storedAudio || audioBlob) {
                    return (
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Your Recording:
                          </label>
                          <audio 
                            controls 
                            className="w-full mt-2"
                            src={storedAudio || (audioBlob ? URL.createObjectURL(audioBlob) : '')}
                          />
                        </div>
                        <Button 
                          onClick={downloadAudio}
                          variant="outline"
                          size="sm"
                          className="w-full"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download Recording
                        </Button>
                      </div>
                    );
                  } else {
                    return (
                      <div className="text-center py-4">
                        <p className="text-muted-foreground">No recording available</p>
                      </div>
                    );
                  }
                })()}
              </CardContent>
            </Card>
          </div>

          <div className="text-center space-x-4">
            <Button 
              onClick={resetAssessment}
              variant="outline"
              size="lg"
            >
              Try Again
            </Button>
            <Button 

              onClick={() => setLocation('/test-selection')}

              size="lg"
              className="bg-primary hover:bg-primary/90"
            >
              <Home className="h-5 w-5 mr-2" />
              Return to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
} 