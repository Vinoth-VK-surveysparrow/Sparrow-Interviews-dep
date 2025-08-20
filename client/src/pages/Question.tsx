import { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CircularTimer } from '@/components/CircularTimer';
import { useCameraCapture } from '@/hooks/useCameraCapture';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useAuth } from '@/hooks/useAuth';
import { replacePlaceholders } from '@/lib/questionUtils';

const questions = [
  {
    id: 1,
    text: "Explain the difference between React functional components and class components. When would you choose one over the other, and what are the advantages of using hooks?"
  },
  {
    id: 2,
    text: "Describe how you would optimize a React application's performance. What tools and techniques would you use?"
  },
  {
    id: 3,
    text: "How do you handle state management in large React applications? Compare different approaches like Context API, Redux, and Zustand."
  },
  {
    id: 4,
    text: "Explain the concept of server-side rendering (SSR) and its benefits. How would you implement it with React?"
  },
  {
    id: 5,
    text: "Describe your approach to testing React applications. What testing libraries and strategies do you prefer?"
  }
];

export default function Question() {
  const [, params] = useRoute('/question/:assessmentId/:questionNumber');
  const [, setLocation] = useLocation();
  const [isTimerActive, setIsTimerActive] = useState(true);
  
  const currentQuestionNumber = parseInt(params?.questionNumber || '1');
  const currentQuestion = questions[currentQuestionNumber - 1];
  
  const { videoRef, startCamera, startAutoCapture, stopAutoCapture, captureImage, capturedImages } = useCameraCapture();
  const { transcript, startListening, resetTranscript, hasSupport } = useSpeechRecognition();
  const { user } = useAuth();



  useEffect(() => {
    console.log('Question page mounted, starting camera and capture');
    startCamera();
    
    // Delay auto capture to ensure video is ready
    setTimeout(() => {
      startAutoCapture();
    }, 2000);
    
    if (hasSupport) {
      startListening();
    }

    return () => {
      console.log('Question page unmounting, stopping auto capture');
      stopAutoCapture();
    };
  }, [currentQuestionNumber]); // Re-run when question changes

  const handleTimeUp = () => {
    setIsTimerActive(false);
    nextQuestion();
  };

  const nextQuestion = () => {
    resetTranscript();
    
    if (currentQuestionNumber >= 5) {
      setLocation(`/results/${params?.assessmentId}`);
    } else {
      setLocation(`/question/${params?.assessmentId}/${currentQuestionNumber + 1}`);
    }
  };

  const handleNextQuestion = () => {
    setIsTimerActive(false);
    nextQuestion();
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-dark-primary px-4 py-8">
      <div className="w-full max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Question {currentQuestionNumber} of 5
          </h2>
          
          <CircularTimer 
            duration={60}
            onTimeUp={handleTimeUp}
            isActive={isTimerActive}
          />
        </div>

        {/* Main Content - Question and Video */}
        <div className="flex flex-col lg:flex-row items-center justify-center gap-12 mb-8">
          {/* Question Section */}
          <div className="flex-1 max-w-2xl">
            <div className="bg-white dark:bg-dark-secondary rounded-2xl p-8 shadow-lg border border-gray-200 dark:border-gray-700 text-center">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                Question
              </h3>
              <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                {currentQuestion?.text ? replacePlaceholders(currentQuestion.text, user) : ''}
              </p>
            </div>
          </div>

          {/* User Video Section */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="w-80 h-80 bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border-4 border-gray-200 dark:border-gray-600">
                <video 
                  ref={videoRef}
                  className="w-full h-full object-cover" 
                  autoPlay 
                  muted
                  playsInline
                />
              </div>
              {/* Recording indicator */}
              <div className="absolute top-4 right-4 flex items-center bg-red-500 text-white px-3 py-1 rounded-full text-sm">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse mr-2"></div>
                REC
              </div>
            </div>
            <p className="mt-4 text-lg font-medium text-gray-900 dark:text-white">You</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Recording in progress • Images: {capturedImages.length}
            </p>
            <Button 
              onClick={() => captureImage()}
              size="sm"
              variant="outline"
              className="mt-2"
            >
              Manual Capture
            </Button>
          </div>
        </div>

        {/* Live Transcript */}
        <div className="bg-white dark:bg-dark-secondary rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-center">
            Live Transcript
          </h3>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 min-h-[100px] text-center">
            <p className="text-gray-700 dark:text-gray-300">
              {transcript || "...."}
            </p>
            <div className="mt-3 flex items-center justify-center">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2"></div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {hasSupport ? "Listening..." : "Speech recognition not supported"}
              </span>
            </div>
          </div>
        </div>

        {/* Next Button */}
        <div className="flex justify-center">
          <Button 
            onClick={handleNextQuestion}
            className="bg-teal-primary text-white py-3 px-8 rounded-full font-medium hover:bg-teal-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-dark-primary shadow-lg"
            size="lg"
          >
            {currentQuestionNumber >= 5 ? 'Complete Assessment' : 'Next Question'}
          </Button>
        </div>
      </div>
    </main>
  );
}
