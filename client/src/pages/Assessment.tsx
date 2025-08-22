import { useState, useEffect, useRef, memo } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useS3Upload } from '@/hooks/useS3Upload';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { Home, Mic } from 'lucide-react';
import { Question, S3Service } from '@/lib/s3Service';
import { replacePlaceholders } from '@/lib/questionUtils';

// Enhanced Circular Timer component that serves as Next button
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
  const totalTime = 60; // Always 60 seconds
  const percentage = ((totalTime - timeLeft) / totalTime) * 100;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  return (
    <div 
      className={`relative w-32 h-32 flex items-center justify-center transition-all duration-300 ${
        isFinishing 
          ? 'cursor-not-allowed opacity-75' 
          : 'cursor-pointer group hover:scale-105'
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
          className={`transition-all duration-300 ${
            isFinishing ? '' : 'group-hover:fill-[#4A9CA6]'
          }`}
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
              <div className="text-lg font-bold text-gray-800 group-hover:text-white transition-colors duration-300 group-hover:hidden">
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
import { useAssessment } from '@/contexts/AssessmentContext';
import { useCameraCapture } from '@/hooks/useCameraCapture';
import { useContinuousAudioRecording } from '@/hooks/useContinuousAudioRecording';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

// Questions will be fetched from API

export default function Assessment() {
  const [, params] = useRoute('/assessment/:assessmentId');
  const [, setLocation] = useLocation();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60); // Fixed 60 seconds for each question
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [assessmentStarted, setAssessmentStarted] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  // Removed responses state - not storing transcripts anymore
  
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
  const { transcript, startListening, stopListening, resetTranscript, hasSupport } = useSpeechRecognition();
  const { fetchQuestions } = useS3Upload();
  const { user, loading: authLoading } = useAuth();

  // Audio verification with retry mechanism
  const verifyAudioWithRetry = async (maxRetries: number = 5, delayMs: number = 2000): Promise<boolean> => {
    if (!user?.email || !params?.assessmentId) {
      console.error('❌ Missing user email or assessment ID for audio verification');
      return false;
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔍 Audio verification attempt ${attempt}/${maxRetries}`);
        
        const verification = await S3Service.verifyAudio({
          user_email: user.email,
          assessment_id: params.assessmentId
        });

        if (verification.data.presence) {
          console.log('✅ Audio verified successfully:', verification.data.audio_key);
          return true;
        } else {
          console.log(`⚠️ Audio not present on attempt ${attempt}/${maxRetries}`);
          
          if (attempt < maxRetries) {
            console.log(`⏳ Waiting ${delayMs}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        }
      } catch (error) {
        console.error(`❌ Audio verification failed on attempt ${attempt}:`, error);
        
        if (attempt < maxRetries) {
          console.log(`⏳ Waiting ${delayMs}ms before retry...`);
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
        console.log('🔄 Authentication still loading, waiting...');
        return;
      }

      if (!user?.email) {
        console.error('❌ User not authenticated');
        setLocation('/login');
        return;
      }

      try {
        setLoadingQuestions(true);
        console.log('📝 Fetching questions for assessment:', params.assessmentId);
        const fetchedQuestions = await fetchQuestions(params.assessmentId);
        setQuestions(fetchedQuestions);
        console.log('✅ Questions loaded:', fetchedQuestions.length, 'questions');
      } catch (error) {
        console.error('❌ Failed to fetch questions:', error);
        // If questions fetch fails, redirect to dashboard
        setLocation('/');
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
      
    console.log('Assessment page mounted - starting continuous recording');
    
    // Start assessment session if not already started
    if (params?.assessmentId && !session.assessmentId) {
      console.log('Starting assessment session for:', params.assessmentId);
        await startSession(params.assessmentId);
    }
    
    startCamera();
      await startContinuousRecording();
    
    // Start speech recognition with a slight delay to ensure everything is initialized
    if (hasSupport) {
      setTimeout(() => {
        startListening();
        console.log('🎤 Speech recognition started for assessment');
      }, 1000);
    }

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
      console.log('Assessment page unmounting - NOT stopping recordings (continue in background)');
      // Don't stop recordings - let them continue in background
    };
      }, [loadingQuestions, questions.length, params?.assessmentId]);

  // Start auto-capture only when S3 is ready
  useEffect(() => {
    if (isS3Ready) {
      console.log('📷 S3 is ready, starting auto-capture...');
      startAutoCapture();
      }
  }, [isS3Ready]);

  // Timer logic
  useEffect(() => {
    if (!isTimerActive || timeLeft <= 0 || isFinishing || isUploading) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsTimerActive(false);
          // Auto-finish when timer reaches 0
          setTimeout(() => {
            if (!isFinishing && !isUploading) {
              console.log('⏰ Timer auto-finishing assessment');
              handleNextQuestion();
            }
          }, 100);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimerActive, timeLeft, currentQuestionIndex, isFinishing, isUploading]);

  // Images are now uploaded automatically in useCameraCapture hook - no need for separate effect

  const handleNextQuestion = async () => {
    if (isFinishing || isUploading) {
      console.log('Already finishing/uploading assessment, ignoring click');
      return;
    }

    try {
      console.log('handleNextQuestion called, currentQuestionIndex:', currentQuestionIndex, 'isLastQuestion:', isLastQuestion);
      
      if (isLastQuestion) {
        setIsFinishing(true);
        console.log('Finishing assessment - stopping all recording activities');
        setIsTimerActive(false);
        
        // Stop all recording activities immediately
        console.log('Stopping auto capture...');
        stopAutoCapture();
        
        console.log('Stopping speech recognition...');
        stopListening();
        
        console.log('Stopping audio recording and uploading to S3...');
        
        // Stop continuous recording
        const finalAudio = await stopContinuousRecording();
        console.log('🎤 Audio recording stopped:', {
          hasAudio: !!finalAudio,
          audioSize: finalAudio?.size || 0,
          audioType: finalAudio?.type || 'none',
          isS3Ready,
          s3Config: session.s3Config
        });
        
        if (finalAudio) {
          console.log('🎵 Final audio received:', {
            size: finalAudio.size,
            type: finalAudio.type,
            isS3Ready,
            hasS3Config: !!session.s3Config,
            hasAudioConfig: !!session.s3Config?.audio
          });

          // Direct upload to S3 only - no local storage
          if (isS3Ready) {
            console.log('🚀 Uploading audio directly to S3...');
            setIsUploading(true);
            try {
              await uploadAudioToS3(finalAudio);
              console.log('✅ Audio upload completed successfully');
              
              // Verify audio was actually uploaded before proceeding
              console.log('🔍 Verifying audio upload...');
              const audioVerified = await verifyAudioWithRetry();
              
              if (audioVerified) {
                console.log('✅ Audio verified - proceeding with logs upload');
                // Now send logs after successful audio verification
                console.log('📤 Sending logs after audio verification...');
                await finishAssessment();
                console.log('✅ Logs sent successfully after audio verification');
              } else {
                console.error('❌ Audio verification failed - audio may be lost');
                // Try to re-upload audio if verification failed
                console.log('🔄 Attempting to re-upload audio...');
                try {
                  await uploadAudioToS3(finalAudio);
                  console.log('✅ Audio re-upload completed');
                  
                  // Verify again
                  const reVerifyAudio = await verifyAudioWithRetry();
                  if (reVerifyAudio) {
                    console.log('✅ Audio re-verified - proceeding with logs');
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
              console.log('📤 Sending logs despite audio upload failure...');
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
        console.log('Force cleanup recording...');
        forceCleanup();
        
        // Only navigate after audio upload and logs are complete
        console.log('✅ Assessment completion successful - navigating to results page...');
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
      setTimeLeft(60); // Always exactly 60 seconds per question
      setIsTimerActive(true);
      resetTranscript(); // Clear previous transcript for new question
      
      // Restart speech recognition for the new question
      if (hasSupport) {
        setTimeout(() => {
          startListening();
        }, 500); // Small delay to ensure transcript is reset
      }
    } catch (error) {
      console.error('Error in handleNextQuestion:', error);
      setIsFinishing(false);
    }
  };

  // Removed handlePreviousQuestion - linear progression only with 60sec time limits

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
            <Button onClick={() => setLocation('/')} className="mt-4">
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
              onClick={() => setLocation('/')}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
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
                Progress: {currentQuestionIndex + 1} of {questions.length}
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
          <h2 className="text-5xl font-bold text-gray-900 dark:text-white mb-6 leading-relaxed max-w-6xl mx-auto">
            {currentQuestion ? replacePlaceholders(currentQuestion.question_text, user) : 'Loading question...'}
          </h2>
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

          {/* Transcript Section - Right Side (Open Space) */}
          <div className="lg:col-span-1 flex flex-col justify-between min-h-[400px]">
            {/* Live Transcript in open space - aligned with camera height */}
            <div className="flex-grow mt-6">
              <p className="text-gray-700 dark:text-gray-300 text-lg leading-relaxed">
                {hasSupport ? (transcript || "....") : "Speech recognition not available in this browser"}
              </p>
            </div>  

            {/* AI Voice Input - Positioned above controls */}
            <div className="flex justify-center mb-6">
              <div className="w-full py-4">
                <div className="relative max-w-xl w-full mx-auto flex items-center flex-col gap-2">
                  {/* Microphone Button */}
                  <div className="w-16 h-16 rounded-xl flex items-center justify-center bg-none">
                    <div
                      className="w-6 h-6 rounded-sm animate-spin bg-gray-800 dark:bg-white cursor-pointer pointer-events-auto"
                      style={{ animationDuration: "3s" }}
                    />
                  </div>

                  {/* Audio Visualizer */}
                  <div className="h-4 w-64 flex items-center justify-center gap-0.5">
                    {[...Array(48)].map((_, i) => (
                      <div
                        key={i}
                        className="w-0.5 rounded-full transition-all duration-300 bg-gray-800/50 dark:bg-white/50 animate-pulse"
                        style={{
                          height: `${20 + Math.random() * 80}%`,
                          animationDelay: `${i * 0.05}s`,
                        }}
                      />
                    ))}
                  </div>

                  {/* Status Text */}
                  <p className="h-4 text-xs text-gray-700 dark:text-white/70">
                    Listening...
                  </p>
                </div>
              </div>
            </div>

            {/* Controls at bottom right - Interactive Circular Timer */}
            <div className="flex flex-col items-end w-full mt-4">
              {/* Interactive Circular Progress Timer that serves as Next/Finish button */}
              <div className="flex flex-col items-center">
                <CircularTimer 
                  timeLeft={timeLeft} 
                  isActive={isTimerActive}
                  onClick={handleNextQuestion}
                  isFinishing={isFinishing}
                  isLastQuestion={currentQuestionIndex >= questions.length - 1}
                  isUploading={isUploading}
                />
                
                {/* Question count centered below the circular progress */}
                <div className="mt-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Question {currentQuestionIndex + 1} of {questions.length}
                  </p>
                </div>
                

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}