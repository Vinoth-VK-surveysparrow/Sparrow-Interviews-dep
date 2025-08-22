import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useS3Upload } from '@/hooks/useS3Upload';
import { useAuth } from '@/hooks/useAuth';
import { assessmentLogger } from '@/lib/assessmentLogger';
import { S3Service } from '@/lib/s3Service';

interface AssessmentSession {
  assessmentId: string;
  startTime: Date | null;
  endTime: Date | null;
  s3Config: any | null; // Store S3 configuration for the session
  sessionId: string | null; // Backend session ID
  isActive: boolean;
}

interface AssessmentContextType {
  session: AssessmentSession;
  startSession: (assessmentId: string) => Promise<void>;
  endSession: () => Promise<void>;
  finishAssessment: () => Promise<void>;
  addTranscript: (questionId: number, transcript: string) => void;
  uploadImageToS3: (imageBlob: Blob) => Promise<void>;
  uploadAudioToS3: (audioBlob: Blob) => Promise<void>;
  isS3Ready: boolean;
  // Logging methods
  startQuestionLog: (questionText: string, questionId?: string, questionIndex?: number) => void;
  endQuestionLog: () => void;
  handleQuestionTransition: (newQuestionText: string, newQuestionId?: string, newQuestionIndex?: number) => void;
}

const AssessmentContext = createContext<AssessmentContextType | undefined>(undefined);

export const AssessmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AssessmentSession>({
    assessmentId: '',
    startTime: null,
    endTime: null,
    s3Config: null,
    sessionId: null,
    isActive: false,
  });

  const { initiateAssessment, uploadAudio, uploadImage } = useS3Upload();
  const { user } = useAuth();

  const startSession = useCallback(async (assessmentId: string) => {
    console.log('🚀 Starting assessment session:', assessmentId);

    // Clear any previous session data to ensure fresh start
    setSession(prev => ({
      ...prev,
      assessmentId: '',
      startTime: null,
      endTime: null,
      s3Config: null,
      sessionId: null,
      isActive: false,
    }));

    // Initialize logging system
    if (user?.email) {
      assessmentLogger.startAssessment(assessmentId, user.email);
    }

    // Always get fresh S3 configuration for each assessment
    if (user?.email) {
      console.log('🔧 Getting fresh S3 configuration for assessment:', assessmentId);
      try {
        const s3Config = await initiateAssessment(assessmentId, 3600);
        console.log('✅ Fresh S3 configuration received:', {
          hasAudio: !!s3Config?.audio,
          hasImages: !!s3Config?.images_upload,
          audioKey: s3Config?.audio?.key,
          imagesPrefix: s3Config?.images_upload?.prefix,
          sessionId: s3Config?.session_id
        });
        
        setSession(prev => ({
          ...prev,
          assessmentId,
          startTime: new Date(),
          s3Config,
          sessionId: s3Config?.session_id || null,
          isActive: true,
        }));
      } catch (error) {
        console.error('❌ Failed to get fresh S3 configuration:', error);
        throw error;
      }
    } else {
      console.error('❌ User email not available for S3 configuration');
      throw new Error('User email required for S3 configuration');
    }
  }, [initiateAssessment, user?.email]);

  const endSession = useCallback(async () => {
    console.log('Ending assessment session');
    setSession(prev => ({
      ...prev,
      endTime: new Date(),
      isActive: false,
      s3Config: null, // Clear S3 config to prevent reuse
      sessionId: null, // Clear session ID
    }));
  }, []);

  const finishAssessment = useCallback(async () => {
    console.log('🏁 Finishing assessment - submitting final logs to external API');
    
    // End logging session and get final logs
    const finalLogs = assessmentLogger.endAssessment();
    
    // Submit final logs to new /log-upload endpoint
    if (user?.email && session.assessmentId) {
      try {
        // Get properly formatted logs for API submission
        const formattedLogs = assessmentLogger.getFormattedLogs();
        
        console.log('📤 Uploading logs to /log-upload endpoint:', {
          user_email: user.email,
          assessment_id: session.assessmentId,
          interactions_count: formattedLogs.interactions.length
        });
        
        await S3Service.uploadLogs({
          user_email: user.email,
          assessment_id: session.assessmentId,
          logs: formattedLogs
        });
        console.log('✅ Assessment logs uploaded successfully');
      } catch (error) {
        console.error('❌ Failed to upload logs:', error);
        // Continue with cleanup even if logs upload fails
      }
    }
    
    // Clear logging session from memory
    assessmentLogger.clearSession();
    
    await endSession();
  }, [endSession, user?.email, session.assessmentId]);

  const addTranscript = useCallback((questionId: number, transcript: string) => {
    // We don't store transcripts anymore since we're not using IndexedDB
    console.log('Transcript for question', questionId, ':', transcript);
  }, []);

  const uploadImageToS3 = useCallback(async (imageBlob: Blob) => {
    if (!session.s3Config?.images_upload) {
      throw new Error('S3 not configured for this session');
    }

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    const filename = `image_${timestamp}_${randomId}.jpg`;
    
    console.log('🖼️ Starting image upload to S3:', {
      filename,
      blobSize: imageBlob.size,
      blobType: imageBlob.type,
      s3ConfigPresent: !!session.s3Config,
      imagesUploadPresent: !!session.s3Config.images_upload
    });
    
    // Upload immediately and wait for completion
    await uploadImage(imageBlob, filename);
    console.log('🖼️ Image upload completed:', filename);
  }, [session.s3Config, uploadImage]);

  const uploadAudioToS3 = useCallback(async (audioBlob: Blob) => {
    console.log('🎵 uploadAudioToS3 called:', {
      blobSize: audioBlob.size,
      blobType: audioBlob.type,
      hasS3Config: !!session.s3Config,
      hasAudioConfig: !!session.s3Config?.audio,
      audioConfig: session.s3Config?.audio
    });

    if (!session.s3Config?.audio) {
      const error = 'S3 not configured for audio upload';
      console.error('❌', error, { s3Config: session.s3Config });
      throw new Error(error);
    }

    console.log('✅ S3 audio config found, starting upload...');
    
    try {
      // Wait for upload completion
      await uploadAudio(audioBlob);
      console.log('✅ Audio upload completed successfully');
    } catch (error) {
      console.error('❌ Audio upload failed in context:', error);
      throw error;
    }
  }, [session.s3Config, uploadAudio]);

  // Logging methods
  const startQuestionLog = useCallback((questionText: string, questionId?: string, questionIndex?: number) => {
    assessmentLogger.startQuestion(questionText, questionId, questionIndex);
  }, []);

  const endQuestionLog = useCallback(() => {
    assessmentLogger.endCurrentQuestion();
  }, []);

  const handleQuestionTransition = useCallback((newQuestionText: string, newQuestionId?: string, newQuestionIndex?: number) => {
    assessmentLogger.handleQuestionTransition(newQuestionText, newQuestionId, newQuestionIndex);
  }, []);

  return (
    <AssessmentContext.Provider
      value={{
        session,
        startSession,
        endSession,
        finishAssessment,
        addTranscript,
        uploadImageToS3,
        uploadAudioToS3,
        isS3Ready: !!(session.s3Config?.audio && session.s3Config?.images_upload),
        // Logging methods
        startQuestionLog,
        endQuestionLog,
        handleQuestionTransition,
      }}
    >
      {children}
    </AssessmentContext.Provider>
  );
};

export const useAssessment = () => {
  const context = useContext(AssessmentContext);
  if (context === undefined) {
    throw new Error('useAssessment must be used within an AssessmentProvider');
  }
  return context;
};