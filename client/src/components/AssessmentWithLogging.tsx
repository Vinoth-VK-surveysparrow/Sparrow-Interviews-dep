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
            
        }
    }, []); // Only run once on mount

    // Handle answer change
    const handleAnswerChange = (value: string) => {
        setAnswers(prev => ({
            ...prev,
            [currentQuestion.id]: value
        }));

        
    };

    // Handle previous button click
    const handlePrevious = () => {
        if (currentQuestionIndex > 0) {
            const prevQuestion = questions[currentQuestionIndex - 1];
            
            // Log the transition
            handleQuestionTransition(
                prevQuestion.question, 
                prevQuestion.id.toString(), 
                currentQuestionIndex - 1
            );

            // Move to previous question
            setCurrentQuestionIndex(prev => prev - 1);
        }
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

            
        }
    };

    // Handle assessment completion
    const handleComplete = async () => {
        setIsCompleting(true);

        try {
            

            // End the session and get final logs
            const finalLogs = endAssessment();

            
            
            

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
                    onFocus={() => startQuestion(currentQuestion.question, currentQuestion.id.toString(), currentQuestionIndex)}
                />
            </div>

            <div className="flex justify-between">
                <button
                    onClick={handlePrevious}
                    disabled={currentQuestionIndex === 0}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md disabled:opacity-50 hover:bg-gray-400"
                >
                    Previous
                </button>

                <button
                    onClick={handleNext}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                    {currentQuestionIndex === questions.length - 1 ? 'Submit' : 'Next'}
                </button>
            </div>
        </div>
    );
};