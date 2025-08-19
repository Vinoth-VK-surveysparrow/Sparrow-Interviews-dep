import { useState, useEffect, useRef } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useS3Upload } from '@/hooks/useS3Upload';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { Home } from 'lucide-react';
// Circular Timer component with progress circle - Fixed for 60 seconds
const CircularTimer = ({ timeLeft, isActive }: { timeLeft: number; isActive: boolean }) => {
  const totalTime = 60; // Always 60 seconds
  const percentage = ((totalTime - timeLeft) / totalTime) * 100;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const circumference = 2 * Math.PI * 45; // radius = 45
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r="45"
          stroke="currentColor"
          strokeWidth="4"
          fill="transparent"
          className="text-gray-200 dark:text-gray-700"
        />
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r="45"
          stroke="currentColor"
          strokeWidth="4"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={`transition-all duration-1000 ${isActive ? 'text-teal-600' : 'text-gray-400'}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className={`text-sm font-bold ${isActive ? 'text-teal-600' : 'text-gray-500'}`}>
          {minutes}:{seconds.toString().padStart(2, '0')}
        </div>
      </div>
    </div>
  );
};
import { useAssessment } from '@/contexts/AssessmentContext';
import { useCameraCapture } from '@/hooks/useCameraCapture';
import { useAudioRecording } from '@/hooks/useAudioRecording';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

// Sample questions for the assessment - all with 60-second time limit
const questions = [
  {
    id: 1,
    text: "Tell me about yourself and your professional background.",
    timeLimit: 60
  },
  {
    id: 2,
    text: "Describe a challenging project you've worked on and how you overcame the obstacles.",
    timeLimit: 60
  },
  {
    id: 3,
    text: "What are your strongest technical skills and how do you stay updated with new technologies?",
    timeLimit: 60
  },
  {
    id: 4,
    text: "Describe a time when you had to work under pressure. How did you handle it?",
    timeLimit: 60
  },
  {
    id: 5,
    text: "Where do you see yourself in 5 years and what are your career goals?",
    timeLimit: 60
  }
];

export default function Assessment() {
  const [, params] = useRoute('/assessment/:assessmentId');
  const [, setLocation] = useLocation();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60); // Fixed 60 seconds for each question
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  // Removed responses state - not storing transcripts anymore
  
  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  
  const { session, finishAssessment, addTranscript, startSession, isS3Ready, uploadAudioToS3 } = useAssessment();
  const { videoRef, startCamera, startAutoCapture, stopAutoCapture, capturedImages } = useCameraCapture();
  const { startRecording, stopRecording, isRecording, forceCleanup } = useAudioRecording();
  const { transcript, startListening, stopListening, resetTranscript, hasSupport } = useSpeechRecognition();

  // Initialize everything once when component mounts
  useEffect(() => {
    const initializeAssessment = async () => {
      console.log('Assessment page mounted - starting continuous recording');
      
      // Start assessment session if not already started
      if (params?.assessmentId && !session.assessmentId) {
        console.log('Starting assessment session for:', params.assessmentId);
        await startSession(params.assessmentId);
      }
      
      startCamera();
      startRecording();
      
      if (hasSupport) {
        startListening();
      }

      // Start timer for first question
      setIsTimerActive(true);
    };

    initializeAssessment();

    return () => {
      console.log('Assessment page unmounting - NOT stopping recordings (continue in background)');
      // Don't stop recordings - let them continue in background
    };
  }, []);

  // Start auto-capture only when S3 is ready
  useEffect(() => {
    if (isS3Ready) {
      console.log('📷 S3 is ready, starting auto-capture...');
      startAutoCapture();
    } else {
      console.log('📷 S3 not ready yet, waiting...');
    }
  }, [isS3Ready, startAutoCapture]);

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
        
        // Stop recording
        const finalAudio = await stopRecording();
        if (finalAudio && isS3Ready) {
          console.log('Final audio blob size:', finalAudio.size, '- uploading to S3...');
          try {
                         // Direct upload to S3 - wait for completion
             await uploadAudioToS3(finalAudio);
            console.log('Audio uploaded successfully to S3');
          } catch (uploadError) {
            console.error('Failed to upload audio to S3:', uploadError);
          }
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

  if (!currentQuestion) {
    return <div>No questions available</div>;
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Question Header */}
      <div className="flex items-center justify-between mb-8">
        {/* Home Button */}
        <Button
          onClick={() => setLocation('/')}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <Home className="h-4 w-4" />
          Home
        </Button>

        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Question {currentQuestionIndex + 1} of {questions.length}
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full flex-1 max-w-xs">
            <div 
              className="h-full bg-teal-600 rounded-full transition-all duration-300"
              style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* S3 Status */}
      {!isS3Ready && (
        <Alert className="mb-4 bg-yellow-50 border-yellow-200">
          <AlertDescription className="text-yellow-800">
            Setting up cloud storage...
          </AlertDescription>
        </Alert>
      )}

      {isS3Ready && (
        <Alert className="mb-4 bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">
            Recording system ready - capturing audio and images
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-8">
        {/* Question Section - Reduced width */}
        <div className="space-y-6">
          <Card className="p-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
              {currentQuestion.text}
            </h2>
          </Card>

          {/* Transcription and Timer Section - Below Question */}
          <div className="flex flex-col items-center space-y-6">
            {/* Circular Timer */}
            <CircularTimer
              timeLeft={timeLeft}
              isActive={isTimerActive}
            />
            
            {/* Live Transcription - Display only, no storage */}
            {hasSupport && (
              <div className="text-center max-w-full">
                <p className="text-gray-900 dark:text-white text-lg leading-relaxed min-h-[60px]">
                  {transcript || "Start speaking..."}
                </p>
              </div>
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-end items-center mt-6">
            <Button
              onClick={handleNextQuestion}
              disabled={isFinishing}
              className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50"
            >
              {isFinishing ? 'Finishing...' : (isLastQuestion ? 'Finish Assessment' : 'Next Question')}
            </Button>
          </div>
        </div>

        {/* Camera Section - Aligned with question height, increased width */}
        <div className="space-y-6">
          <div className="relative bg-gray-900 dark:bg-gray-800 rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            {/* Recording indicator */}
            <div className="absolute top-4 right-4 flex items-center bg-red-500 text-white px-3 py-1 rounded-full text-sm">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse mr-2"></div>
              REC
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}