import { useState, useEffect, useRef, memo } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Button } from "@sparrowengg/twigs-react";
import { Card } from '@/components/ui/card';
import { useS3Upload } from '@/hooks/useS3Upload';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { Home, Mic, Info } from 'lucide-react';
import { Question, S3Service } from '@/lib/s3Service';
import { replacePlaceholders } from '@/lib/questionUtils';
import { useClarity } from '@/hooks/useClarity';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/enhanced-tooltip';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useCameraCapture } from '@/hooks/useCameraCapture';
import { useContinuousAudioRecording } from '@/hooks/useContinuousAudioRecording';
import { useBehaviorMonitoring } from '@/hooks/useBehaviorMonitoring';
import { WarningBadge } from '@/components/WarningBadge';

// Function to highlight specific words in question text for rapid-fire assessments
const highlightWords = (text: string): JSX.Element => {
  if (!text) return <span>{text}</span>;

  const highlightedWords = ['like', 'because'];

  // Use a more sophisticated approach with word boundaries
  const parts = text.split(/(\b\w+\b|\s+|[.,!?;:])/);

  return (
    <>
      {parts.map((part, index) => {
        const cleanPart = part.trim().toLowerCase();

        if (highlightedWords.includes(cleanPart)) {
          return (
            <span key={index} style={{ color: '#4A9CA6' }}>
              {part}
            </span>
          );
        }

        return (
          <span key={index}>
            {part}
          </span>
        );
      })}
    </>
  );
};

