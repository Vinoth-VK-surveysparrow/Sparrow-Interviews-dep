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

type GameState = "setup" | "playing" | "feedback";

// Hardcoded content for reliable testing
const MAIN_TOPICS = [
  "Innovation in technology",
  "The future of work", 
  "Building meaningful relationships",
  "Overcoming personal challenges",
  "The power of creativity",
  "Leadership in modern times",
  "Sustainable living",
  "The importance of education",
  "Digital transformation",
  "Mental health awareness",
  "Entrepreneurship journey",
  "Climate change solutions",
  "Artificial intelligence impact",
  "Social media influence",
  "Work-life balance"
];

// Word Categories (60 words total)
const WORD_CATEGORIES = {
  objects: ["pumpkin", "microwave", "telescope", "bicycle", "umbrella", "keyboard", "sandwich", "camera", "pillow", "guitar"],
  emotions: ["nostalgia", "excitement", "curiosity", "frustration", "serenity", "anxiety", "joy", "melancholy", "confidence", "wonder"],
  places: ["library", "mountain", "cafe", "beach", "forest", "city", "garden", "desert", "bridge", "marketplace"],
  actions: ["dancing", "cooking", "traveling", "reading", "exercising", "painting", "singing", "writing", "exploring", "building"],
  abstract: ["freedom", "justice", "beauty", "wisdom", "courage", "harmony", "progress", "tradition", "innovation", "balance"],
  nature: ["ocean", "sunrise", "storm", "flower", "river", "tree", "wind", "rain", "snow", "lightning"]
};

