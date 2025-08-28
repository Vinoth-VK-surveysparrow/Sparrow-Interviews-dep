import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { CheckCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useContinuousAudioRecording } from '@/hooks/useContinuousAudioRecording';
import { useCameraCapture } from '@/hooks/useCameraCapture';
import { useS3Upload } from '@/hooks/useS3Upload';
import { useAssessment } from '@/contexts/AssessmentContext';
import { S3Service, Question } from '@/lib/s3Service';
import { assessmentLogger } from '@/lib/assessmentLogger';
import TripleStepRules from '@/components/TripleStepRules';

import { useBehaviorMonitoring } from '@/hooks/useBehaviorMonitoring';
import { WarningBadge } from '@/components/WarningBadge';
import { useClarity } from '@/hooks/useClarity';

// Enhanced Circular Timer component for assessments

const CircularTimer = memo(({ 
  timeLeft, 
  isActive, 
  onClick, 
  isFinishing, 
  isLastQuestion,
  isUploading
}: { 
  timeLeft: number; 
  isActive: boolean; 
  onClick: () => void; 
  isFinishing: boolean;
  isLastQuestion: boolean;
  isUploading: boolean;
}) => {
  const totalTime = 240; // 4 minutes for TripleStep
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
          {isFinishing || isUploading ? (
            <div className="flex flex-col items-center text-white">
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mb-2"></div>
              <div className="text-xs font-medium">
                {isUploading ? 'Uploading...' : 'Finishing...'}
          </div>
                </div>
              ) : (
            <>
              <div className="text-lg font-bold text-foreground group-hover:text-white transition-colors duration-200">
                {minutes}:{seconds.toString().padStart(2, '0')}
                </div>
              <div className="text-xs text-muted-foreground group-hover:text-white/80 mt-1 transition-colors duration-200">
                {isLastQuestion ? 'Finish' : 'Next'}
            </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

interface WordDrop {
  word: string;
  timestamp: number;
  integrated: boolean;
  integrationTime?: number;
  timeRemaining: number;
}

type GameState = "rules" | "playing";

const DIFFICULTY_SETTINGS = {
  totalWords: 6,
  dropFrequency: 30, // seconds
  integrationTime: 8, // seconds per word
  difficulty: "intermediate"
};

export default function TripleStepAssessment() {
  const [, params] = useRoute('/triple-step/:assessmentId');
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  // Microsoft Clarity tracking
  const { trackPageView, trackAssessmentEvent, trackUserAction, setUserId, setTag } = useClarity(
    true, // Auto-track page view
    'Triple-Step Assessment'
  );
  
  // Standard assessment hooks
  const { 
    session, 
    finishAssessment, 
    startSession, 
    isS3Ready, 
    uploadAudioToS3
  } = useAssessment();
  const { videoRef, startCamera } = useCameraCapture(); // Only video display, no image capture
  const { startContinuousRecording, stopContinuousRecording, isRecording, forceCleanup } = useContinuousAudioRecording();
  const { transcript, startListening, stopListening, resetTranscript, hasSupport } = useSpeechRecognition(true);
  const { fetchQuestions } = useS3Upload();
  
  // Assessment state
  const [gameState, setGameState] = useState<GameState>("rules");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(240); // 4 minutes per question
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [assessmentStarted, setAssessmentStarted] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Triple Step game state
  const [activeWords, setActiveWords] = useState<WordDrop[]>([]);
  const [completedWords, setCompletedWords] = useState<WordDrop[]>([]);
  const [wordsDropped, setWordsDropped] = useState(0);
  const [gameStartTime, setGameStartTime] = useState(0);
  const [availableWords, setAvailableWords] = useState<string[]>([]);
  const [detectedWords, setDetectedWords] = useState<Set<string>>(new Set());
  
  // Refs for timers
  const wordDropIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const wordIntegrationTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const dropNextWordRef = useRef<(() => void) | null>(null);
  
  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  // Audio verification with retry mechanism (copied from Assessment.tsx)
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

  // Fetch questions when component mounts
  useEffect(() => {
    const fetchTripleStepQuestions = async () => {
      if (!params?.assessmentId) {
        console.error('No assessment ID provided');
        return;
      }

      if (authLoading) {
        return;
      }

      if (!user?.email) {
        console.error('❌ User not authenticated');
        setLocation('/login');
        return;
      }

      try {
        setLoadingQuestions(true);
        
        // Use the standard fetchQuestions but with Triple-Step type
        const fetchedQuestions = await S3Service.fetchQuestions({
          user_email: user.email,
          assessment_id: params.assessmentId,
          type: 'Triple-Step'
        });
        
        console.log('[TRIPLE-STEP] Questions fetched:', fetchedQuestions);
        setQuestions(fetchedQuestions);
      
    } catch (error) {
        console.error('❌ Failed to fetch Triple Step questions:', error);
        setLocation('/test-selection');
    } finally {
        setLoadingQuestions(false);
      }
    };

    fetchTripleStepQuestions();
  }, [params?.assessmentId, authLoading, user?.email, setLocation]);

  // Initialize assessment once questions are loaded
  useEffect(() => {
    const initializeAssessment = async () => {
      if (loadingQuestions || questions.length === 0 || gameState !== "playing") return;
      
      // Start assessment session if not already started
      if (params?.assessmentId && !session.assessmentId) {
        await startSession(params.assessmentId);
      }
      
      // Track assessment start
      if (user?.email) {
        setUserId(user.email, user.displayName || undefined);
        setTag('assessment_type', 'triple-step');
        trackAssessmentEvent('started', {
          assessment_id: params?.assessmentId,
          user_email: user.email,
          user_name: user.displayName || 'Unknown',
          questions_count: questions.length
        });
      }
      
      // Start camera for video display and audio recording
      startCamera();
      await startContinuousRecording();
      
      // Start speech recognition
      if (hasSupport) {
        setTimeout(() => {
          startListening();
        }, 1000);
      }

      // Setup for first question
      if (questions.length > 0) {
        const firstQuestion = questions[0];
        setAvailableWords([...(firstQuestion.words || [])]);
        
        // Log the first question as a complete entry (question text only)
        assessmentLogger.logCompleteQuestion(
          firstQuestion.question_text, 
          firstQuestion.question_id, 
          0,
          new Date(), // Start time
          new Date()  // End time (immediate completion for TripleStep)
        );
        
        // Start the game timer and flow
        setIsTimerActive(true);
        setAssessmentStarted(true);
        setGameStartTime(Date.now());
        
        // Start word dropping after 60 seconds prep time
        setTimeout(() => {
          startWordDropSystem();
        }, 60000);
      }
    };

    initializeAssessment();

    return () => {
      if (hasSupport) {
        stopListening();
      }
    };
  }, [loadingQuestions, questions.length, gameState, params?.assessmentId]);

  // Removed auto-capture - images not needed for TripleStep

  // Timer logic
  useEffect(() => {
    if (!isTimerActive || timeLeft <= 0 || isFinishing || isUploading) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsTimerActive(false);
          setTimeout(() => {
            if (!isFinishing && !isUploading) {
              handleNextQuestion();
            }
          }, 100);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimerActive, timeLeft, isFinishing, isUploading]);

  // Word detection logic
  const detectWordsInTranscript = useCallback((currentTranscript: string) => {
    if (!currentTranscript) return;
    
    const normalizedTranscript = currentTranscript.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    setDetectedWords(prevDetectedWords => {
      const newDetectedWords = new Set(prevDetectedWords);
    
      setActiveWords(prevActiveWords => {
        let wordsChanged = false;
    
        prevActiveWords.forEach(wordDrop => {
      const targetWord = wordDrop.word.toLowerCase().trim();
      
          // Simple word detection
          const isDetected = normalizedTranscript.includes(targetWord) ||
                            normalizedTranscript.split(' ').some(word => word === targetWord);
      
      if (isDetected && !newDetectedWords.has(targetWord)) {
        newDetectedWords.add(targetWord);
            wordsChanged = true;
        
        // Clear integration timer for this word
        const timerKey = `${wordDrop.word}-${wordDrop.timestamp}`;
        const timer = wordIntegrationTimersRef.current.get(timerKey);
        if (timer) {
          clearInterval(timer);
          wordIntegrationTimersRef.current.delete(timerKey);
        }
            
            // Log word integration event
            assessmentLogger.markWordIntegrated(wordDrop.word, new Date());
            
            // Track word integration in Clarity
            trackAssessmentEvent('word_integrated', {
              word: wordDrop.word,
              integration_time_seconds: Math.floor((Date.now() - wordDrop.timestamp) / 1000),
              question_index: currentQuestionIndex
            });
        
        // Move to completed words
        setTimeout(() => {
          setActiveWords(current => 
            current.filter(w => !(w.word === wordDrop.word && w.timestamp === wordDrop.timestamp))
          );
          setCompletedWords(current => [...current, { 
            ...wordDrop, 
            integrated: true, 
                integrationTime: Math.floor((Date.now() - wordDrop.timestamp) / 1000)
          }]);
        }, 500);
        
        console.log(`[TRIPLE-STEP] ✅ Word "${wordDrop.word}" detected and integrated!`);
      }
    });
    
        if (wordsChanged) {
          return prevActiveWords.map(w => 
            newDetectedWords.has(w.word.toLowerCase().trim())
              ? { ...w, integrated: true, integrationTime: (Date.now() - w.timestamp) / 1000 }
              : w
          );
        }
        return prevActiveWords;
      });
      
      return newDetectedWords;
    });
  }, []); // Empty dependency array since we're using functional updates

  // Monitor transcript for word detection
  useEffect(() => {
    if (gameState === "playing" && transcript) {
      detectWordsInTranscript(transcript);
    }
  }, [transcript, gameState]); // Removed detectWordsInTranscript dependency to prevent infinite loop

  // Word dropping system
  const getRandomWord = useCallback(() => {
    if (availableWords.length === 0) return "";
    const randomWord = availableWords[Math.floor(Math.random() * availableWords.length)];
    setAvailableWords(prev => prev.filter(word => word !== randomWord));
    return randomWord;
  }, [availableWords]);

  const dropNextWord = useCallback(() => {
    setWordsDropped((currentCount) => {
      if (currentCount >= DIFFICULTY_SETTINGS.totalWords) {
        if (wordDropIntervalRef.current) {
          clearInterval(wordDropIntervalRef.current);
          wordDropIntervalRef.current = null;
        }
        return currentCount;
      }

      const newWord = getRandomWord();
      if (!newWord) return currentCount;

      const wordDrop: WordDrop = {
        word: newWord,
        timestamp: Date.now(),
        integrated: false,
        timeRemaining: DIFFICULTY_SETTINGS.integrationTime,
      };

      setActiveWords((prev) => [...prev, wordDrop]);
      startWordIntegrationTimer(wordDrop);

      // Log word appearance event
      if (currentQuestion) {
        assessmentLogger.addWordEvent(
          newWord, 
          new Date(wordDrop.timestamp), 
          currentQuestion.question_id
        );
        
        // Track word appearance in Clarity
        trackAssessmentEvent('word_dropped', {
          word: newWord,
          question_index: currentQuestionIndex,
          total_words_dropped: currentCount + 1
        });
      }

      return currentCount + 1;
    });
  }, [getRandomWord, currentQuestion]);

  const startWordIntegrationTimer = useCallback((wordDrop: WordDrop) => {
    const timer = setInterval(() => {
      setActiveWords((prev) =>
        prev.map((word) => {
          if (word.word === wordDrop.word && word.timestamp === wordDrop.timestamp) {
            const newTimeRemaining = word.timeRemaining - 1;
            if (newTimeRemaining <= 0) {
              const timerKey = `${wordDrop.word}-${wordDrop.timestamp}`;
              const timer = wordIntegrationTimersRef.current.get(timerKey);
              if (timer) {
                clearInterval(timer);
                wordIntegrationTimersRef.current.delete(timerKey);
              }
              
              // Mark word as expired in logger with precise expiration time
              const expirationTime = new Date(wordDrop.timestamp + (DIFFICULTY_SETTINGS.integrationTime * 1000));
              assessmentLogger.markWordExpired(word.word, expirationTime);
              
              // Track word expiration in Clarity
              trackAssessmentEvent('word_expired', {
                word: word.word,
                question_index: currentQuestionIndex,
                time_available_seconds: DIFFICULTY_SETTINGS.integrationTime
              });
              
              setTimeout(() => {
                setActiveWords((current) =>
                  current.filter((w) => !(w.word === word.word && w.timestamp === wordDrop.timestamp)),
                );
                setCompletedWords((current) => [...current, { ...word, integrated: false, timeRemaining: 0 }]);
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

    setTimeout(
      () => {
        clearInterval(timer);
        wordIntegrationTimersRef.current.delete(`${wordDrop.word}-${wordDrop.timestamp}`);
      },
      DIFFICULTY_SETTINGS.integrationTime * 1000 + 100,
    );
  }, []);

  const startWordDropSystem = useCallback(() => {
    console.log('[TRIPLE-STEP] Starting word drop system...');
    
    // Drop first word immediately
    if (dropNextWordRef.current) {
      dropNextWordRef.current();
    }
    
    // Start interval for subsequent words
    wordDropIntervalRef.current = setInterval(() => {
      if (dropNextWordRef.current) {
        dropNextWordRef.current();
      }
    }, DIFFICULTY_SETTINGS.dropFrequency * 1000);
  }, []);

  // Update function refs
  useEffect(() => {
    dropNextWordRef.current = dropNextWord;
  }, [dropNextWord]);

  // Handle next question or finish assessment
  const handleNextQuestion = useCallback(async () => {
    if (!currentQuestion) return;

    try {
      // Finish any uncompleted word logs before moving to next question
      assessmentLogger.finishAllUncompletedWords(new Date());

      if (isLastQuestion) {
        setIsFinishing(true);
        setIsTimerActive(false);
        
        // Track assessment completion
        trackAssessmentEvent('completed', {
          assessment_id: params?.assessmentId,
          user_email: user?.email,
          total_questions: questions.length,
          completed_words: completedWords.length,
          active_words_remaining: activeWords.length
        });
        
        // Stop all activities
        stopListening();
        
        // Clear word drop timers
        if (wordDropIntervalRef.current) {
          clearInterval(wordDropIntervalRef.current);
          wordDropIntervalRef.current = null;
        }
        wordIntegrationTimersRef.current.forEach((timer) => clearInterval(timer));
        wordIntegrationTimersRef.current.clear();
        
        // Stop continuous recording
        const finalAudio = await stopContinuousRecording();
        
        if (finalAudio && isS3Ready) {
          setIsUploading(true);
          try {
            await uploadAudioToS3(finalAudio);
            const audioVerified = await verifyAudioWithRetry();
            
            if (audioVerified) {
              await finishAssessment();
      } else {
              console.error('❌ Audio verification failed');
              await finishAssessment();
            }
          } catch (uploadError) {
            console.error('❌ Audio upload failed:', uploadError);
            await finishAssessment();
          } finally {
            setIsUploading(false);
      }
    } else {
          await finishAssessment();
        }
        
        forceCleanup();
        setLocation(`/results/${params?.assessmentId}`);
        return;
      }


      // Move to next question
      const nextIndex = currentQuestionIndex + 1;
      const nextQuestion = questions[nextIndex];
      
      if (nextQuestion) {
        // Clear current question state
    setActiveWords([]);
    setCompletedWords([]);
    setWordsDropped(0);
    setDetectedWords(new Set());
        setAvailableWords([...(nextQuestion.words || [])]);
        
        // Clear timers
        if (wordDropIntervalRef.current) {
          clearInterval(wordDropIntervalRef.current);
          wordDropIntervalRef.current = null;
        }
        wordIntegrationTimersRef.current.forEach((timer) => clearInterval(timer));
        wordIntegrationTimersRef.current.clear();
        
        // Update question index
        setCurrentQuestionIndex(nextIndex);
        
        // Log the new question as a complete entry (question text only)
        assessmentLogger.logCompleteQuestion(
          nextQuestion.question_text, 
          nextQuestion.question_id, 
          nextIndex,
          new Date(), // Start time
          new Date()  // End time (immediate completion for TripleStep)
        );
        
        // Track question transition
        trackAssessmentEvent('question_transition', {
          from_question_index: currentQuestionIndex,
          to_question_index: nextIndex,
          completed_words_in_question: completedWords.length,
          remaining_words_in_question: activeWords.length
        });
        
        // Reset timer
        setTimeLeft(240);
        setIsTimerActive(true);
        setGameStartTime(Date.now());
        
        // Reset transcript
    resetTranscript();
        
        // Start word dropping after 60 seconds
        setTimeout(() => {
          startWordDropSystem();
        }, 60000);
      }
    } catch (error) {
      console.error('❌ Error in handleNextQuestion:', error);
    }
  }, [currentQuestion, isLastQuestion, currentQuestionIndex, questions, stopListening, stopContinuousRecording, isS3Ready, uploadAudioToS3, verifyAudioWithRetry, finishAssessment, forceCleanup, setLocation, params?.assessmentId, resetTranscript, startWordDropSystem]);

  // Handle start from rules
  const handleStartFromRules = useCallback(() => {
    if (questions.length === 0) {
      toast({
        title: "Questions Not Ready",
        description: "Please wait for questions to load.",
        variant: "destructive",
      });
      return;
    }
    
    // Track rules completion and assessment start
    trackUserAction('start_assessment_from_rules', {
      assessment_id: params?.assessmentId,
      questions_ready: questions.length > 0
    });
    
    setGameState("playing");
  }, [questions.length, toast, trackUserAction, params?.assessmentId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wordDropIntervalRef.current) {
        clearInterval(wordDropIntervalRef.current);
      }
      wordIntegrationTimersRef.current.forEach((timer) => clearInterval(timer));
      wordIntegrationTimersRef.current.clear();
      forceCleanup();
    };
  }, []);

  // Show rules page
  if (gameState === "rules") {
    return (
      <TripleStepRules 
        onStartAssessment={handleStartFromRules}
        isLoading={loadingQuestions || questions.length === 0}
      />
    );
  }

  // Show loading if questions not ready
  if (loadingQuestions || questions.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading assessment...</p>
        </div>
      </div>
    );
  }

    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-6 py-8">
          
        {/* Topic Header */}
          <div className="mb-12">
            <div className="flex items-start justify-between gap-8">
              <div className="flex-1 min-w-0">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground mb-2">
                  Question {currentQuestionIndex + 1} of {questions.length}
                  </div>
                  <h2 className="text-3xl font-bold text-foreground leading-relaxed">
                  {currentQuestion?.question_text}
                  </h2>
                  
                </div>
              </div>

              <div className="flex-shrink-0">
                <CircularTimer 
                timeLeft={timeLeft} 
                isActive={isTimerActive}
                onClick={handleNextQuestion}
                isFinishing={isFinishing}
                isLastQuestion={isLastQuestion}
                isUploading={isUploading}
                />
              </div>
            </div>
          </div>

        {/* Main Assessment Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Video Section - Left Side */}
            <div className="lg:col-span-1">
              <div className="relative bg-gray-900 rounded-xl overflow-hidden shadow-lg" style={{ aspectRatio: '4/3' }}>
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    autoPlay
                    muted
                    playsInline
                    style={{ backgroundColor: '#111827' }}
                  />
                
                {/* Recording Indicator */}
                {isRecording && (
                  <div className="absolute top-4 right-4 flex items-center bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                    <div 
                      className="w-2 h-2 bg-white rounded-full mr-2" 
                      style={{ 
                        animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                        willChange: 'opacity'
                      }}
                    ></div>
                    REC
                  </div>
                )}
                
                {/* Live Transcript Overlay */}
              {isRecording && hasSupport && (
                  <div className="absolute bottom-4 left-4 right-4 bg-black/80 backdrop-blur-sm text-white p-3 rounded text-sm max-h-32 overflow-y-auto">
                    <div className="text-center text-xs text-gray-300 mb-2">Live Transcript</div>
                    {transcript ? (
                      <div className="text-center">
                        {transcript.split(' ').map((word, index) => {
                          const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
                          const isTargetWord = activeWords.some(activeWord => 
                            activeWord.word.toLowerCase() === cleanWord
                          );
                          const isDetectedWord = detectedWords.has(cleanWord);
                          
                          let className = 'text-white';
                        if (isDetectedWord) {
                            className = 'text-green-400 font-semibold bg-green-500/30 px-1 rounded';
                          } else if (isTargetWord) {
                            className = 'text-orange-400 font-medium bg-orange-500/30 px-1 rounded';
                          }
                          
                          return (
                            <span key={index} className={className}>
                              {word}{index < transcript.split(' ').length - 1 ? ' ' : ''}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center text-gray-300">Listening...</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Words Section - Right Side */}
            <div className="lg:col-span-1 flex flex-col justify-between min-h-[400px]">
              {/* Active Words Section */}
              <div className="flex-grow">
                {activeWords.length > 0 ? (
                  <div className="space-y-4 overflow-y-auto max-h-[300px]">
                  {activeWords.map((wordDrop) => (
                      <div
                        key={`${wordDrop.word}-${wordDrop.timestamp}`}
                        className="bg-primary border border-accent shadow-lg rounded-lg p-4"
                      >
                        <div className="text-center">
                          <div className="text-2xl font-bold text-primary-foreground mb-2">{wordDrop.word}</div>
                          <div className="text-sm text-primary-foreground/90 font-semibold mb-2">{wordDrop.timeRemaining}s</div>
                          <div className="text-xs text-primary-foreground/80">
                            Integrate naturally into your speech
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                  </div>
                )}
              </div>

            {/* Recent Words Section */}
              {completedWords.length > 0 && (
                <div className="mt-8 pt-6 border-t border-border">
                  <h4 className="font-semibold mb-4 text-base text-foreground">Recent Words</h4>
                  <div className="flex flex-wrap gap-3">
                    {completedWords.slice(-6).map((wordDrop, index) => (
                      <Badge
                        key={index}
                        variant="default"
                      className={`flex items-center gap-2 text-sm px-3 py-2 bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-400 hover:bg-green-500/20`}
                      >
                      {wordDrop.integrated && <CheckCircle className="h-4 w-4" />}
                        {wordDrop.word}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }