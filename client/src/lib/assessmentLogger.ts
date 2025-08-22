interface AssessmentLog {
  question: string;
  question_id?: string;
  start_time: string;
  end_time?: string;
  duration_seconds?: number;
}

interface AssessmentSession {
  assessment_id: string;
  user_email: string;
  session_start: string;
  session_end?: string;
  logs: AssessmentLog[];
  current_question_index: number;
}

export class AssessmentLogger {
  private static instance: AssessmentLogger;
  private session: AssessmentSession | null = null;
  private currentQuestionStartTime: Date | null = null;

  private constructor() {
    // No local storage - everything is in memory only
  }

  static getInstance(): AssessmentLogger {
    if (!AssessmentLogger.instance) {
      AssessmentLogger.instance = new AssessmentLogger();
    }
    return AssessmentLogger.instance;
  }

  // Initialize a new assessment session
  startAssessment(assessmentId: string, userEmail: string): void {
    console.log('📊 Starting assessment logging:', { assessmentId, userEmail });
    
    this.session = {
      assessment_id: assessmentId,
      user_email: userEmail,
      session_start: new Date().toISOString(),
      logs: [],
      current_question_index: 0
    };

    console.log('✅ Assessment session initialized (memory only)');
  }

  // Start logging for a specific question
  startQuestion(questionText: string, questionId?: string, questionIndex?: number): void {
    if (!this.session) {
      console.error('❌ No active assessment session');
      return;
    }

    // End previous question if exists
    if (this.currentQuestionStartTime) {
      this.endCurrentQuestion();
    }

    console.log('📝 Starting question log:', { questionText, questionId, questionIndex });
    
    this.currentQuestionStartTime = new Date();
    
    // Update current question index if provided
    if (questionIndex !== undefined) {
      this.session.current_question_index = questionIndex;
    }

    // Add new log entry (without end_time initially)
    const newLog: AssessmentLog = {
      question: questionText,
      question_id: questionId,
      start_time: this.currentQuestionStartTime.toISOString()
    };

    this.session.logs.push(newLog);
    
    console.log('✅ Question started:', {
      question_index: this.session.current_question_index,
      start_time: newLog.start_time
    });
  }

  // End the current question
  endCurrentQuestion(): void {
    if (!this.session || !this.currentQuestionStartTime) {
      console.warn('⚠️ No current question to end');
      return;
    }

    const endTime = new Date();
    const duration = Math.round((endTime.getTime() - this.currentQuestionStartTime.getTime()) / 1000);
    
    // Update the last log entry
    const lastLogIndex = this.session.logs.length - 1;
    if (lastLogIndex >= 0) {
      this.session.logs[lastLogIndex].end_time = endTime.toISOString();
      this.session.logs[lastLogIndex].duration_seconds = duration;
      
      console.log('⏱️ Question ended:', {
        question_index: this.session.current_question_index,
        duration_seconds: duration,
        end_time: endTime.toISOString()
      });
    }

    this.currentQuestionStartTime = null;
  }

  // End the entire assessment session
  endAssessment(): AssessmentLog[] {
    if (!this.session) {
      console.error('❌ No active assessment session to end');
      return [];
    }

    // End current question if active
    if (this.currentQuestionStartTime) {
      this.endCurrentQuestion();
    }

    // Mark session as ended
    this.session.session_end = new Date().toISOString();

    console.log('🏁 Assessment session ended:', {
      assessment_id: this.session.assessment_id,
      total_questions: this.session.logs.length,
      session_duration: this.getSessionDuration(),
      logs: this.session.logs
    });

    return [...this.session.logs];
  }

  // Get current session logs
  getCurrentLogs(): AssessmentLog[] {
    return this.session?.logs || [];
  }

  // Get session duration in seconds
  getSessionDuration(): number {
    if (!this.session) return 0;
    
    const endTime = this.session.session_end ? new Date(this.session.session_end) : new Date();
    const startTime = new Date(this.session.session_start);
    
    return Math.round((endTime.getTime() - startTime.getTime()) / 1000);
  }

  // Get current session info
  getSessionInfo(): AssessmentSession | null {
    return this.session;
  }

  // Clear current session
  clearSession(): void {
    console.log('🗑️ Clearing assessment session (memory only)');
    this.session = null;
    this.currentQuestionStartTime = null;
  }



  // Handle question transitions (memory only)
  handleQuestionTransition(newQuestionText: string, newQuestionId?: string, newQuestionIndex?: number): void {
    console.log('🔄 Question transition detected (memory only)');
    
    // End current question
    this.endCurrentQuestion();
    
    // Start new question
    this.startQuestion(newQuestionText, newQuestionId, newQuestionIndex);
  }

  // Get formatted logs for API submission
  getFormattedLogs(): {
    session_start: string;
    user_agent?: string;
    interactions: Array<{
      question: string;
      question_id?: string;
      start_time: string;
      end_time: string;
      duration_seconds: number;
    }>;
    performance_metrics?: {
      loading_time?: number;
      recording_duration: number;
    };
  } {
    const interactions = this.getCurrentLogs().map(log => ({
      question: log.question,
      question_id: log.question_id,
      start_time: log.start_time,
      end_time: log.end_time || new Date().toISOString(),
      duration_seconds: log.duration_seconds || 0
    }));

    // Calculate total recording duration
    const totalRecordingDuration = interactions.reduce((total, interaction) => {
      return total + interaction.duration_seconds;
    }, 0);

    return {
      session_start: this.session?.session_start || new Date().toISOString(),
      user_agent: navigator.userAgent,
      interactions,
      performance_metrics: {
        recording_duration: totalRecordingDuration
      }
    };
  }

  // Debug method to log current state (memory only)
  debugCurrentState(): void {
    console.log('🔍 Assessment Logger Debug State (Memory Only):', {
      hasSession: !!this.session,
      sessionInfo: this.session,
      currentQuestionActive: !!this.currentQuestionStartTime,
      currentQuestionStartTime: this.currentQuestionStartTime?.toISOString(),
      totalLogs: this.session?.logs.length || 0,
      sessionDuration: this.getSessionDuration(),
      note: 'All data is in memory only - no local storage used'
    });
  }
}

// Export singleton instance
export const assessmentLogger = AssessmentLogger.getInstance();