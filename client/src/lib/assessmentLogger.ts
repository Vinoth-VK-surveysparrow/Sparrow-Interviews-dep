interface AssessmentLog {
  question: string;
  question_id?: string;
  start_time: string;
  end_time?: string;
  duration_seconds?: number;
  // Additional fields for conductor assessment energy tracking
  energy_events?: Array<{
    event_type: "energy_level_change" | "breathe_cue" | "question_started" | "assessment_started";
    timestamp: string;
    relative_time_ms: number;
    energy_level?: number;
    previous_energy_level?: number;
    frequency?: number;
  }>;
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
    
    
    this.session = {
      assessment_id: assessmentId,
      user_email: userEmail,
      session_start: new Date().toISOString(),
      logs: [],
      current_question_index: 0
    };

    
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
    
    this.session = null;
    this.currentQuestionStartTime = null;
  }



  // Handle question transitions (memory only)
  handleQuestionTransition(newQuestionText: string, newQuestionId?: string, newQuestionIndex?: number): void {
    
    
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
      energy_events?: Array<{
        event_type: "energy_level_change" | "breathe_cue" | "question_started" | "assessment_started";
        timestamp: string;
        relative_time_ms: number;
        energy_level?: number;
        previous_energy_level?: number;
        frequency?: number;
      }>;
    }>;
    performance_metrics?: {
      loading_time?: number;
      recording_duration: number;
    };
  } {
    const interactions = this.getCurrentLogs()
      .filter(log => log.end_time) // Only include logs that have been properly completed
      .map(log => ({
        question: log.question, // Already formatted with <question> and <word> tags
        question_id: log.question_id,
        start_time: log.start_time,
        end_time: log.end_time!,
        duration_seconds: log.duration_seconds || 0,
        // Include energy events if they exist
        ...(log.energy_events && log.energy_events.length > 0 && { energy_events: log.energy_events })
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

  // Add word appearance as separate log entry for TripleStep assessments
  addWordEvent(word: string, appearedAt: Date, questionId?: string): void {
    if (!this.session) {
      console.error('❌ No active assessment session');
      return;
    }

    // Create a separate log entry for this word appearance (only word, not question)
    const wordLog: AssessmentLog = {
      question: `<word>${word}</word>`,
      question_id: questionId,
      start_time: appearedAt.toISOString()
      // end_time will be set when word is integrated or expires
    };

    this.session.logs.push(wordLog);
    
    console.log(`[LOGGER] Word "${word}" appeared at ${appearedAt.toISOString()}`);
  }

  // Log a complete question entry for TripleStep (question text only, immediately completed)
  logCompleteQuestion(questionText: string, questionId?: string, questionIndex?: number, startTime?: Date, endTime?: Date): void {
    if (!this.session) {
      console.error('❌ No active assessment session');
      return;
    }

    const questionStartTime = startTime || new Date();
    const questionEndTime = endTime || new Date();
    
    // Create a complete question log entry
    const questionLog: AssessmentLog = {
      question: questionText,
      question_id: questionId,
      start_time: questionStartTime.toISOString(),
      end_time: questionEndTime.toISOString(),
      duration_seconds: Math.round((questionEndTime.getTime() - questionStartTime.getTime()) / 1000)
    };

    this.session.logs.push(questionLog);
    
    // Update current question index if provided
    if (questionIndex !== undefined) {
      this.session.current_question_index = questionIndex;
    }

    console.log(`[LOGGER] Complete question logged: ${questionText.substring(0, 50)}...`);
  }

  // Mark word as integrated by completing its log entry
  markWordIntegrated(word: string, integratedAt: Date): void {
    if (!this.session) {
      console.error('❌ No active question to mark word integration');
      return;
    }

    // Find the most recent word log entry that matches this word and doesn't have an end_time
    const wordLogIndex = [...this.session.logs]
      .reverse()
      .findIndex(log => 
        log.question === `<word>${word}</word>` && !log.end_time
      );

    if (wordLogIndex !== -1) {
      // Convert reverse index to actual index
      const actualIndex = this.session.logs.length - 1 - wordLogIndex;
      const wordLog = this.session.logs[actualIndex];
      
      wordLog.end_time = integratedAt.toISOString();
      wordLog.duration_seconds = Math.round(
        (integratedAt.getTime() - new Date(wordLog.start_time).getTime()) / 1000
      );
      
      console.log(`[LOGGER] Word "${word}" integrated after ${wordLog.duration_seconds} seconds`);
    } else {
      console.warn(`⚠️ Word "${word}" not found in logs or already integrated`);
    }
  }

  // Mark word as expired (not integrated) by completing its log entry
  markWordExpired(word: string, expiredAt: Date): void {
    if (!this.session) {
      console.error('❌ No active question to mark word expiration');
      return;
    }

    // Find the most recent word log entry that matches this word and doesn't have an end_time
    const wordLogIndex = [...this.session.logs]
      .reverse()
      .findIndex(log => 
        log.question === `<word>${word}</word>` && !log.end_time
      );

    if (wordLogIndex !== -1) {
      // Convert reverse index to actual index
      const actualIndex = this.session.logs.length - 1 - wordLogIndex;
      const wordLog = this.session.logs[actualIndex];
      
      wordLog.end_time = expiredAt.toISOString();
      wordLog.duration_seconds = Math.round(
        (expiredAt.getTime() - new Date(wordLog.start_time).getTime()) / 1000
      );
      
      console.log(`[LOGGER] Word "${word}" expired after ${wordLog.duration_seconds} seconds`);
    } else {
      console.warn(`⚠️ Word "${word}" not found in logs to mark as expired`);
    }
  }

  // Mark all unfinished word logs as expired (for when question ends)
  finishAllUncompletedWords(questionEndTime: Date): void {
    if (!this.session) {
      console.error('❌ No active session to finish uncompleted words');
      return;
    }

    const unfinishedWords = this.session.logs.filter(log => 
      log.question.startsWith('<word>') && !log.end_time
    );

    unfinishedWords.forEach(wordLog => {
      wordLog.end_time = questionEndTime.toISOString();
      wordLog.duration_seconds = Math.round(
        (questionEndTime.getTime() - new Date(wordLog.start_time).getTime()) / 1000
      );
      
      // Extract word name for logging
      const wordMatch = wordLog.question.match(/<word>(.+?)<\/word>/);
      const wordName = wordMatch ? wordMatch[1] : 'unknown';
      console.log(`[LOGGER] Auto-finished unprocessed word "${wordName}" after ${wordLog.duration_seconds} seconds`);
    });
  }

  // Add energy event to the current question's log
  addEnergyEvent(eventData: {
    event_type: "energy_level_change" | "breathe_cue" | "question_started" | "assessment_started";
    timestamp: string;
    relative_time_ms: number;
    energy_level?: number;
    previous_energy_level?: number;
    frequency?: number;
  }): void {
    if (!this.session) {
      console.error('❌ No active session to add energy event');
      return;
    }

    // Find the current active question log (most recent one without end_time)
    const currentQuestionLog = [...this.session.logs]
      .reverse()
      .find(log => !log.end_time && !log.question.includes('<word>'));

    if (currentQuestionLog) {
      // Initialize energy_events array if it doesn't exist
      if (!currentQuestionLog.energy_events) {
        currentQuestionLog.energy_events = [];
      }
      
      // Add the energy event
      currentQuestionLog.energy_events.push(eventData);
      
      console.log(`[LOGGER] Energy event added: ${eventData.event_type} for question "${currentQuestionLog.question.substring(0, 30)}..."`);
    } else {
      console.warn('⚠️ No active question found to add energy event to');
    }
  }

  // Debug method to log current state (memory only)
  debugCurrentState(): void {
    if (this.session) {
      console.log('🐛 [DEBUG] Current Assessment Session:', {
        assessment_id: this.session.assessment_id,
        user_email: this.session.user_email,
        total_logs: this.session.logs.length,
        logs_with_energy_events: this.session.logs.filter(log => log.energy_events && log.energy_events.length > 0).length,
        current_question_index: this.session.current_question_index
      });
      
      // Debug each log entry
      this.session.logs.forEach((log, index) => {
        console.log(`🐛 [DEBUG] Log ${index}:`, {
          question: log.question.substring(0, 50) + '...',
          start_time: log.start_time,
          end_time: log.end_time,
          energy_events_count: log.energy_events?.length || 0,
          energy_events: log.energy_events
        });
      });
    } else {
      console.log('🐛 [DEBUG] No active session');
    }
  }
}

// Export singleton instance
export const assessmentLogger = AssessmentLogger.getInstance();