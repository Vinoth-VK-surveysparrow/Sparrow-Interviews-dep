import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useS3Upload } from '@/hooks/useS3Upload';
import { useAuth } from '@/hooks/useAuth';

interface AssessmentSession {
  assessmentId: string;
  startTime: Date | null;
  endTime: Date | null;
  s3Config: any | null; // Store S3 configuration for the session
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
}

const AssessmentContext = createContext<AssessmentContextType | undefined>(undefined);

export const AssessmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AssessmentSession>({
    assessmentId: '',
  startTime: null,
  endTime: null,
    s3Config: null,
    isActive: false,
  });

  const { initiateAssessment, uploadAudio, uploadImage } = useS3Upload();
  const { user } = useAuth();

  const startSession = useCallback(async (assessmentId: string) => {
    console.log('🚀 Starting assessment session:', assessmentId);

    // Initialize S3 configuration once at the start
    if (!session.s3Config && user?.email) {
      console.log('🔧 Initiating S3 configuration for assessment:', assessmentId);
      try {
        const s3Config = await initiateAssessment(assessmentId, 3600);
        console.log('✅ S3 configuration received:', {
          hasAudio: !!s3Config?.audio,
          hasImages: !!s3Config?.images_upload,
          audioKey: s3Config?.audio?.key,
          imagesPrefix: s3Config?.images_upload?.prefix
        });
        
        setSession(prev => ({
          ...prev,
          assessmentId,
          startTime: new Date(),
          s3Config,
          isActive: true,
        }));
      } catch (error) {
        console.error('❌ Failed to initiate S3 configuration:', error);
        throw error;
      }
    } else {
      console.log('⚡ Using existing session or missing user email');
      setSession(prev => ({
        ...prev,
        assessmentId,
        startTime: new Date(),
        isActive: true,
      }));
    }
  }, [initiateAssessment, user?.email, session.s3Config]);

  const endSession = useCallback(async () => {
    console.log('Ending assessment session');
    setSession(prev => ({
      ...prev,
      endTime: new Date(),
      isActive: false,
    }));
  }, []);

  const finishAssessment = useCallback(async () => {
    console.log('Finishing assessment - this now happens in background');
    // This is now just a placeholder - actual upload happens in background
      await endSession();
  }, [endSession]);

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