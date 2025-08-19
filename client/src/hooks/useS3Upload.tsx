import { useState, useCallback } from 'react';
import { S3Service, InitiateAssessmentResponse, Question } from '@/lib/s3Service';
import { useAuth } from '@/hooks/useAuth';

export const useS3Upload = () => {
  const [uploadConfig, setUploadConfig] = useState<InitiateAssessmentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();

  const initiateAssessment = useCallback(async (assessmentId: string, duration: number = 3600) => {
    if (authLoading) {
      setError('Authentication still loading, please wait...');
      return null;
    }
    
    if (!user?.email) {
      setError(`User email not available. User object: ${JSON.stringify(user)}`);
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      const config = await S3Service.initiateAssessment({
        user_email: user.email,
        assessment_id: assessmentId,
        answered_at: new Date().toISOString(),
        duration: duration
      });

      setUploadConfig(config);
      return config;
    } catch (err: any) {
      setError(err.message || 'Failed to initiate assessment');
      return null;
    } finally {
      setLoading(false);
    }
  }, [user?.email, authLoading]);

  const uploadAudio = useCallback(async (audioBlob: Blob) => {
    console.log('🎵 useS3Upload.uploadAudio called:', {
      blobSize: audioBlob.size,
      blobType: audioBlob.type,
      hasUploadConfig: !!uploadConfig,
      hasAudioConfig: !!uploadConfig?.audio,
      hasPresignedUrl: !!uploadConfig?.audio?.presigned_url,
      presignedUrlStart: uploadConfig?.audio?.presigned_url?.substring(0, 50) + '...'
    });

    if (!uploadConfig?.audio?.presigned_url) {
      const error = 'No audio upload configuration available';
      console.error('❌', error, { uploadConfig });
      throw new Error(error);
    }

    try {
      console.log('✅ Calling S3Service.uploadAudio...');
      await S3Service.uploadAudio(uploadConfig.audio.presigned_url, audioBlob);
      console.log('✅ S3Service.uploadAudio completed successfully');
    } catch (err: any) {
      console.error('❌ S3Service.uploadAudio failed:', err);
      setError(err.message || 'Failed to upload audio');
      throw err;
    }
  }, [uploadConfig]);

  const uploadImage = useCallback(async (imageBlob: Blob, filename: string) => {
    if (!uploadConfig?.images_upload?.presigned_post) {
      throw new Error('No image upload configuration available');
    }

    try {
      await S3Service.uploadImage(uploadConfig.images_upload.presigned_post, imageBlob, filename);
    } catch (err: any) {
      setError(err.message || 'Failed to upload image');
      throw err;
    }
  }, [uploadConfig]);

  const getAudioDownloadUrl = useCallback(async (assessmentId: string) => {
    if (authLoading) {
      throw new Error('Authentication still loading, please wait...');
    }
    
    if (!user?.email) {
      throw new Error(`User email not available. User object: ${JSON.stringify(user)}`);
    }

    try {
      const response = await S3Service.getAudioDownloadUrl({
        user_email: user.email,
        assessment_id: assessmentId
      });
      return response.audio_download_url;
    } catch (err: any) {
      setError(err.message || 'Failed to get audio download URL');
      throw err;
    }
  }, [user?.email]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const fetchQuestions = useCallback(async (assessmentId: string): Promise<Question[]> => {
    if (authLoading) {
      throw new Error('Authentication still loading, please wait...');
    }
    
    if (!user?.email) {
      throw new Error(`User email not available. User object: ${JSON.stringify(user)}`);
    }

    try {
      const questions = await S3Service.fetchQuestions({
        user_email: user.email,
        assessment_id: assessmentId
      });

      return questions;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to fetch questions');
    }
  }, [user?.email, authLoading]);

  const reset = useCallback(() => {
    setUploadConfig(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    uploadConfig,
    loading,
    error,
    initiateAssessment,
    uploadAudio,
    uploadImage,
    getAudioDownloadUrl,
    fetchQuestions,
    clearError,
    reset,
    isConfigured: !!uploadConfig
  };
}; 