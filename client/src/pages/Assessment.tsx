import { useState, useEffect, useRef, memo } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useS3Upload } from '@/hooks/useS3Upload';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { Home, Mic } from 'lucide-react';
import { Question } from '@/lib/s3Service';
import { replacePlaceholders } from '@/lib/questionUtils';
import { useBackgroundUploadContext } from '@/contexts/BackgroundUploadProvider';
// Enhanced Circular Timer component matching the reference design
const CircularTimer = memo(({ timeLeft, isActive }: { timeLeft: number; isActive: boolean }) => {
  const totalTime = 60; // Always 60 seconds
  const percentage = ((totalTime - timeLeft) / totalTime) * 100;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  return (
    <div className="relative w-32 h-32 flex items-center justify-center">
      <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
        {/* Background circle - light gray */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          stroke="#e5e7eb"
          strokeWidth="8"
          fill="#f8fafc"
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
        <div className="text-xl font-bold text-gray-800">
          {minutes}:{seconds.toString().padStart(2, '0')}
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
  // Removed responses state - not storing transcripts anymore
  
  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  
  const { session, finishAssessment, addTranscript, startSession, isS3Ready, uploadAudioToS3 } = useAssessment();
  const { videoRef, startCamera, startAutoCapture, stopAutoCapture, capturedImages } = useCameraCapture();
  const { startContinuousRecording, stopContinuousRecording, isRecording, recordingDuration, forceCleanup } = useContinuousAudioRecording();
  const { transcript, startListening, stopListening, resetTranscript, hasSupport } = useSpeechRecognition();
  const { fetchQuestions } = useS3Upload();
  const { user, loading: authLoading } = useAuth();
  const { saveAudioLocally, forceUploadNow } = useBackgroundUploadContext();



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
    
    if (hasSupport) {
      startListening();
    }

    // Start timer for first question
    setIsTimerActive(true);
      setAssessmentStarted(true);
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
    if (!isTimerActive || timeLeft <= 0 || isFinishing) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsTimerActive(false);
          // Use setTimeout to avoid state conflicts
          setTimeout(() => {
            if (!isFinishing) {
              handleNextQuestion();
            }
          }, 100);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimerActive, timeLeft, currentQuestionIndex, isFinishing]);

  // Images are now uploaded automatically in useCameraCapture hook - no need for separate effect

  const handleNextQuestion = async () => {
    if (isFinishing) {
      console.log('Already finishing assessment, ignoring click');
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
          // Always save audio locally first
          if (user?.email && params?.assessmentId) {
            console.log('💾 Saving audio locally before upload...');
            try {
              const audioId = await saveAudioLocally(finalAudio, params.assessmentId, user.email);
              console.log('✅ Audio saved locally with ID:', audioId);
              
              // Force immediate background upload attempt
              console.log('🚀 Triggering immediate upload attempt...');
              setTimeout(() => {
                forceUploadNow();
              }, 1000); // Small delay to ensure local save completes
              
            } catch (localSaveError) {
              console.error('❌ Failed to save audio locally:', localSaveError);
            }
          } else {
            console.error('❌ Missing user email or assessment ID for local save');
          }

          // Legacy direct upload as fallback (will be removed later)
          if (isS3Ready) {
            console.log('⚠️ Also attempting direct upload as fallback...');
            try {
              await uploadAudioToS3(finalAudio);
              console.log('✅ Direct upload also successful');
            } catch (uploadError) {
              console.error('❌ Direct upload failed (background upload will retry):', uploadError);
        }
          }
        } else {
          console.error('❌ No audio blob received from stopRecording()');
        }
        
        // Force cleanup any remaining recording processes
        console.log('Force cleanup recording...');
        forceCleanup();
        
        console.log('Calling finishAssessment...');
            await finishAssessment();
        
        console.log('Navigating to results page...');
        // Navigate to results
        setLocation(`/results/${params?.assessmentId}`);
        return;
      }

      // Move to next question
      const nextIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIndex);
      setTimeLeft(60); // Always exactly 60 seconds per question
      setIsTimerActive(true);
      resetTranscript(); // Clear previous transcript for new question
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

        {/* Question Header */}
        <div className="text-center mb-8">
          <div className="mb-4">
            <h1 className="text-xl font-semibold text-gray-800 dark:text-white">
              Question {currentQuestionIndex + 1} of {questions.length}
            </h1>
          </div>
          
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 leading-relaxed max-w-4xl mx-auto">
            {currentQuestion ? replacePlaceholders(currentQuestion.question_text, user) : 'Loading question...'}
          </h2>
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-8">
          {/* Video Section - Left Side */}
          <div className="lg:col-span-1">
            <div className="relative bg-gray-900 rounded-xl overflow-hidden shadow-lg" style={{ aspectRatio: '4/3' }}>
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
            {/* Live Transcript in open space */}
            <div className="flex-grow">
              <p className="text-gray-700 dark:text-gray-300 text-lg leading-relaxed">
                {hasSupport ? (transcript || "Start speaking to see your transcript here...") : "Speech recognition not available in this browser"}
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

            {/* Controls at bottom right - Progress Timer and Next Button */}
            <div className="flex items-center justify-between w-full mt-4">
              {/* Circular Progress Timer */}
              <CircularTimer timeLeft={timeLeft} isActive={isTimerActive} />
              
              {/* Next/Finish Button - positioned at the right end */}
              {currentQuestionIndex < questions.length - 1 ? (
                <Button 
                  onClick={handleNextQuestion}
                  disabled={isFinishing}
                  className="flex items-center space-x-2 bg-gray-400 hover:bg-gray-500 text-white px-6 py-2 rounded-lg"
                >
                  <span>Submit answer</span>
                </Button>
              ) : (
                <Button 
                  onClick={handleNextQuestion}
                  className="flex items-center space-x-2 bg-gray-400 hover:bg-gray-500 text-white px-6 py-2 rounded-lg"
                  disabled={isFinishing}
                >
                  {isFinishing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Finishing...</span>
                    </>
                  ) : (
                    <>
                      <span>Finish Assessment</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}