// True Pie Chart Timer component for rapid-fire assessment - uses conic-gradient for filled pie
const LargeCircularTimer = memo(({
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
  const progress = (timeLeft / totalTime) * 100; // Remaining time percentage
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  
  const size = 256;

  return (
    <div
      className={`relative flex items-center justify-center ${
        isFinishing
          ? 'cursor-not-allowed opacity-75'
          : 'cursor-pointer group'
      }`}
      style={{ width: size, height: size }}
      onClick={isFinishing ? undefined : onClick}
    >
      {/* Pie Chart using conic-gradient */}
      {/* CSS transition duration matches the 250ms timer interval for optimal smoothness */}
      <div
        className="rounded-full transition-all duration-250 ease-out"
        style={{
          width: size,
          height: size,
          background: `conic-gradient(#4A9CA6 ${progress}%, transparent 0)`,
          transform: 'rotate(-90deg)', // Start from top (12 o'clock)
        }}
      />
      
      <div className="absolute inset-0 flex items-center justify-center" style={{ pointerEvents: 'none' }}>
        <div className="text-center">
          {/* Show finishing state when finishing, otherwise show hover text */}
          {isFinishing ? (
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mb-2"></div>
              <span className="text-xl text-teal-600 font-medium">Finishing...</span>
            </div>
          ) : (
            <div className="hidden group-hover:block text-2xl font-bold text-white">
              <div className="flex flex-col items-center">
                <span className="text-2xl">{isLastQuestion ? 'Finish' : 'Next'}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default function RapidFireAssessment() {
  const [, params] = useRoute('/rapid-fire/:assessmentId');
  const [, setLocation] = useLocation();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60); // Will be set dynamically from backend
  const [questionTimeLimit, setQuestionTimeLimit] = useState(60); // Store the time limit from backend
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [assessmentStarted, setAssessmentStarted] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Microsoft Clarity tracking
  const { trackAssessmentEvent, trackUserAction, setUserId, setTag } = useClarity(true, 'Rapid Fire Assessment');
  
  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  
  const { 
    session, 
    finishAssessment, 
    addTranscript, 
    startSession, 
    isS3Ready, 
    uploadAudioToS3,
    startQuestionLog,
    endQuestionLog,
    handleQuestionTransition
  } = useAssessment();
  const { videoRef, startCamera, startAutoCapture, stopAutoCapture, capturedImages } = useCameraCapture();
  const { startContinuousRecording, stopContinuousRecording, isRecording, recordingDuration, forceCleanup } = useContinuousAudioRecording();
  const { fetchQuestions } = useS3Upload();
  const { user, loading: authLoading } = useAuth();
  const { isMonitoring, stopMonitoring, flagCount, showWarning, warningMessage } = useBehaviorMonitoring({
    enabled: true,
    delayBeforeStart: 25000, // Start monitoring after 15 seconds (when first image is captured)
    pollingInterval: 20000, // Check every 10 seconds
  });

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

  // Fetch questions when component mounts and authentication is ready
  useEffect(() => {
    const fetchAssessmentQuestions = async () => {
      if (!params?.assessmentId) {
        console.error('No assessment ID provided');
        return;
      }

      // Wait for authentication to complete
      if (authLoading) {
        
        return;
      }

      if (!user?.email) {
        console.error('❌ User not authenticated');
        setLocation('/login');
        return;
      }

      // CRITICAL: Validate that assessment exists in current test before fetching questions
      const selectedTestId = localStorage.getItem('selectedTestId');
      if (!selectedTestId) {
        console.error('❌ No test selected - redirecting to test selection');
        setLocation('/test-selection');
        return;
      }

      try {
        setLoadingQuestions(true);
        
        // Validate assessment exists in current test
        console.log('🔍 Rapid Fire Assessment: Fetching test assessments with Firebase auth');
        
        const { AuthenticatedApiService } = await import('@/lib/authenticatedApiService');
        const testData = await AuthenticatedApiService.getTestAssessments(selectedTestId);
        const testAssessments = testData.assessments || [];
        const assessmentInTest = testAssessments.find((a: any) => a.assessment_id === params.assessmentId);
        
        if (!assessmentInTest) {
          console.error(`❌ Assessment ${params.assessmentId} not found in test ${selectedTestId}`);
          setLocation('/');
          return;
        }

        console.log(`✅ Assessment ${params.assessmentId} validated in test ${selectedTestId}`);
        
        // Set the time limit from backend response
        const timeLimitFromBackend = assessmentInTest.time_limit || 60; // Default to 60 if not provided
        setQuestionTimeLimit(timeLimitFromBackend);
        setTimeLeft(timeLimitFromBackend);
        
        console.log(`⏱️ Using time limit from backend: ${timeLimitFromBackend} seconds for assessment type: ${assessmentInTest.type}`);
        
        // Now fetch questions using the assessment type
        const fetchedQuestions = await fetchQuestions(params.assessmentId, assessmentInTest.type);
        setQuestions(fetchedQuestions);
        
      } catch (error) {
        console.error('❌ Failed to fetch questions:', error);
        // If questions fetch fails, redirect to dashboard
        setLocation('/test-selection');
      } finally {
        setLoadingQuestions(false);
      }
    };

    fetchAssessmentQuestions();
  }, [params?.assessmentId, fetchQuestions, setLocation, authLoading, user?.email]);

  // Initialize assessment once questions are loaded
  useEffect(() => {
    const initializeAssessment = async () => {
      if (loadingQuestions || questions.length === 0) return;
      
    
    
    // Start assessment session if not already started
    if (params?.assessmentId && !session.assessmentId) {
      
        await startSession(params.assessmentId);
    }
    
    startCamera();
      await startContinuousRecording();
    
    // Start timer for first question
    setIsTimerActive(true);
    setAssessmentStarted(true);
    
    
    // Start logging for the first question
    if (questions.length > 0) {
      startQuestionLog(questions[0].question_text, questions[0].question_id, 0);
    }
    };

    initializeAssessment();

    return () => {
      
      // Don't stop recordings - let them continue in background
    };
      }, [loadingQuestions, questions.length, params?.assessmentId]);

  // Start auto-capture only when S3 is ready
  useEffect(() => {
    if (isS3Ready) {
      
      startAutoCapture();
      }
  }, [isS3Ready]);

  // Timer logic - updated to quarter-second intervals for smoother pie chart animation
  // Previously updated every 1000ms (1 second), now updates every 250ms (0.25 seconds)
  // This provides 4x smoother animation for the circular pie chart timer
  useEffect(() => {
    if (!isTimerActive || timeLeft <= 0 || isFinishing || isUploading) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0.25) {
          setIsTimerActive(false);
          // Auto-finish when timer reaches 0
          setTimeout(() => {
            if (!isFinishing && !isUploading) {

              handleNextQuestion();
            }
          }, 100);
          return 0;
        }
        return prev - 0.25; // Decrement by quarter second
      });
    }, 250); // Update every quarter second for smooth animation

    return () => clearInterval(interval);
  }, [isTimerActive, timeLeft, currentQuestionIndex, isFinishing, isUploading]);

  // Images are now uploaded automatically in useCameraCapture hook - no need for separate effect

  const handleNextQuestion = async () => {
    if (isFinishing || isUploading) {
      
      return;
    }

    try {
      
      
      if (isLastQuestion) {
        setIsFinishing(true);
        
        setIsTimerActive(false);
        
        // Stop all recording activities immediately
        
        stopAutoCapture();
        
        
        
        // Stop continuous recording
        const finalAudio = await stopContinuousRecording();
        
        
        if (finalAudio) {
          

          // Direct upload to S3 only - no local storage
          if (isS3Ready) {
            
            setIsUploading(true);
            try {
              await uploadAudioToS3(finalAudio);
              
              
              // Verify audio was actually uploaded before proceeding
              
              const audioVerified = await verifyAudioWithRetry();
              
              if (audioVerified) {
                
                // Now send logs after successful audio verification
                
                await finishAssessment();
                
              } else {
                console.error('❌ Audio verification failed - audio may be lost');
                // Try to re-upload audio if verification failed
                
                try {
                  await uploadAudioToS3(finalAudio);
                  
                  
                  // Verify again
                  const reVerifyAudio = await verifyAudioWithRetry();
                  if (reVerifyAudio) {
                    
                    await finishAssessment();
                  } else {
                    console.error('❌ Audio verification still failing after re-upload');
                    // Continue with logs even if audio fails
                    await finishAssessment();
                  }
                } catch (reUploadError) {
                  console.error('❌ Audio re-upload failed:', reUploadError);
                  // Continue with logs even if audio fails
                  await finishAssessment();
                }
              }
              
            } catch (uploadError) {
              console.error('❌ Audio upload failed:', uploadError);
              // Still try to send logs even if audio upload fails
              
              await finishAssessment();
            } finally {
              setIsUploading(false);
            }
          } else {
            console.warn('⚠️ S3 not ready, skipping audio upload', {
              isS3Ready,
              s3Config: session.s3Config
            });
            // Send logs even without audio upload
            await finishAssessment();
          }
        } else {
          console.error('❌ No audio blob received from stopRecording()');
          // Send logs even without audio
          await finishAssessment();
        }
        
        // Force cleanup any remaining recording processes
        
        forceCleanup();
        
        // Stop behavior monitoring
        stopMonitoring();
        
        // Only navigate after audio upload and logs are complete
        
        setLocation(`/results/${params?.assessmentId}`);
        return;
      }

      // Move to next question
      const nextIndex = currentQuestionIndex + 1;
      const nextQuestion = questions[nextIndex];
      
      // Handle question transition with logging
      if (nextQuestion) {
        handleQuestionTransition(nextQuestion.question_text, nextQuestion.question_id, nextIndex);
      }
      
      setCurrentQuestionIndex(nextIndex);
      setTimeLeft(questionTimeLimit); // Use dynamic time limit from backend
      setIsTimerActive(true);
      
    } catch (error) {
      console.error('Error in handleNextQuestion:', error);
      setIsFinishing(false);
    }
  };

  if (loadingQuestions) {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">Loading questions...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!currentQuestion || questions.length === 0) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-300">No questions available for this assessment.</p>
            <Button onClick={() => setLocation('/test-selection')} className="mt-4">
              Return to Dashboard
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header with Home Button (only when assessment hasn't started) */}
        {!assessmentStarted && (
          <div className="mb-6">
            <Button
              onClick={() => setLocation('/test-selection')}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 px-6 py-3"
            >
              <Home className="h-4 w-4" />
              Home
            </Button>
          </div>
        )}

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Question {currentQuestionIndex + 1} of {questions.length}
              </span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {Math.round(((currentQuestionIndex + 1) / questions.length) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-[#4A9CA6] h-3 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Question Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6 leading-relaxed max-w-6xl mx-auto">
            {currentQuestion ? highlightWords(replacePlaceholders(currentQuestion.question_text, user)) : 'Loading question...'}
          </h2>
          
          {/* Behavior Warning Badge */}
          <WarningBadge
            isVisible={showWarning}
            message={warningMessage}
            duration={5000}
            className="mt-4"
          />
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-8 mt-8">
          {/* Video Section - Left Side */}
          <div className="lg:col-span-1">
            <div className="relative bg-gray-900 rounded-xl overflow-hidden shadow-lg mt-6" style={{ aspectRatio: '4/3' }}>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
                style={{ backgroundColor: '#111827' }}
            />
            {/* Recording indicator */}
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
            </div>
          </div>

          {/* Large Timer Section - Right Side (Replaces transcript area) */}
          <div className="lg:col-span-1 flex flex-col justify-center items-center min-h-[400px]">
            {/* Large Interactive Circular Timer */}
            <div className="flex flex-col items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <LargeCircularTimer 
                      timeLeft={timeLeft} 
                      totalTime={questionTimeLimit}
                      isActive={isTimerActive}
                      onClick={handleNextQuestion}
                      isFinishing={isFinishing}
                      isLastQuestion={currentQuestionIndex >= questions.length - 1}
                      isUploading={isUploading}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p>Click to move to the next question. Once moved, you cannot go back.</p>
                </TooltipContent>
              </Tooltip>
              
              {/* Timer display below the circular progress */}
              <div className="mt-6">
                <p className="text-3xl font-medium text-gray-400 dark:text-gray-500">
                  {Math.floor(timeLeft / 60)}:{Math.floor(timeLeft % 60).toString().padStart(2, '0')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
