import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Home, Target, Clock, CheckCircle, XCircle, RotateCcw, Play, Zap, Mic, MicOff, RefreshCw, Volume2, Download } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useAudioRecording } from '@/hooks/useAudioRecording';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { AudioUploadService } from '@/lib/audioUploadService';
import { S3Service, TripleStepContent } from '@/lib/s3Service';
import TripleStepRules from '@/components/TripleStepRules';

// Enhanced Circular Timer component for assessments
const CircularTimer = memo(({ 
  timeLeft, 
  isActive, 
  onClick, 
  isFinishing, 
  label = "Time",
  totalTime = 180
}: { 
  timeLeft: number; 
  isActive: boolean; 
  onClick?: () => void; 
  isFinishing?: boolean;
  label?: string;
  totalTime?: number;
}) => {
  const percentage = ((totalTime - timeLeft) / totalTime) * 100;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  return (
    <div 
      className={`relative w-32 h-32 flex items-center justify-center ${onClick ? 'cursor-pointer group transition-all duration-300 hover:scale-105' : ''}`}
      onClick={onClick}
    >
      <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
        {/* Background circle - light gray */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          stroke="#e5e7eb"
          strokeWidth="8"
          fill="#f8fafc"
          className={onClick ? "group-hover:fill-[#4A9CA6] transition-all duration-300" : ""}
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
          <div className={`text-lg font-bold text-foreground ${onClick ? 'group-hover:text-white transition-colors duration-300 group-hover:hidden' : ''}`}>
            {minutes}:{seconds.toString().padStart(2, '0')}
          </div>
          {onClick && (
            <div className="hidden group-hover:block text-sm font-bold text-white">
              {isFinishing ? (
                <div className="flex flex-col items-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mb-1"></div>
                  <span className="text-xs">Finishing...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <span className="text-sm">{label}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

interface GameSettings {
  mainTopic: string;
  wordTypes: string[];
  totalWords: number;
  dropFrequency: number;
  integrationTime: number;
  difficulty: "beginner" | "intermediate" | "advanced" | "expert";
}

interface WordDrop {
  word: string;
  timestamp: number;
  integrated: boolean;
  integrationTime?: number;
  timeRemaining: number;
}

interface GameResult {
  totalWords: number;
  integratedWords: number;
  averageIntegrationTime: number;
  topicCoherence: number;
  missedWords: string[];
  smoothIntegrations: number;
  aiScore?: {
    confidence_score: number;
    specific_feedback: string;
    next_steps?: string[];
    integration_rate?: number;
    average_integration_time?: number;
    missed_words?: string[];
    topic_coherence?: number;
    speaking_clarity?: number;
    adaptability?: number;
  };
}

type GameState = "rules" | "playing";

const DIFFICULTY_PRESETS: Record<string, Omit<GameSettings, "mainTopic" | "wordTypes">> = {
  beginner: { totalWords: 4, dropFrequency: 40, integrationTime: 8, difficulty: "beginner" },
  intermediate: { totalWords: 6, dropFrequency: 30, integrationTime: 6, difficulty: "intermediate" },
  advanced: { totalWords: 8, dropFrequency: 20, integrationTime: 5, difficulty: "advanced" },
  expert: { totalWords: 10, dropFrequency: 15, integrationTime: 4, difficulty: "expert" },
};

export default function TripleStepAssessment() {
  const [, params] = useRoute('/triple-step/:assessmentId');
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Audio recording hook
  const { isRecording, startRecording, stopRecording, forceCleanup } = useAudioRecording();
  
  // Speech recognition hook
  const { 
    transcript, 
    isListening, 
    startListening, 
    stopListening, 
    resetTranscript,
    hasSupport: hasSpeechSupport,
  } = useSpeechRecognition();

  const [gameState, setGameState] = useState<GameState>("rules");
  const [settings, setSettings] = useState<GameSettings>({
    ...DIFFICULTY_PRESETS.intermediate,
    mainTopic: "",
    wordTypes: [],
  });
  const [activeWords, setActiveWords] = useState<WordDrop[]>([]);
  const [completedWords, setCompletedWords] = useState<WordDrop[]>([]);
  const [timeRemaining, setTimeRemaining] = useState(0);

  const [wordsDropped, setWordsDropped] = useState(0);
  const [gameStartTime, setGameStartTime] = useState(0);
  const [currentDuration, setCurrentDuration] = useState(0);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);

  // Auto-scroll transcript when new content appears
  useEffect(() => {
    if (transcriptRef.current && transcript) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript]);
  
  // Content fetched from S3
  const [tripleStepContent, setTripleStepContent] = useState<TripleStepContent | null>(null);
  const [availableWords, setAvailableWords] = useState<string[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  
  // Live transcript with detected words
  const [detectedWords, setDetectedWords] = useState<Set<string>>(new Set());
  
  // Assessment data from DynamoDB
  const [assessmentData, setAssessmentData] = useState<{
    assessmentId: string;
    assessmentName: string;
    description: string;
    order: number;
    timeLimit: number;
    type: string;
  } | null>(null);
  const [loadingAssessmentData, setLoadingAssessmentData] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const wordDropIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const wordIntegrationTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  const gameDataRef = useRef<{
    activeWords: WordDrop[];
    completedWords: WordDrop[];
    mainTopic: string;
  }>({
    activeWords: [],
    completedWords: [],
    mainTopic: "",
  });

  // Ref to store endGame function to avoid circular dependencies
  const endGameRef = useRef<(() => void) | null>(null);
  const dropNextWordRef = useRef<(() => void) | null>(null);
  
  // Ref to track if content has been fetched for this assessment
  const contentFetchedRef = useRef<string | null>(null);

  // Fetch content from S3 for the assessment
  const fetchTripleStepContent = useCallback(async () => {
    if (!user?.email || !params?.assessmentId) return;
    
    // Prevent concurrent requests or if already fetched for this assessment
    if (isLoadingContent || contentFetchedRef.current === params.assessmentId) return;
    
    setIsLoadingContent(true);
    try {
      console.log('[TRIPLE-STEP] Fetching content from S3 for assessment:', params.assessmentId);
      
      const content = await S3Service.fetchTripleStepContent({
        user_email: user.email,
        assessment_id: params.assessmentId
      });
      
      console.log('[TRIPLE-STEP] Content fetched successfully:', content);
      setTripleStepContent(content);
      
      // Get random topic and its words
      const topics = Object.keys(content);
      if (topics.length > 0) {
        const randomTopic = topics[Math.floor(Math.random() * topics.length)];
        const wordsForTopic = content[randomTopic];
        
        // Shuffle words for variety
      const shuffleArray = (array: string[]) => {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
      };
      
        const shuffledWords = shuffleArray([...wordsForTopic]);
        
        setSettings(prev => ({
          ...prev,
          mainTopic: randomTopic,
          wordTypes: wordsForTopic
        }));
      setAvailableWords(shuffledWords);
      
        console.log('[TRIPLE-STEP] Content setup complete:', {
          topic: randomTopic,
          words: shuffledWords.length
        });
      }
      
      // Mark content as fetched for this assessment
      contentFetchedRef.current = params.assessmentId;
      
    } catch (error) {
      console.error('[TRIPLE-STEP] Failed to fetch content from S3:', error);
      toast({
        title: "Content Loading Failed",
        description: "Unable to load assessment content. Please try again.",
        variant: "destructive",
      });
      
      // Clear any existing content on error
      setTripleStepContent(null);
      setAvailableWords([]);
      setSettings(prev => ({ ...prev, mainTopic: "", wordTypes: [] }));
    } finally {
      setIsLoadingContent(false);
    }
  }, [user?.email, toast, params?.assessmentId]);

  // Fetch assessment data from DynamoDB (not needed for Triple Step - use fallback data)
  const fetchAssessmentData = useCallback(async () => {
    if (!params?.assessmentId || loadingAssessmentData) return;
    
    setLoadingAssessmentData(true);
    try {
      console.log('[TRIPLE-STEP] Setting fallback assessment data for:', params.assessmentId);
      
      // For Triple Step, we don't need to fetch additional assessment data
      // All required data comes from the Triple Step content API
      setAssessmentData({
        assessmentId: params.assessmentId || '',
        assessmentName: 'Triple Step Assessment',
        description: 'Master integration under pressure',
        order: 2,
        timeLimit: 180, // 3 minutes
        type: 'Games-arena'
      });
      
    } catch (error) {
      console.error('[TRIPLE-STEP] Error setting assessment data:', error);
      // Set fallback data if anything fails
      setAssessmentData({
        assessmentId: params.assessmentId || '',
        assessmentName: 'Triple Step Assessment',
        description: 'Master integration under pressure',
        order: 2,
        timeLimit: 180,
        type: 'Games-arena'
      });
    } finally {
      setLoadingAssessmentData(false);
    }
  }, [params?.assessmentId, loadingAssessmentData]);



  // Generate random word from available words
  const getRandomWord = useCallback(() => {
    console.log('[TRIPLE-STEP] Available words:', availableWords.length, availableWords.slice(0, 5));
    if (availableWords.length === 0) {
      console.log('[TRIPLE-STEP] No available words! Content generation may have failed.');
      return "";
    }
    const randomWord = availableWords[Math.floor(Math.random() * availableWords.length)];
    console.log('[TRIPLE-STEP] Selected word:', randomWord);
    
    // Remove used word to avoid repetition
    setAvailableWords(prev => {
      const newWords = prev.filter(word => word !== randomWord);
      console.log('[TRIPLE-STEP] Remaining words after removal:', newWords.length);
      return newWords;
    });
    
    return randomWord;
  }, [availableWords]);

  // Improved word detection with better text matching
  const detectWordsInTranscript = useCallback((currentTranscript: string) => {
    if (!currentTranscript) return;
    
    console.log('[TRIPLE-STEP] Analyzing transcript for word detection:', currentTranscript);
    
    // Clean and normalize the transcript
    const normalizedTranscript = currentTranscript.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
    
    console.log('[TRIPLE-STEP] Normalized transcript:', normalizedTranscript);
    
    const newDetectedWords = new Set(detectedWords);
    
    activeWords.forEach(wordDrop => {
      const targetWord = wordDrop.word.toLowerCase().trim();
      
      // Multiple detection strategies
      const detectionMethods = [
        // 1. Exact word boundary match
        new RegExp(`\\b${targetWord}\\b`).test(normalizedTranscript),
        // 2. Partial match with surrounding spaces
        normalizedTranscript.includes(` ${targetWord} `),
        // 3. Word at start or end
        normalizedTranscript.startsWith(`${targetWord} `) || normalizedTranscript.endsWith(` ${targetWord}`),
        // 4. Single word case
        normalizedTranscript === targetWord,
        // 5. Fuzzy match for similar sounding words (simple Levenshtein distance)
        checkFuzzyMatch(normalizedTranscript, targetWord)
      ];
      
      const isDetected = detectionMethods.some(method => method);
      
      console.log(`[TRIPLE-STEP] Checking word "${targetWord}":`, {
        transcript: normalizedTranscript,
        detectionResults: detectionMethods,
        alreadyDetected: newDetectedWords.has(targetWord),
        finalResult: isDetected && !newDetectedWords.has(targetWord)
      });
      
      if (isDetected && !newDetectedWords.has(targetWord)) {
        newDetectedWords.add(targetWord);
        
        // Mark word as integrated
        setActiveWords(prev => 
          prev.map(w => 
            w.word === wordDrop.word && w.timestamp === wordDrop.timestamp 
              ? { ...w, integrated: true, integrationTime: (Date.now() - w.timestamp) / 1000 }
              : w
          )
        );
        
        // Clear integration timer for this word
        const timerKey = `${wordDrop.word}-${wordDrop.timestamp}`;
        const timer = wordIntegrationTimersRef.current.get(timerKey);
        if (timer) {
          clearInterval(timer);
          wordIntegrationTimersRef.current.delete(timerKey);
        }
        
        // Move to completed words
        setTimeout(() => {
          setActiveWords(current => 
            current.filter(w => !(w.word === wordDrop.word && w.timestamp === wordDrop.timestamp))
          );
          const timeTaken = Math.floor((Date.now() - wordDrop.timestamp) / 1000);
          setCompletedWords(current => [...current, { 
            ...wordDrop, 
            integrated: true, 
            integrationTime: timeTaken 
          }]);
        }, 500);
        
        console.log(`[TRIPLE-STEP] ✅ Word "${wordDrop.word}" detected and integrated!`);
      }
    });
    
    setDetectedWords(newDetectedWords);
  }, [activeWords, detectedWords]);

  // Fuzzy matching helper for similar sounding words
  const checkFuzzyMatch = useCallback((transcript: string, targetWord: string) => {
    const words = transcript.split(/\s+/);
    return words.some(word => {
      if (word.length === 0 || targetWord.length === 0) return false;
      
      // Simple Levenshtein distance check for words of similar length
      if (Math.abs(word.length - targetWord.length) <= 1) {
        const distance = levenshteinDistance(word, targetWord);
        const threshold = Math.min(2, Math.ceil(targetWord.length * 0.2)); // 20% error tolerance
        return distance <= threshold;
      }
      
      // Check for phonetic similarities (basic)
      return checkPhoneticSimilarity(word, targetWord);
    });
  }, []);

  // Simple Levenshtein distance calculation
  const levenshteinDistance = useCallback((str1: string, str2: string): number => {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }, []);

  // Basic phonetic similarity check
  const checkPhoneticSimilarity = useCallback((word1: string, word2: string): boolean => {
    // Common speech recognition substitutions
    const phoneticMap: {[key: string]: string[]} = {
      'c': ['k', 's'],
      'k': ['c'],
      'f': ['ph', 'v'],
      'v': ['f'],
      'z': ['s'],
      's': ['z'],
      'i': ['e'],
      'e': ['i'],
      'a': ['e'],
      'o': ['u'],
      'u': ['o']
    };
    
    if (word1.length !== word2.length) return false;
    
    for (let i = 0; i < word1.length; i++) {
      const char1 = word1[i];
      const char2 = word2[i];
      
      if (char1 !== char2) {
        const alternatives = phoneticMap[char1] || [];
        if (!alternatives.includes(char2)) {
          return false;
        }
      }
    }
    
    return true;
  }, []);

  // Start the game
  const startGame = useCallback(async () => {
    if (!settings.mainTopic) {
      toast({
        title: "No Topic Available",
        description: "Please wait for content to load before starting.",
        variant: "destructive",
      });
      return;
    }
    
    setGameState("playing");

    // Setup video recording
    try {
      console.log('🎥 Requesting video permissions...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false // Audio is handled by useAudioRecording hook
      });
      
      console.log('✅ Video stream obtained:', {
        active: stream.active,
        tracks: stream.getVideoTracks().length
      });
      
      setVideoStream(stream);
    } catch (error) {
      console.error('❌ Failed to setup video:', error);
      // Continue without video
    }
    
    const initialTime = settings.totalWords * settings.dropFrequency + 60;
    console.log('[TRIPLE-STEP] ⏰ Setting initial time:', initialTime, 'seconds', {
      totalWords: settings.totalWords,
      dropFrequency: settings.dropFrequency,
      calculation: `${settings.totalWords} * ${settings.dropFrequency} + 60 = ${initialTime}`
    });
    setTimeRemaining(initialTime);
    
    setActiveWords([]);
    setCompletedWords([]);
    setWordsDropped(0);
    setDetectedWords(new Set());
    setGameStartTime(Date.now());
    setCurrentDuration(0);

    // Start audio recording and speech recognition
    try {
      console.log('[TRIPLE-STEP] Starting audio recording...');
      
      // Ensure we wait for recording to actually start
      await startRecording();
      
      // Add a small delay to ensure recording is properly initialized
      await new Promise(resolve => setTimeout(resolve, 200));
      
      console.log('[TRIPLE-STEP] Audio recording started successfully');
      
      if (hasSpeechSupport) {
        console.log('[TRIPLE-STEP] Starting speech recognition...');
        startListening();
        console.log('[TRIPLE-STEP] Speech recognition started');
      } else {
        console.log('[TRIPLE-STEP] Speech recognition not supported');
        toast({
          title: "Speech Recognition Unavailable",
          description: "Live transcript will not be available, but audio recording will continue.",
          variant: "default",
        });
      }
      
      // Verify recording started after a brief delay
      setTimeout(() => {
        if (isRecording) {
          console.log('[TRIPLE-STEP] ✅ Audio recording confirmed active');
          toast({
            title: "Recording Active",
            description: "Audio recording is working properly.",
            variant: "default",
          });
        }
      }, 1500); // Longer delay to ensure recording is stable
      
    } catch (error) {
      console.error('[TRIPLE-STEP] Failed to start recording:', error);
      toast({
        title: "Recording Failed",
        description: `Could not start audio recording: ${error instanceof Error ? error.message : 'Unknown error'}. Please check microphone permissions and try again.`,
        variant: "destructive",
      });
      
      // Don't return - continue with assessment even if recording fails
      console.log('[TRIPLE-STEP] Continuing assessment without recording...');
    }

    // Start the game flow after all state is properly set (with delay to ensure state updates complete)
    console.log('[TRIPLE-STEP] All setup complete, starting game flow...');
    setTimeout(() => {
      startGameFlow();
    }, 100); // Small delay to ensure all state updates are processed
  }, [settings, startRecording, startListening, hasSpeechSupport, toast]);

  const startWordDropSystem = useCallback(() => {
    // Drop first word immediately
    setTimeout(() => {
      const currentDropNextWord = dropNextWordRef.current;
      if (currentDropNextWord) {
        currentDropNextWord();
      }
      // Clear any existing countdown timer
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

      // Start word dropping interval
      if (wordDropIntervalRef.current) clearInterval(wordDropIntervalRef.current);
      wordDropIntervalRef.current = setInterval(() => {
        const currentDropNextWord = dropNextWordRef.current;
        if (currentDropNextWord) {
          currentDropNextWord();
        }
      }, settings.dropFrequency * 1000);
    }, 1000); // Small delay to ensure game is fully started
  }, [settings.dropFrequency]);

  const startGameFlow = useCallback(() => {
    console.log('[TRIPLE-STEP] Starting game flow with timers...');
    
    // Main game timer
    if (timerRef.current) {
      console.log('[TRIPLE-STEP] Clearing existing timer');
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    console.log('[TRIPLE-STEP] Setting up main timer interval...');
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        const newTime = prev - 1;
        console.log('[TRIPLE-STEP] ⏰ Timer tick, time remaining:', newTime);
        if (newTime <= 0) {
          console.log('[TRIPLE-STEP] ⏰ Timer expired, ending game');
          // Clear the timer immediately to prevent multiple calls
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          // Use setTimeout to avoid state update conflicts
          setTimeout(() => {
            const currentEndGame = endGameRef.current;
            if (currentEndGame) {
              console.log('[TRIPLE-STEP] ⏰ Calling endGame function');
              currentEndGame();
            } else {
              console.error('[TRIPLE-STEP] ⏰ endGame function not available in ref');
            }
          }, 0);
          return 0;
        }
        return newTime;
      });
    }, 1000);
    
    console.log('[TRIPLE-STEP] ✅ Main timer started with ID:', timerRef.current);

    // Start duration timer to track elapsed time
    durationTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
      setCurrentDuration(elapsed);
    }, 1000);

    startWordDropSystem();
  }, [startWordDropSystem]);

  const dropNextWord = useCallback(() => {
    setWordsDropped((currentCount) => {
      if (currentCount >= settings.totalWords) {
        // Stop dropping words
        if (wordDropIntervalRef.current) {
          clearInterval(wordDropIntervalRef.current);
          wordDropIntervalRef.current = null;
        }
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }

        console.log(`[TRIPLE-STEP] All ${settings.totalWords} words have been dropped`);
        return currentCount;
      }

      const newWord = getRandomWord();
      const wordDrop: WordDrop = {
        word: newWord,
        timestamp: Date.now(),
        integrated: false,
        timeRemaining: settings.integrationTime,
      };

      setActiveWords((prev) => [...prev, wordDrop]);
      const newCount = currentCount + 1;
      console.log(`[TRIPLE-STEP] Dropped word "${newWord}" - ${newCount}/${settings.totalWords}`);

      startWordIntegrationTimer(wordDrop);

      return newCount;
    });
  }, [settings.totalWords, settings.integrationTime, getRandomWord]);

  const startWordIntegrationTimer = useCallback((wordDrop: WordDrop) => {
    const timer = setInterval(() => {
      setActiveWords((prev) =>
        prev.map((word) => {
          if (word.word === wordDrop.word && word.timestamp === wordDrop.timestamp) {
            const newTimeRemaining = word.timeRemaining - 1;
            if (newTimeRemaining <= 0) {
              setTimeout(() => {
                setActiveWords((current) =>
                  current.filter((w) => !(w.word === word.word && w.timestamp === wordDrop.timestamp)),
                );
                setCompletedWords((current) => [...current, { ...word, integrated: false, timeRemaining: 0 }]);
                console.log(`[TRIPLE-STEP] Word "${word.word}" expired (not integrated)`);
              }, 0);
              return { ...word, timeRemaining: 0 };
            }
            return { ...word, timeRemaining: newTimeRemaining };
          }
          return word;
        }),
      );
    }, 1000);

    wordIntegrationTimersRef.current.set(`${wordDrop.word}-${wordDrop.timestamp}`, timer);

    // Clear timer after integration time
    setTimeout(
      () => {
        clearInterval(timer);
        wordIntegrationTimersRef.current.delete(`${wordDrop.word}-${wordDrop.timestamp}`);
      },
      settings.integrationTime * 1000 + 100,
    );
  }, [settings.integrationTime]);



  const clearAllTimers = useCallback(() => {
    console.log('[TRIPLE-STEP] Clearing all timers');
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (wordDropIntervalRef.current) {
      clearTimeout(wordDropIntervalRef.current);
      wordDropIntervalRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    wordIntegrationTimersRef.current.forEach((timer) => clearInterval(timer));
    wordIntegrationTimersRef.current.clear();
    
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);



  // End the game and save data
  const endGame = useCallback(async () => {
    console.log("[TRIPLE-STEP] endGame function called");

    // Clear all timers first to prevent further execution
    clearAllTimers();

    // Stop recording and speech recognition
    let audioBlob: Blob | null = null;
    try {
      console.log('[TRIPLE-STEP] Stopping audio recording...');
      audioBlob = await stopRecording();
      console.log('[TRIPLE-STEP] Audio recording stopped, blob:', audioBlob?.size || 'null');
      
      console.log('[TRIPLE-STEP] Stopping speech recognition...');
      stopListening();
      console.log('[TRIPLE-STEP] Speech recognition stopped');
      
    } catch (error) {
      console.error('[TRIPLE-STEP] Error stopping recording:', error);
      audioBlob = null;
    }

    // Stop video stream when assessment ends
    if (videoStream) {
      console.log('[TRIPLE-STEP] 🎥 Assessment ended, stopping video stream...');
      videoStream.getTracks().forEach(track => {
        track.stop();
        console.log('[TRIPLE-STEP] ✅ Video track stopped on assessment end:', track.kind);
      });
      setVideoStream(null);
    }

    // Upload to cloud storage if we have audio and user is authenticated
    if (audioBlob && audioBlob.size > 0 && user?.email) {
      console.log('[TRIPLE-STEP] 🎙️ Audio blob size:', audioBlob.size, 'bytes');

      // Always attempt cloud upload
      AudioUploadService.uploadRecording(
        audioBlob,
        user.email,
        'triple-step',
        params?.assessmentId || 'unknown'
      ).then((result) => {
        console.log('[TRIPLE-STEP] ☁️ Audio uploaded to cloud:', result.audio_id);
        toast({
          title: "Assessment Complete",
          description: "Your recording has been saved successfully.",
          variant: "default",
        });
      }).catch((error) => {
        console.error('[TRIPLE-STEP] Cloud upload failed:', error);
          toast({
            title: "Upload Failed",
            description: "Unable to save recording. Please try again.",
            variant: "destructive",
          });
      });
    } else if (!user?.email) {
      toast({
        title: "Upload Error",
        description: "User authentication required for cloud storage.",
        variant: "destructive",
      });
    }

    // Show success message before redirecting
    toast({
      title: "Assessment Complete!",
      description: "Your Triple Step assessment has been completed and saved successfully.",
      variant: "default",
    });

    // Navigate to dashboard instead of results page (Triple Step has different flow)
    setTimeout(() => setLocation('/'), 2000); // Small delay to show the success message
  }, [stopRecording, stopListening, clearAllTimers, videoStream, user?.email, params?.assessmentId, toast, setLocation]);

  const resetGame = useCallback(() => {
    setGameState("rules");
    setActiveWords([]);
    setCompletedWords([]);
    setTimeRemaining(0);


    setWordsDropped(0);
    setDetectedWords(new Set());

    // Clear all timers
    clearAllTimers();

    // Stop recording and speech recognition if active
    if (isRecording) {
      stopRecording();
    }
    if (isListening) {
      stopListening();
    }

    // Clean up video stream
    if (videoStream) {
      console.log('[TRIPLE-STEP] 🎥 Stopping video stream...');
      videoStream.getTracks().forEach(track => {
        track.stop();
        console.log('[TRIPLE-STEP] ✅ Video track stopped:', track.kind);
      });
      setVideoStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    resetTranscript();
  }, [clearAllTimers, isRecording, isListening, stopRecording, stopListening, resetTranscript, videoStream]);

  // Handler to move from rules to setup
  const handleStartFromRules = useCallback(() => {
    if (!tripleStepContent || !settings.mainTopic) {
      toast({
        title: "Content Not Ready",
        description: "Please wait for assessment content to load.",
        variant: "destructive",
      });
      return;
    }
    // Call startGame to handle permissions and setup
    startGame();
  }, [tripleStepContent, settings.mainTopic, toast, startGame]);

  // Cleanup video stream when navigating away or component unmounts
  useEffect(() => {
    return () => {
      if (videoStream) {
        console.log('[TRIPLE-STEP] 🎥 Component unmounting, stopping video stream...');
        videoStream.getTracks().forEach(track => {
          track.stop();
          console.log('[TRIPLE-STEP] ✅ Video track stopped on unmount:', track.kind);
        });
      }
    };
  }, [videoStream]);

  // Handle video stream connection
  useEffect(() => {
    if (videoStream && videoRef.current) {
      console.log('🎥 Connecting video stream to element');
      videoRef.current.srcObject = videoStream;
    }
  }, [videoStream]);

  // Monitor transcript for word detection
  useEffect(() => {
    if (gameState === "playing" && transcript) {
      detectWordsInTranscript(transcript);
    }
  }, [transcript, gameState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Removed auto-start useEffect - startGameFlow is now called directly from startGame

  // Fetch content from S3 on mount
  useEffect(() => {
    if (user?.email && params?.assessmentId) {
      fetchTripleStepContent();
    }
  }, [user?.email, params?.assessmentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch assessment data on mount
  useEffect(() => {
    fetchAssessmentData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update game data ref
  useEffect(() => {
    gameDataRef.current = {
      activeWords,
      completedWords,
      mainTopic: settings.mainTopic,
    };
  }, [activeWords, completedWords, settings.mainTopic]);

  // Update function refs to avoid circular dependencies
  useEffect(() => {
    endGameRef.current = endGame;
    dropNextWordRef.current = dropNextWord;
  }, [endGame, dropNextWord]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Use current values from refs to avoid dependency issues
      clearAllTimers();
      forceCleanup(); // This will handle audio cleanup
    };
  }, []); // Empty dependency array to only run on unmount

  if (gameState === "rules") {
    return (
      <TripleStepRules 
        onStartAssessment={handleStartFromRules}
        isLoading={isLoadingContent || !tripleStepContent || !settings.mainTopic}
      />
    );
  }

  // Removed setup state - now going directly to playing

  if (gameState === "playing") {
    const progress = (wordsDropped / settings.totalWords) * 100;

    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-6 py-8">
          
          {/* Topic Header with proper spacing */}
          <div className="relative mb-12">
            {/* Topic Centered */}
            <h2 className="text-3xl font-bold text-foreground mb-6 leading-relaxed 
                          max-w-5xl mx-auto text-center">
              {settings.mainTopic}
            </h2>

            {/* Timer Aligned Right */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2">
              <CircularTimer 
                timeLeft={timeRemaining} 
                isActive={true}
                label="Assessment"
              />
            </div>
          </div>

          {/* Main Assessment Layout - Single Card with Video (80%) and Words (20%) */}
          <div className="mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex gap-4" style={{ height: '500px' }}>
                  {/* Video Area - 80% width */}
                  <div className="flex-[0_0_80%]">
                    <div className="relative bg-secondary rounded-lg overflow-hidden h-full">
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
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-500 dark:bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                        REC
                      </div>
                    )}
                    
                    {/* Live Transcript Overlay */}
                    {isRecording && hasSpeechSupport && (
                      <div className="absolute bottom-4 left-4 right-4 bg-background/80 backdrop-blur-sm border border-border text-foreground p-3 rounded text-sm max-h-32 overflow-y-auto">
                        <div className="text-center text-xs text-muted-foreground mb-2">Live Transcript</div>
                        {transcript ? (
                          <div className="text-center">
                            {transcript.split(' ').map((word, index) => {
                              const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
                              const isTargetWord = activeWords.some(activeWord => 
                                activeWord.word.toLowerCase() === cleanWord
                              );
                              const isIntegratedWord = completedWords.some(completedWord =>
                                completedWord.integrated && completedWord.word.toLowerCase() === cleanWord
                              );
                              const isDetectedWord = detectedWords.has(cleanWord);
                              
                              let className = 'text-foreground';
                              if (isIntegratedWord || isDetectedWord) {
                                className = 'text-green-500 dark:text-green-400 font-semibold bg-green-500/20 dark:bg-green-500/30 px-1 rounded';
                              } else if (isTargetWord) {
                                className = 'text-orange-500 dark:text-orange-400 font-medium bg-orange-500/30 px-1 rounded';
                              }
                              
                              return (
                                <span key={index} className={className}>
                                  {word}{index < transcript.split(' ').length - 1 ? ' ' : ''}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center text-muted-foreground">Listening...</div>
                        )}
                      </div>
                    )}

                    </div>
                  </div>
                  
                  {/* Words Area - 20% width */}
                  <div className="flex-[0_0_20%] flex flex-col gap-4">
                    {/* Active Words Section */}
                    <div className="flex-1">
                      {activeWords.length > 0 ? (
                        <div className="space-y-3 overflow-y-auto max-h-[250px]">
                          {activeWords.map((wordDrop, index) => (
                            <div
                              key={`${wordDrop.word}-${wordDrop.timestamp}`}
                              className="bg-primary border border-accent shadow-lg rounded-lg p-3"
                            >
                              <div className="text-center">
                                <div className="text-lg font-bold text-primary-foreground mb-1">{wordDrop.word}</div>
                                <div className="text-xs text-primary-foreground/90 font-semibold mb-1">{wordDrop.timeRemaining}s</div>
                                <div className="text-xs text-primary-foreground/80">
                                  Integrate naturally
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div></div>
                      )}
                    </div>

                    {/* Word Integration History */}
                  {completedWords.length > 0 && (
                    <div className="mt-6">
                      <h4 className="font-medium mb-3 text-sm text-muted-foreground">Recent Words</h4>
                      <div className="flex flex-wrap gap-2">
                        {completedWords.slice(-6).map((wordDrop, index) => (
                          <Badge
                            key={index}
                            variant="default"
                            className={`flex items-center gap-1 text-xs bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-400`}
                          >
                            <CheckCircle className="h-3 w-3" /> 
                            {wordDrop.word}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }



  return null;
}