// Flatten all words into a single array
const ALL_WORDS = Object.values(WORD_CATEGORIES).flat();

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

  const [gameState, setGameState] = useState<GameState>("setup");
  const [settings, setSettings] = useState<GameSettings>({
    ...DIFFICULTY_PRESETS.beginner,
    mainTopic: "",
    wordTypes: [], // Will be populated from hardcoded data
  });
  const [activeWords, setActiveWords] = useState<WordDrop[]>([]);
  const [completedWords, setCompletedWords] = useState<WordDrop[]>([]);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
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
  
  // Generated content from hardcoded data
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  const [availableWords, setAvailableWords] = useState<string[]>([]);
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  
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

  // Generate content using hardcoded data for reliability
  const generateContent = useCallback(async () => {
    if (isGeneratingContent) return;
    
    setIsGeneratingContent(true);
    try {
      console.log('[TRIPLE-STEP] Generating content with hardcoded data...');
      
      // Simulate loading time for consistent UX
      await new Promise(resolve => setTimeout(resolve, 500));
      

      
      // Shuffle arrays for variety
      const shuffleArray = (array: string[]) => {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
      };
      
      // Use hardcoded data
      const shuffledTopics = shuffleArray([...MAIN_TOPICS]);
      const shuffledWords = shuffleArray([...ALL_WORDS]);
      
      setAvailableTopics(shuffledTopics);
      setAvailableWords(shuffledWords);
      
      // Set initial topic
      if (shuffledTopics.length > 0) {
        setSettings(prev => ({ ...prev, mainTopic: shuffledTopics[0] }));
      }
      
      console.log('[TRIPLE-STEP] Content generated successfully:', {
        topics: shuffledTopics.length,
        words: shuffledWords.length,
        categories: Object.keys(WORD_CATEGORIES)
      });
      
    } catch (error) {
      console.error('[TRIPLE-STEP] Failed to generate content:', error);
      toast({
        title: "Content Generation Failed",
        description: "Unable to generate content. Please try again.",
        variant: "destructive",
      });
      
      // Clear any existing content on error
      setAvailableTopics([]);
      setAvailableWords([]);
      setSettings(prev => ({ ...prev, mainTopic: "" }));
    } finally {
      setIsGeneratingContent(false);
    }
  }, [isGeneratingContent, settings.difficulty, settings.totalWords, toast]);

  // Fetch assessment data from DynamoDB
  const fetchAssessmentData = useCallback(async () => {
    if (!params?.assessmentId || loadingAssessmentData) return;
    
    setLoadingAssessmentData(true);
    try {
      console.log('[TRIPLE-STEP] Fetching assessment data for:', params.assessmentId);
      
      const response = await fetch(`/api/assessment/${params.assessmentId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch assessment data: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[TRIPLE-STEP] Assessment data received:', data);
      
      setAssessmentData(data);
      
    } catch (error) {
      console.error('[TRIPLE-STEP] Error fetching assessment data:', error);
      // Set fallback data if API fails
      setAssessmentData({
        assessmentId: params.assessmentId || 'triple-steps-001',
        assessmentName: 'Challenge your vocabulary',
        description: 'Show your knowledge and passion',
        order: 0,
        timeLimit: 30,
        type: 'Triple'
      });
    } finally {
      setLoadingAssessmentData(false);
    }
  }, [params?.assessmentId, loadingAssessmentData]);

  // Generate random topic from available topics
  const getRandomTopic = useCallback(() => {
    if (availableTopics.length === 0) return "";
    return availableTopics[Math.floor(Math.random() * availableTopics.length)];
  }, [availableTopics]);

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
    const topic = settings.mainTopic || getRandomTopic();
    setSettings((prev) => ({ ...prev, mainTopic: topic }));
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

    startGameFlow();
  }, [settings, getRandomTopic, startRecording, startListening, hasSpeechSupport, toast]);

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

  const analyzeWithAI = useCallback(async (audioBlob: Blob) => {
    console.log("[TRIPLE-STEP] 🤖 Starting AI analysis with audio blob:", {
      size: audioBlob.size,
      type: audioBlob.type,
      completedWords: completedWords.length,
      activeWords: activeWords.length
    });

    const allWords = [...completedWords, ...activeWords];
    const integratedWords = completedWords.filter(w => w.integrated);
    
    const gameData = {
      gameType: "triple-step",
      mainTopic: settings.mainTopic,
      totalWords: settings.totalWords,
      integratedWords: integratedWords.length,
      wordDrops: allWords.map(word => ({
        word: word.word,
        integrated: word.integrated,
        integrationTime: word.integrationTime
      })),
      transcript: transcript,
      detectedWords: Array.from(detectedWords),
      userEmail: user?.email,
      assessmentId: params?.assessmentId
    };
    
    console.log("[TRIPLE-STEP] 📊 Game data for analysis:", gameData);
    
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "triple-step-assessment.webm");
      formData.append("gameData", JSON.stringify(gameData));

      console.log("[TRIPLE-STEP] 🚀 Sending request to analysis API...");
      const response = await fetch('/api/analyze-speech', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        console.log("[TRIPLE-STEP] Analysis result:", result);

        setGameResult((prev) => ({
          totalWords: prev?.totalWords || settings.totalWords,
          integratedWords: result.integration_rate
            ? Math.round((result.integration_rate / 100) * settings.totalWords)
            : integratedWords.length,
          averageIntegrationTime: result.average_integration_time || 
            (integratedWords.length > 0 
              ? integratedWords.reduce((sum, w) => sum + (w.integrationTime || 0), 0) / integratedWords.length
              : 0),
          topicCoherence: prev?.topicCoherence || 0,
          missedWords: result.missed_words || activeWords.map(w => w.word),
          smoothIntegrations: prev?.smoothIntegrations || integratedWords.length,
          aiScore: result,
        }));
      } else {
        throw new Error(`Analysis failed: ${response.status}`);
      }
    } catch (error) {
      console.error("[TRIPLE-STEP] Analysis error:", error);
      
      // Fallback analysis
      const integratedCount = completedWords.filter(w => w.integrated).length;
      const integrationRate = Math.round((integratedCount / settings.totalWords) * 100);
      
      setGameResult((prev) => ({
        totalWords: prev?.totalWords || settings.totalWords,
        integratedWords: integratedCount,
        averageIntegrationTime: integratedWords.length > 0 
          ? integratedWords.reduce((sum, w) => sum + (w.integrationTime || 0), 0) / integratedWords.length
          : 0,
        topicCoherence: prev?.topicCoherence || 0,
        missedWords: activeWords.map(w => w.word),
        smoothIntegrations: prev?.smoothIntegrations || integratedCount,
        aiScore: {
          confidence_score: Math.max(60, integrationRate),
          specific_feedback: `Great work on the Triple Step assessment! You successfully integrated ${integratedCount} out of ${settings.totalWords} words while maintaining your speech about "${settings.mainTopic}".`,
          next_steps: [
            "Practice quicker word integration techniques",
            "Work on maintaining topic coherence while handling distractions",
            "Explore creative ways to weave challenging words into natural conversation"
          ],
          integration_rate: integrationRate,
          average_integration_time: integratedWords.length > 0 
            ? integratedWords.reduce((sum, w) => sum + (w.integrationTime || 0), 0) / integratedWords.length
            : 0,
          missed_words: activeWords.map(w => w.word)
        },
      }));
      
      toast({
        title: "Analysis Complete",
        description: "Analysis completed with basic metrics. Full AI analysis was unavailable.",
        variant: "default",
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [completedWords, activeWords, settings.totalWords, settings.mainTopic, transcript, detectedWords, user?.email, params?.assessmentId, toast]);

  // End the game and calculate results
  const endGame = useCallback(async () => {
    console.log("[TRIPLE-STEP] endGame function called");

    // Capture current word data for API
    const allWords = [...completedWords, ...activeWords];
    console.log("[TRIPLE-STEP] Captured word data:", JSON.stringify({
      totalWords: settings.totalWords,
      integratedWords: completedWords.filter(w => w.integrated).length,
      activeWords: activeWords.length,
      completedWords: completedWords.length,
    }));

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

    // Calculate basic results first
    const integratedCount = completedWords.filter(w => w.integrated).length;
    const basicResult: GameResult = {
      totalWords: settings.totalWords,
      integratedWords: integratedCount,
      averageIntegrationTime: completedWords.length > 0 
        ? completedWords.reduce((sum, w) => sum + (w.integrationTime || 0), 0) / completedWords.length
        : 0,
      topicCoherence: 0, // Will be updated by AI analysis
      missedWords: activeWords.map(w => w.word), // Words not integrated
      smoothIntegrations: integratedCount,
    };

    setGameResult(basicResult);
    setGameState("feedback");

    // Stop video stream when assessment ends
    if (videoStream) {
      console.log('[TRIPLE-STEP] 🎥 Assessment ended, stopping video stream...');
      videoStream.getTracks().forEach(track => {
        track.stop();
        console.log('[TRIPLE-STEP] ✅ Video track stopped on assessment end:', track.kind);
      });
      setVideoStream(null);
    }

    // Upload to cloud storage (skip localStorage for large files)
    if (audioBlob && audioBlob.size > 0 && user?.email) {
      console.log('[TRIPLE-STEP] 🎙️ Audio blob size:', audioBlob.size, 'bytes');
      
      // Only store in localStorage if file is small (under 1MB)
      if (audioBlob.size < 1024 * 1024) {
        try {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Audio = reader.result as string;
            localStorage.setItem(`triple_step_audio_${params?.assessmentId}`, base64Audio);
            console.log('[TRIPLE-STEP] 💾 Small audio stored in localStorage');
          };
          reader.readAsDataURL(audioBlob);
        } catch (error) {
          console.warn('[TRIPLE-STEP] Failed to store audio in localStorage (file too large):', error);
        }
      } else {
        console.log('[TRIPLE-STEP] ⚠️ Audio file too large for localStorage, uploading to cloud only');
      }

      // Always attempt cloud upload
      AudioUploadService.uploadRecording(
        audioBlob,
        user.email,
        'triple-step',
        params?.assessmentId || 'unknown'
      ).then((result) => {
        console.log('[TRIPLE-STEP] ☁️ Audio uploaded to cloud:', result.audio_id);
        toast({
          title: "Audio Saved",
          description: "Your recording has been saved to cloud storage.",
          variant: "default",
        });
      }).catch((error) => {
        console.error('[TRIPLE-STEP] Cloud upload failed:', error);
        
        // Only show error if no local backup was possible
        if (audioBlob.size >= 1024 * 1024) {
          toast({
            title: "Upload Failed",
            description: "Unable to save recording. Please try again.",
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
    } else if (!user?.email) {
      toast({
        title: "Upload Error",
        description: "User authentication required for cloud storage.",
        variant: "destructive",
      });
    }

    // Try to analyze with AI if we have valid audio
    if (audioBlob && audioBlob.size > 0) {
      console.log('[TRIPLE-STEP] ✅ Valid audio blob received for AI analysis:', {
        size: audioBlob.size,
        type: audioBlob.type,
        transcript: transcript?.substring(0, 100) + '...'
      });
      setIsAnalyzing(true);
      try {
        await analyzeWithAI(audioBlob);
      } catch (error) {
        console.error('[TRIPLE-STEP] AI analysis failed:', error);
        toast({
          title: "Analysis Error",
          description: "AI analysis failed, but basic results are available.",
          variant: "destructive",
        });
        setIsAnalyzing(false);
      }
    } else {
      console.warn('[TRIPLE-STEP] ⚠️ No valid audio blob for AI analysis');
      toast({
        title: "No Audio Recorded",
        description: "Assessment completed but no audio was available for AI analysis.",
        variant: "default",
      });
    }
  }, [completedWords, activeWords, settings.totalWords, stopRecording, stopListening, clearAllTimers, analyzeWithAI, transcript, toast]);

  const resetGame = useCallback(() => {
    setGameState("setup");
    setActiveWords([]);
    setCompletedWords([]);
    setTimeRemaining(0);

    setGameResult(null);
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

  // Fetch assessment data on mount
  useEffect(() => {
    fetchAssessmentData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize content on mount
  useEffect(() => {
    generateContent();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps



  // Regenerate content when difficulty changes
  useEffect(() => {
    if (availableTopics.length > 0) { // Only if already initialized
      generateContent();
    }
  }, [settings.difficulty]); // eslint-disable-line react-hooks/exhaustive-deps

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

  if (gameState === "setup") {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="mb-6">
            <Button
              onClick={() => setLocation('/')}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              Home
            </Button>
          </div>

          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-lg">
                <Target className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-foreground mb-2">
                  {assessmentData?.assessmentName || "Triple Step Assessment"}
                </h1>
                <p className="text-xl text-muted-foreground">
                  {assessmentData?.description || "Master integration under pressure"}
                </p>
              </div>
            </div>
          </div>

          <div className="text-center space-y-8 mb-20">
            <div>
              <h2 className="text-2xl font-semibold mb-6">How It Works</h2>
              <ul className="space-y-4 text-muted-foreground max-w-2xl mx-auto text-left">
                <li className="flex items-start gap-3">
                  <span className="text-primary font-bold">1.</span>
                  <span>Speak about your assigned topic continuously</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary font-bold">2.</span>
                  <span>Random words will appear on screen every few seconds</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary font-bold">3.</span>
                  <span>Integrate these words naturally into your speech</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary font-bold">4.</span>
                  <span>Each word has a time limit to be integrated</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary font-bold">5.</span>
                  <span>Maintain topic coherence while handling distractions</span>
                </li>
              </ul>
            </div>

            <Card className="shadow-xl border-0 bg-card/90 backdrop-blur-sm mb-8">
              <CardContent className="p-8 space-y-8">
                {/* Content Generation Status */}
                {isGeneratingContent && (
                  <div className="text-center mb-6">
                    <div className="flex items-center justify-center gap-3">
                      <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                      <span className="text-lg">Generating personalized content...</span>
                    </div>
                  </div>
                )}

                {/* Current Topic Display */}
                <div className="text-center">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-3">Your Speaking Topic</h3>
                    {settings.mainTopic ? (
                      <div
                        className="text-2xl font-bold text-primary cursor-pointer hover:text-primary/80 transition-colors p-4 rounded-lg hover:bg-muted/50 border-2 border-dashed border-muted hover:border-primary/50"
                        onClick={() => setSettings((prev) => ({ ...prev, mainTopic: getRandomTopic() }))}
                        title="Click to change topic"
                      >
                        {settings.mainTopic}
                      </div>
                    ) : (
                      <div className="text-xl text-muted-foreground p-4">
                        {isGeneratingContent ? "Generating topic..." : "No topic available"}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Start button positioned at bottom right */}
        <div className="fixed bottom-8 right-8">
          <Button 
            onClick={startGame}
            size="lg"
            className="bg-primary hover:bg-primary/90 px-8 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
            disabled={!settings.mainTopic || availableWords.length === 0 || isGeneratingContent}
          >
            <Play className="h-6 w-6 mr-3" />
            {isGeneratingContent ? "Generating Content..." : "Start Assessment"}
          </Button>
        </div>
      </div>
    );
  }

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
                      <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium">
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
                              
                              let className = 'text-white';
                              if (isIntegratedWord || isDetectedWord) {
                                className = 'text-green-500 dark:text-green-400 font-semibold bg-green-500/20 dark:bg-green-500/30 px-1 rounded';
                              } else if (isTargetWord) {
                                className = 'text-orange-300 font-medium bg-orange-500/30 px-1 rounded';
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
                            className={`flex items-center gap-1 text-xs bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-300`}
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

  if (gameState === "feedback") {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="mb-6">
            <Button
              onClick={() => setLocation('/')}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              Home
            </Button>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-4">Assessment Complete!</h1>
            <p className="text-xl text-muted-foreground">Great work on the Triple Step assessment</p>
          </div>

          {/* Performance Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
                  {gameResult?.aiScore?.confidence_score
                    ? `${Math.round(gameResult.aiScore.confidence_score)}/100`
                    : "0/100"}
                </div>
                <div className="text-foreground font-medium mb-1">Overall Score</div>
                <div className="text-sm text-muted-foreground">{gameResult?.aiScore ? "AI-analyzed" : "Pending analysis"}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                  {gameResult?.aiScore?.integration_rate
                    ? `${gameResult.aiScore.integration_rate}%`
                    : gameResult?.integratedWords
                      ? `${Math.round((gameResult.integratedWords / gameResult.totalWords) * 100)}%`
                      : "0%"}
                </div>
                <div className="text-foreground font-medium mb-1">Integration Rate</div>
                <div className="text-sm text-muted-foreground">Words successfully integrated</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold text-orange-600 mb-2">
                  {gameResult?.aiScore?.topic_coherence
                    ? `${Math.round(gameResult.aiScore.topic_coherence)}/100`
                    : "0/100"}
                </div>
                <div className="text-foreground font-medium mb-1">Topic Coherence</div>
                <div className="text-sm text-muted-foreground">Maintained main topic focus</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold text-purple-600 mb-2">
                  {gameResult?.aiScore?.adaptability
                    ? `${Math.round(gameResult.aiScore.adaptability)}/100`
                    : "0/100"}
                </div>
                <div className="text-foreground font-medium mb-1">Adaptability</div>
                <div className="text-sm text-muted-foreground">Quick thinking & flexibility</div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Analysis */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Performance Breakdown</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Total Words:</span>
                    <Badge variant="secondary">{gameResult?.totalWords || 0}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Successfully Integrated:</span>
                    <Badge variant="secondary" className="bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-300">
                      {gameResult?.integratedWords || 0}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Average Integration Time:</span>
                    <Badge variant="secondary">
                      {gameResult?.aiScore?.average_integration_time
                        ? `${gameResult.aiScore.average_integration_time.toFixed(1)}s`
                        : gameResult?.averageIntegrationTime
                          ? `${gameResult.averageIntegrationTime.toFixed(1)}s`
                          : "0.0s"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Speaking Clarity:</span>
                    <Badge variant="secondary">
                      {gameResult?.aiScore?.speaking_clarity
                        ? `${Math.round(gameResult.aiScore.speaking_clarity)}/100`
                        : "N/A"}
                    </Badge>
                  </div>
                  {gameResult?.aiScore?.missed_words && gameResult.aiScore.missed_words.length > 0 && (
                    <div className="pt-2">
                      <span className="text-sm font-medium text-muted-foreground">Missed Words:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {gameResult.aiScore.missed_words.map((word, index) => (
                          <Badge 
                            key={index} 
                            variant="destructive" 
                            className="text-xs bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30 dark:border-red-500/50"
                          >
                            {word}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Recording & Assessment Details</h3>
                
                {/* Audio Playback */}
                {(() => {
                  const storedAudio = localStorage.getItem(`triple_step_audio_${params?.assessmentId}`);
                  if (storedAudio) {
                    return (
                      <div className="mb-4 pb-4 border-b border-border">
                        <span className="text-sm font-medium text-muted-foreground">Your Recording:</span>
                        <audio 
                          controls 
                          className="w-full mt-2"
                          src={storedAudio}
                        />
                        <div className="text-xs text-muted-foreground mt-1">
                          Audio saved locally for review
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
                
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Topic:</span>
                    <p className="text-sm mt-1">{settings.mainTopic}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>



          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={resetGame} size="lg" className="px-8">
              <RotateCcw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            <Button 
              onClick={() => setLocation('/')}
              variant="outline" 
              size="lg" 
              className="px-8"
            >
              <Home className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
