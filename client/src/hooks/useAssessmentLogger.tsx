import { useCallback, useEffect } from 'react';
import { assessmentLogger } from '@/lib/assessmentLogger';

export const useAssessmentLogger = () => {
  // Monitor session status (memory only - no auto-save)
  useEffect(() => {
    const interval = setInterval(() => {
      const sessionInfo = assessmentLogger.getSessionInfo();
      if (sessionInfo) {
        console.log('📊 Assessment Logger Status (Memory Only):', {
          assessment_id: sessionInfo.assessment_id,
          current_question: sessionInfo.current_question_index,
          total_logs: sessionInfo.logs.length,
          session_duration: assessmentLogger.getSessionDuration(),
          note: 'Data in memory only - will be sent to API on completion'
        });
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const startAssessment = useCallback((assessmentId: string, userEmail: string) => {
    assessmentLogger.startAssessment(assessmentId, userEmail);
  }, []);

  const startQuestion = useCallback((questionText: string, questionId?: string, questionIndex?: number) => {
    assessmentLogger.startQuestion(questionText, questionId, questionIndex);
  }, []);

  const endQuestion = useCallback(() => {
    assessmentLogger.endCurrentQuestion();
  }, []);

  const endAssessment = useCallback(() => {
    return assessmentLogger.endAssessment();
  }, []);

  const handleQuestionTransition = useCallback((newQuestionText: string, newQuestionId?: string, newQuestionIndex?: number) => {
    assessmentLogger.handleQuestionTransition(newQuestionText, newQuestionId, newQuestionIndex);
  }, []);

  const getCurrentLogs = useCallback(() => {
    return assessmentLogger.getCurrentLogs();
  }, []);

  const getFormattedLogs = useCallback(() => {
    return assessmentLogger.getFormattedLogs();
  }, []);

  const getSessionInfo = useCallback(() => {
    return assessmentLogger.getSessionInfo();
  }, []);

  const clearSession = useCallback(() => {
    assessmentLogger.clearSession();
  }, []);

  const debugState = useCallback(() => {
    assessmentLogger.debugCurrentState();
  }, []);

  return {
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
  };
};