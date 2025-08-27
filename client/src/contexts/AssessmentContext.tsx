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

// Cache for presigned URLs per assessment
interface PresignedUrlCache {
  [assessmentId: string]: {
    s3Config: any;
    timestamp: number;
    expiresAt: number; // 7 hours from creation
  };
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
  // Presigned URL management
  clearAllPresignedUrls: () => void;
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

  // Cache for presigned URLs per assessment
  const [presignedUrlCache, setPresignedUrlCache] = useState<PresignedUrlCache>({});

  const { initiateAssessment, uploadAudio, uploadImage } = useS3Upload();
  const { user } = useAuth();

  // Cleanup expired presigned URLs every hour
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      let hasExpired = false;
      
      setPresignedUrlCache(prev => {
        const newCache = { ...prev };
        
        Object.keys(newCache).forEach(assessmentId => {
          if (now >= newCache[assessmentId].expiresAt) {
            delete newCache[assessmentId];
            hasExpired = true;
            
          }
        });
        
        return newCache;
      });
      
      if (hasExpired) {
        
      }
    }, 60 * 60 * 1000); // Check every hour

    return () => clearInterval(cleanupInterval);
  }, []);

  // Check if cached presigned URLs are still valid
  const isPresignedUrlValid = useCallback((assessmentId: string): boolean => {
    const cached = presignedUrlCache[assessmentId];
    if (!cached) return false;
    
    const now = Date.now();
    return now < cached.expiresAt;
  }, [presignedUrlCache]);

  // Get cached presigned URLs if valid
  const getCachedPresignedUrls = useCallback((assessmentId: string) => {
    const cached = presignedUrlCache[assessmentId];
    if (isPresignedUrlValid(assessmentId)) {
      
      return cached.s3Config;
    }
    return null;
  }, [presignedUrlCache, isPresignedUrlValid]);



  // Cache presigned URLs for an assessment
  const cachePresignedUrls = useCallback((assessmentId: string, s3Config: any) => {
    const now = Date.now();
    const expiresAt = now + (7 * 60 * 60 * 1000); // 7 hours from now
    
    setPresignedUrlCache(prev => ({
      ...prev,
      [assessmentId]: {
        s3Config,
        timestamp: now,
        expiresAt
      }
    }));
    
    
  }, []);



  // Clear presigned URLs for a specific assessment
  const clearPresignedUrls = useCallback((assessmentId: string) => {
    setPresignedUrlCache(prev => {
      const newCache = { ...prev };
      delete newCache[assessmentId];
      return newCache;
    });
    
  }, []);

  // Clear all presigned URLs (useful for logout, account switch, etc.)
  const clearAllPresignedUrls = useCallback(() => {
    setPresignedUrlCache({});
    
  }, []);

  const startSession = useCallback(async (assessmentId: string) => {
    

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

    // Check if we have valid cached presigned URLs for this assessment
    const cachedS3Config = getCachedPresignedUrls(assessmentId);
    
    if (cachedS3Config) {
      
      setSession(prev => ({
        ...prev,
        assessmentId,
        startTime: new Date(),
        s3Config: cachedS3Config,
        sessionId: cachedS3Config?.session_id || null,
        isActive: true,
      }));
    } else if (user?.email) {
      
      
      // Retry mechanism for /initiate call
      const getS3ConfigWithRetry = async (maxRetries: number = 3, delayMs: number = 2000): Promise<any> => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            
            const s3Config = await initiateAssessment(assessmentId, 3600);
            
            // Check if assessment is already completed
            if (s3Config?.status === 'completed') {
              console.log('✅ Assessment already completed:', s3Config.message);
              throw new Error('ASSESSMENT_ALREADY_COMPLETED');
            }
            
            // Validate S3 configuration - audio is required, images_upload is optional
            if (s3Config?.audio) {
              
              return s3Config;
            } else {
              console.error('❌ S3 config validation failed:', { hasAudio: !!s3Config?.audio, hasImages: !!s3Config?.images_upload, s3Config });
              throw new Error('Invalid S3 configuration received - missing audio configuration');
            }
          } catch (error: any) {
            // If assessment is already completed, don't retry - bubble up immediately
            if (error.message === 'ASSESSMENT_ALREADY_COMPLETED') {
              throw error;
            }
            
            console.error(`❌ S3 configuration failed on attempt ${attempt}:`, error);
            
            if (attempt < maxRetries) {
              
              await new Promise(resolve => setTimeout(resolve, delayMs));
              
              // Increase delay for subsequent retries (exponential backoff)
              delayMs = Math.min(delayMs * 1.5, 10000); // Max 10 seconds
            } else {
              throw new Error(`Failed to get S3 configuration after ${maxRetries} attempts: ${error}`);
            }
          }
        }
        throw new Error('Max retries exceeded for S3 configuration');
      };

      try {
        const s3Config = await getS3ConfigWithRetry();
        
        
        
        // Cache the presigned URLs for this assessment
        cachePresignedUrls(assessmentId, s3Config);
        
        setSession(prev => ({
          ...prev,
          assessmentId,
          startTime: new Date(),
          s3Config,
          sessionId: s3Config?.session_id || null,
          isActive: true,
        }));
      } catch (error) {
        console.error('❌ Failed to get S3 configuration after all retries:', error);
        throw error;
      }
    } else {
      console.error('❌ User email not available for S3 configuration');
      throw new Error('User email required for S3 configuration');
    }
  }, [initiateAssessment, user?.email, getCachedPresignedUrls, cachePresignedUrls]);

  const endSession = useCallback(async () => {
    
    
    // Clear presigned URLs for this assessment
    if (session.assessmentId) {
      clearPresignedUrls(session.assessmentId);
    }
    
    setSession(prev => ({
      ...prev,
      endTime: new Date(),
      isActive: false,
      s3Config: null, // Clear S3 config to prevent reuse
      sessionId: null, // Clear session ID
    }));
  }, [session.assessmentId, clearPresignedUrls]);

  const finishAssessment = useCallback(async () => {
    
    
    // End logging session and get final logs
    const finalLogs = assessmentLogger.endAssessment();
    
    // Submit final logs to new /log-upload endpoint
    if (user?.email && session.assessmentId) {
      try {
        // Get properly formatted logs for API submission
        const formattedLogs = assessmentLogger.getFormattedLogs();
        
        
        
        await S3Service.uploadLogs({
          user_email: user.email,
          assessment_id: session.assessmentId,
          logs: formattedLogs
        });
        
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
    
  }, []);

  const uploadImageToS3 = useCallback(async (imageBlob: Blob) => {
    if (!session.s3Config?.images_upload) {
      throw new Error('S3 image upload not configured for this assessment');
    }

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    const filename = `image_${timestamp}_${randomId}.jpg`;
    
    
    
    // Upload immediately and wait for completion
    await uploadImage(imageBlob, filename);
    
  }, [session.s3Config, uploadImage]);

  const uploadAudioToS3 = useCallback(async (audioBlob: Blob) => {
    

    if (!session.s3Config?.audio) {
      const error = 'S3 not configured for audio upload';
      console.error('❌', error, { s3Config: session.s3Config });
      throw new Error(error);
    }

    
    
    try {
      // Wait for upload completion
      await uploadAudio(audioBlob);
      
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
        isS3Ready: !!(session.s3Config?.audio), // Only audio is required, images_upload is optional
        // Logging methods
        startQuestionLog,
        endQuestionLog,
        handleQuestionTransition,
        // Presigned URL management
        clearAllPresignedUrls,
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