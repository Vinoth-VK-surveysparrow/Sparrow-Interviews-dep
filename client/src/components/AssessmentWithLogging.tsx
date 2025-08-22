import React, { useState, useEffect } from 'react';
import { useAssessmentLogger } from '@/hooks/useAssessmentLogger';

interface Question {
    id: number;
    question: string;
    type: string;
}

interface AssessmentWithLoggingProps {
    userEmail: string;
    assessmentId: string;
    questions: Question[];
    onComplete?: () => void;
}

export const AssessmentWithLogging: React.FC<AssessmentWithLoggingProps> = ({
    userEmail,
    assessmentId,
    questions,
    onComplete
}) => {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [isCompleting, setIsCompleting] = useState(false);

    const {
        startAssessment,
        startQuestion,
        endQuestion,
        endAssessment,
        handleQuestionTransition,
        getCurrentLogs,
        getFormattedLogs,
        getSessionInfo,
        clearSession,
        debugState
    } = useAssessmentLogger();

    const currentQuestion = questions[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex === questions.length - 1;

    // Start assessment when component mounts
    useEffect(() => {
        startAssessment(assessmentId, userEmail);
        
        if (currentQuestion) {
            startQuestion(currentQuestion.question, currentQuestion.id.toString(), 0);
            console.log('📊 Assessment started with first question');
        }
    }, []); // Only run once on mount

    // Handle answer change
    const handleAnswerChange = (value: string) => {
        setAnswers(prev => ({
            ...prev,
            [currentQuestion.id]: value
        }));

        console.log('📝 Answer changed for question:', currentQuestion.id, 'Length:', value.length);
    };

    // Handle next button click
    const handleNext = async () => {
        if (isLastQuestion) {
            await handleComplete();
        } else {
            const nextQuestion = questions[currentQuestionIndex + 1];

            // Log the transition
            handleQuestionTransition(
                nextQuestion.question, 
                nextQuestion.id.toString(), 
                currentQuestionIndex + 1
            );

            // Move to next question
            setCurrentQuestionIndex(prev => prev + 1);

            console.log('➡️ Moved to next question:', nextQuestion.id);
        }
    };

    // Handle auto advance (e.g., timer-based)
    const handleAutoAdvance = () => {
        if (isLastQuestion) {
            handleComplete();
        } else {
            const nextQuestion = questions[currentQuestionIndex + 1];

            // Log the auto transition
            handleQuestionTransition(
                nextQuestion.question, 
                nextQuestion.id.toString(), 
                currentQuestionIndex + 1
            );

            // Move to next question
            setCurrentQuestionIndex(prev => prev + 1);

            console.log('⏰ Auto-advanced to question:', nextQuestion.id);
        }
    };

    // Handle assessment completion
    const handleComplete = async () => {
        setIsCompleting(true);

        try {
            console.log('🏁 Completing assessment...');

            // End the session and get final logs
            const finalLogs = endAssessment();

            console.log('✅ Assessment completed with logs:', finalLogs);
            console.log('📊 Session info:', getSessionInfo());
            console.log('📤 Final logs will be uploaded to /log-upload endpoint by the assessment context');

            onComplete?.();
        } catch (error) {
            console.error('❌ Error completing assessment:', error);
        } finally {
            setIsCompleting(false);
        }
    };

    // Example of timer-based auto advance (uncomment to enable)
    /*
    useEffect(() => {
      const timer = setTimeout(() => {
        handleAutoAdvance();
      }, 30000); // 30 seconds per question
  
      return () => clearTimeout(timer);
    }, [currentQuestionIndex]);
    */

    if (!currentQuestion) {
        return <div>Loading questions...</div>;
    }

    return (
        <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
            <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">Assessment Question</h2>
                    <span className="text-sm text-gray-500">
                        {currentQuestionIndex + 1} of {questions.length}
                    </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                    />
                </div>
            </div>

            <div className="mb-6">
                <h3 className="text-lg font-medium mb-4">
                    Question {currentQuestion.id}: {currentQuestion.question}
                </h3>

                <textarea
                    value={answers[currentQuestion.id] || ''}
                    onChange={(e) => handleAnswerChange(e.target.value)}
                    placeholder="Type your answer here..."
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={4}
                    onFocus={() => console.log('📝 Answer field focused for question:', currentQuestion.id)}
                    onBlur={() => console.log('📝 Answer field blurred for question:', currentQuestion.id)}
                />
            </div>

            <div className="flex justify-between items-center">
                <button
                    onClick={() => console.log('❓ Help requested for question:', currentQuestion.id)}
                    className="px-4 py-2 text-blue-600 hover:text-blue-800 transition-colors"
                >
                    Need Help?
                </button>

                <div className="space-x-3">
                    {/* Debug button */}
                    <button
                        onClick={debugState}
                        className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
                    >
                        Debug Logs
                    </button>

                    {/* Example auto-advance button for testing */}
                    <button
                        onClick={handleAutoAdvance}
                        className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors"
                    >
                        Auto Advance (Test)
                    </button>

                    <button
                        onClick={handleNext}
                        disabled={isCompleting}
                        className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isCompleting ? 'Completing...' : isLastQuestion ? 'Complete Assessment' : 'Next Question'}
                    </button>
                </div>
            </div>

            {/* Debug info (remove in production) */}
            <div className="mt-6 p-3 bg-gray-100 rounded text-xs">
                <strong>Debug Info:</strong>
                <br />
                Current Question ID: {currentQuestion.id}
                <br />
                Answers Count: {Object.keys(answers).length}
                <br />
                Current Logs: {getCurrentLogs().length}
                <br />
                Session Info: {getSessionInfo() ? 'Active' : 'Inactive'}
            </div>
        </div>
    );
};