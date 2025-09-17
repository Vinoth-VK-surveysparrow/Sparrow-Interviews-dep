import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Home, Mic, MicOff, Play } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useBehaviorMonitoring } from '@/hooks/useBehaviorMonitoring';
import { WarningBadge } from '@/components/WarningBadge';
import { useClarity } from '@/hooks/useClarity';
import { S3Service } from '@/lib/s3Service';
import { useS3Upload } from '@/hooks/useS3Upload';
import { useCameraCapture } from '@/hooks/useCameraCapture';
import { useAssessment } from '@/contexts/AssessmentContext';

// Enhanced Circular Timer component that serves as Next button
const CircularTimer = memo(({
  timeLeft,
  totalTime,
  isActive,
  onClick,
  isFinishing,
  isLastQuestion,
  isUploading
}: {
  timeLeft: number;
  totalTime: number;
  isActive: boolean;
  onClick: () => void;
  isFinishing: boolean;
  isLastQuestion: boolean;
  isUploading: boolean;
}) => {
  const percentage = ((totalTime - timeLeft) / totalTime) * 100;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div
      className={`relative w-32 h-32 flex items-center justify-center ${
        isFinishing
          ? 'cursor-not-allowed opacity-75'
          : 'cursor-pointer group'
      }`}
      onClick={isFinishing ? undefined : onClick}
    >
      <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
        {/* Background circle - light gray */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          stroke="#e5e7eb"
          strokeWidth="8"
          fill={isFinishing ? "#4A9CA6" : "#f8fafc"}
          className={isFinishing ? '' : 'group-hover:fill-[#4A9CA6] transition-colors duration-200'}
        />
        {/* Progress circle - teal color #4A9CA6 */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          stroke="#4A9CA6"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          {/* Show finishing state when finishing, otherwise show timer */}
          {isFinishing ? (
            <div className="flex flex-col items-center">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mb-1"></div>
              <span className="text-xs text-white">Finishing...</span>
            </div>
          ) : (
            <>
              <div className="text-lg font-bold text-gray-800 group-hover:text-white transition-colors duration-200 group-hover:hidden">
                {minutes}:{seconds.toString().padStart(2, '0')}
              </div>
              <div className="hidden group-hover:block text-sm font-bold text-white">
                <div className="flex flex-col items-center">
                  <span className="text-sm">{isLastQuestion ? 'Finish' : 'Next'}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
});


interface EnergyChange {
  timestamp: number;
  level: number;
  type: "energy" | "breathe";
  frequency?: number;
}


type AssessmentState = "setup" | "playing";

// Configuration state that will be loaded from API
interface ConductorConfig {
  gameSettings: {
    changeFrequency: number;
    defaultEnergyLevel: number;
    breatheCueProbability: number;
    breatheDisplayDuration: number;
    changeFrequencyVariance: number;
    recordingChunkInterval: number;
  };
  presets: {
    standard: { name: string; description: string; energyLevels: number[] };
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
  
  // Microsoft Clarity tracking
  const { trackAssessmentEvent, trackUserAction, setUserId, setTag } = useClarity(true, 'Conductor Assessment');
  
  // Behavior monitoring hook
  const { isMonitoring, stopMonitoring, flagCount, showWarning, warningMessage } = useBehaviorMonitoring({
    enabled: true,
    delayBeforeStart: 15000, // Start monitoring after 15 seconds (when first image is captured)
    pollingInterval: 10000, // Check every 10 seconds
  });

  const [assessmentState, setAssessmentState] = useState<AssessmentState>("setup");
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [config, setConfig] = useState<ConductorConfig | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<'standard'>('standard');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentTopic, setCurrentTopic] = useState("");
  const [currentEnergyLevel, setCurrentEnergyLevel] = useState(5);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [assessmentTimeLimit, setAssessmentTimeLimit] = useState(60); // Store time limit from backend
  const [numberOfQuestions, setNumberOfQuestions] = useState(0); // Store number of questions from backend
  const [assessmentStartTime, setAssessmentStartTime] = useState(0);
  const [energyChanges, setEnergyChanges] = useState<EnergyChange[]>([]);
  const [showBreathe, setShowBreathe] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [s3Config, setS3Config] = useState<any>(null);
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

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const changeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const breatheTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const energyChangesRef = useRef<EnergyChange[]>([]);
  const isRecordingRef = useRef<boolean>(false);

  const { initiateAssessment, uploadAudio } = useS3Upload();
  
  // Assessment context for S3 operations and session management
  const {
    session,
    finishAssessment,
    startSession,
    isS3Ready,
    uploadAudioToS3,
    startQuestionLog,
    endQuestionLog
  } = useAssessment();

  // Camera and image capture
  const { videoRef: assessmentVideoRef, startCamera, startAutoCapture, stopAutoCapture, capturedImages } = useCameraCapture();

  // Load conductor configuration from fetch-questions API
  const loadConfig = useCallback(async () => {
    try {
      setIsLoadingConfig(true);
      console.log('🎮 Loading conductor configuration via fetch-questions...');

      // Get assessment data from localStorage or route params
      const selectedTestId = localStorage.getItem('selectedTestId');
      if (!selectedTestId || !params?.assessmentId || !user?.email) {
        throw new Error('Missing required parameters for config fetch');
      }

      // Use fetchQuestions from authenticatedApiService
      const { AuthenticatedApiService } = await import('@/lib/authenticatedApiService');
      const requestPayload = {
        assessment_id: params.assessmentId,
        user_email: user.email,
        type: 'conductor'
      };

      console.log('📤 Fetching conductor config with payload:', requestPayload);

      const response = await AuthenticatedApiService.fetchQuestions(requestPayload);

      if (response.status !== 'success' || !response.content) {
        throw new Error('Invalid response from fetch-questions API');
      }

      const configData: ConductorConfig = response.content;
      console.log('✅ Conductor config loaded from API:', configData);
      setConfig(configData);

      // Select multiple topics based on number of questions from backend (default to 3 if not loaded yet)
      if (configData.topics && configData.topics.length > 0) {
        const shuffledTopics = [...configData.topics].sort(() => Math.random() - 0.5);
        const questionsCount = numberOfQuestions > 0 ? numberOfQuestions : 3; // Default to 3 questions
        const selectedCount = Math.min(questionsCount, shuffledTopics.length);
        const selectedTopicList = shuffledTopics.slice(0, selectedCount);
        setSelectedTopics(selectedTopicList);

        // Set first topic as current
        if (selectedTopicList.length > 0) {
          setCurrentTopic(selectedTopicList[0]);
        }

        console.log(`📝 Selected ${selectedTopicList.length} topics for ${questionsCount} questions:`, selectedTopicList);
      }

      // Set default energy level from config
      if (configData.gameSettings?.defaultEnergyLevel) {
        setCurrentEnergyLevel(configData.gameSettings.defaultEnergyLevel);
      }

      // Duration is set from backend assessment data (test-available endpoint)

      setIsLoadingConfig(false);
    } catch (error) {
      console.error('❌ Failed to load conductor config:', error);
      setIsLoadingConfig(false);
      toast({
        title: "Configuration Error",
        description: "Failed to load conductor assessment configuration. Please try again.",
        variant: "destructive",
      });
    }
  }, [toast, params?.assessmentId, user?.email]);

  // Load config when we have the necessary data
  useEffect(() => {
    if (params?.assessmentId && user?.email) {
      loadConfig();
    }
  }, [loadConfig, params?.assessmentId, user?.email]);

  // Update selected topics when numberOfQuestions changes (after backend fetch)
  useEffect(() => {
    if (config && numberOfQuestions > 0 && config.topics && config.topics.length > 0) {
      const shuffledTopics = [...config.topics].sort(() => Math.random() - 0.5);
      const selectedCount = Math.min(numberOfQuestions, shuffledTopics.length);
      const selectedTopicList = shuffledTopics.slice(0, selectedCount);
      setSelectedTopics(selectedTopicList);

      // Set first topic as current
      if (selectedTopicList.length > 0) {
        setCurrentTopic(selectedTopicList[0]);
      }

      console.log(`📝 Updated topics based on backend: ${selectedTopicList.length} topics for ${numberOfQuestions} questions:`, selectedTopicList);
    }
  }, [config, numberOfQuestions]);

  // Fetch assessment time limit from backend
  useEffect(() => {
    const fetchAssessmentTimeLimit = async () => {
      if (!params?.assessmentId) return;

      try {
        const selectedTestId = localStorage.getItem('selectedTestId');
        if (!selectedTestId) {
          console.error('❌ No test selected');
          return;
        }

        console.log('🔍 ConductorAssessment: Fetching test assessments with Firebase auth');
        
        const { AuthenticatedApiService } = await import('@/lib/authenticatedApiService');
        const testData = await AuthenticatedApiService.getTestAssessments(selectedTestId);
        const testAssessments = testData.assessments || [];
        const assessmentInTest = testAssessments.find((a: any) => a.assessment_id === params.assessmentId);
        
        if (assessmentInTest) {
          // Set time limit from backend
          if (assessmentInTest.time_limit) {
            const timeLimitFromBackend = assessmentInTest.time_limit;
            setAssessmentTimeLimit(timeLimitFromBackend);
            setTimeRemaining(timeLimitFromBackend);

            console.log(`⏱️ Using time limit from backend: ${timeLimitFromBackend} seconds for Conductor assessment`);
          }

          // Set number of questions from backend
          if (assessmentInTest.no_of_ques) {
            const questionsCount = Math.floor(assessmentInTest.no_of_ques);
            setNumberOfQuestions(questionsCount);

            console.log(`📊 Using number of questions from backend: ${questionsCount} for Conductor assessment`);
            console.log(`⏱️ Each question gets full time limit: ${assessmentInTest.time_limit} seconds`);
          }
        }
      } catch (error) {
        console.error('❌ Failed to fetch assessment time limit:', error);
        // Keep default values if fetch fails
      }
    };

    fetchAssessmentTimeLimit();
  }, [params?.assessmentId]);

  // Initialize assessment session
  useEffect(() => {
    const initializeAssessmentSession = async () => {
      if (!params?.assessmentId || !user?.email) return;

      try {
        setIsLoadingSession(true);
        console.log('🔄 Initializing assessment session for conductor assessment');
        await startSession(params.assessmentId);
        console.log('✅ Assessment session initialized');
        setIsLoadingSession(false);
      } catch (error) {
        console.error('❌ Failed to initialize assessment session:', error);
        setIsLoadingSession(false);
        
        // Don't show toast for assessment already completed - this is expected behavior
        if (error instanceof Error && error.message === 'ASSESSMENT_ALREADY_COMPLETED') {
          console.log('🔄 Assessment already completed, no toast needed');
          return;
        }
        
        toast({
          title: "Session Error",
          description: "Failed to initialize assessment session. Please try again.",
          variant: "destructive",
        });
      }
    };

    initializeAssessmentSession();
  }, [params?.assessmentId, user?.email, startSession, toast]);

  // Start auto-capture when S3 is ready
  useEffect(() => {
    if (isS3Ready && assessmentState === "playing") {
      console.log('📸 Starting auto image capture for conductor assessment');
      startAutoCapture();
    }
  }, [isS3Ready, assessmentState, startAutoCapture]);



  // Handle video stream connection for assessment camera
  useEffect(() => {
    if (videoStream && assessmentVideoRef.current) {
      console.log('🎥 Connecting Conductor video stream to assessment element');
      assessmentVideoRef.current.srcObject = videoStream;
    }
  }, [videoStream, assessmentVideoRef]);

  // No fallback topics - config must be loaded from API

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
      if (assessmentVideoRef.current) {
        assessmentVideoRef.current.srcObject = videoStream;
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
          console.log('🎵 Recording stopped, audio blob ready:', audioBlob.size, 'bytes');
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
    if (assessmentVideoRef.current) {
      assessmentVideoRef.current.srcObject = null;
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

  // Move to next question
  const moveToNextQuestion = useCallback(() => {
    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex < selectedTopics.length) {
      setCurrentQuestionIndex(nextIndex);
      setCurrentTopic(selectedTopics[nextIndex]);
      setCurrentEnergyLevel(5); // Reset to default energy level
      setEnergyChanges([]); // Reset energy changes for new question
      setShowBreathe(false);

      console.log(`➡️ Moving to question ${nextIndex + 1}/${selectedTopics.length}: ${selectedTopics[nextIndex]}`);
    }
  }, [currentQuestionIndex, selectedTopics]);

  // Start assessment
  const startAssessment = useCallback(async () => {
    setAssessmentState("playing");
    setTimeRemaining(assessmentTimeLimit); // Each question gets full time limit
    setAssessmentStartTime(Date.now());
    setCurrentEnergyLevel(5);
    setEnergyChanges([]);
    setShowBreathe(false);
    setNextChangeIn(config?.gameSettings.changeFrequency || 15);

    // Start camera for video display and image capture
    startCamera();
    
    // Start logging for the first question
    if (selectedTopics.length > 0) {
      startQuestionLog(selectedTopics[0], selectedTopics[0], 0);
    }

    await startRecording();
    
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Move to next question or end assessment
          if (currentQuestionIndex < selectedTopics.length - 1) {
            moveToNextQuestion();
            return assessmentTimeLimit; // Reset to full time limit for next question
          } else {
            endAssessment();
            return 0;
          }
        }
        return prev - 1;
      });
    }, 1000);

    scheduleNextChange();
  }, [config, startRecording, scheduleNextChange, assessmentTimeLimit, currentQuestionIndex, selectedTopics, startCamera, startQuestionLog]);

  // Audio verification with retry mechanism
  const verifyAudioWithRetry = async (maxRetries: number = 5, delayMs: number = 2000): Promise<boolean> => {
    if (!user?.email || !params?.assessmentId) {
      console.error('❌ Missing user email or assessment ID for audio verification');
      return false;
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const verification = await S3Service.verifyAudio({
          user_email: user.email,
          assessment_id: params.assessmentId
        });

        if (verification.data.presence) {
          return true;
        } else {
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        }
      } catch (error) {
        console.error(`❌ Audio verification failed on attempt ${attempt}:`, error);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    console.error(`❌ Audio verification failed after ${maxRetries} attempts`);
    return false;
  };

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
    
    try {
      // Stop all recording activities
      stopAutoCapture();
      
      // Stop camera/video stream
      if (videoStream) {
        console.log('📹 Stopping video stream...');
        videoStream.getTracks().forEach((track) => {
          track.stop();
          console.log(`🔴 Stopped ${track.kind} track`);
        });
        setVideoStream(null);
        
        // Clear video element
        if (assessmentVideoRef.current) {
          assessmentVideoRef.current.srcObject = null;
        }
      }
      
      // Stop recording and get audio blob
      const finalAudio = await new Promise<Blob | null>((resolve) => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          mediaRecorderRef.current.onstop = () => {
            if (audioChunksRef.current.length > 0) {
              const mimeType = "audio/webm";
              const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
              resolve(audioBlob);
            } else {
              resolve(null);
            }
          };
          mediaRecorderRef.current.stop();
        } else {
          resolve(null);
        }
      });

      stopRecording();

      if (finalAudio && isS3Ready) {
        console.log('🎵 Uploading audio to S3...');
        setIsUploading(true);

        try {
          // Upload audio using assessment context
          await uploadAudioToS3(finalAudio);
          console.log('✅ Audio uploaded successfully');

          // Verify audio was uploaded
          const audioVerified = await verifyAudioWithRetry();
          
          if (audioVerified) {
            console.log('✅ Audio verification successful');
            // Send logs after successful audio verification
            await finishAssessment();
            
            toast({
              title: "Assessment Complete",
              description: "Your assessment has been submitted successfully.",
              variant: "default",
            });
          } else {
            console.warn('⚠️ Audio verification failed but continuing...');
            // Continue with logs even if audio verification fails
            await finishAssessment();
          }

        } catch (uploadError) {
          console.error('❌ Audio upload failed:', uploadError);
          // Still try to send logs even if audio upload fails
          await finishAssessment();
          
          toast({
            title: "Upload Warning",
            description: "Audio upload failed, but assessment will continue.",
            variant: "destructive",
          });
        } finally {
          setIsUploading(false);
        }
      } else {
        console.warn('⚠️ S3 not ready or no audio, skipping audio upload');
        // Send logs even without audio upload
        await finishAssessment();
      }

      // Redirect to results page like other assessments
      setTimeout(() => {
        setLocation(`/results/${params?.assessmentId}`);
      }, 1000);

    } catch (error) {
      console.error('❌ Error in endAssessment:', error);
      setIsAnalyzing(false);
      // Redirect to results page even on error
      setTimeout(() => {
        setLocation(`/results/${params?.assessmentId}`);
      }, 1000);
    }
  }, [stopRecording, stopAutoCapture, isS3Ready, uploadAudioToS3, verifyAudioWithRetry, finishAssessment, user?.email, params?.assessmentId, toast]);



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


  // Cleanup on unmount
  useEffect(() => {
    return () => {
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
      stopAutoCapture();
    };
  }, [stopRecording, stopAutoCapture]);

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
        <div className="fixed bottom-8 right-8 text-center">
          <Button 
            onClick={startAssessment}
            disabled={isLoadingConfig || isLoadingSession}
            size="lg"
            className="bg-primary hover:bg-primary/90 px-8 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoadingConfig || isLoadingSession ? (
              <>
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                Loading...
              </>
            ) : (
              <>
                <Play className="h-6 w-6 mr-3" />
                Start Assessment
              </>
            )}
          </Button>
          {(isLoadingConfig || isLoadingSession) && (
            <div className="mt-2 text-sm text-muted-foreground">
              {isLoadingConfig && isLoadingSession ? 'Preparing assessment...' :
               isLoadingConfig ? 'Loading configuration...' :
               'Initializing session...'}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (assessmentState === "playing") {
    const energyInfo = getCurrentEnergyInfo();
    const duration = assessmentTimeLimit;
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
            <div className="text-center mb-4">
              <div className="text-lg text-muted-foreground mb-2">
                Question {currentQuestionIndex + 1} of {selectedTopics.length}
              </div>
            </div>
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

            {/* Enhanced Timer as Next Button */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2">
              <CircularTimer
                timeLeft={timeRemaining}
                totalTime={assessmentTimeLimit}
                isActive={assessmentState === "playing"}
                onClick={() => {
                  if (currentQuestionIndex < selectedTopics.length - 1) {
                    moveToNextQuestion();
                  } else {
                    endAssessment();
                  }
                }}
                 isFinishing={isUploading}
                 isLastQuestion={currentQuestionIndex >= selectedTopics.length - 1}
                 isUploading={isUploading}
              />
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
            {/* Left Side - Video Display Area */}
            <div className="space-y-4">
              {/* Video Display */}
                  <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
                    {videoStream ? (
                      <video
                        ref={assessmentVideoRef}
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
                          <div className="text-muted-foreground text-sm">Start assessment to begin recording</div>
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



  return null;
} 