import { useEffect, useCallback, useRef } from 'react';
import { useLocalAudioStorage } from './useLocalAudioStorage';
import { useS3Upload } from './useS3Upload';

export function useBackgroundUpload() {
  const { getPendingUploads, markAsUploaded, incrementUploadAttempts, cleanupUploaded } = useLocalAudioStorage();
  const { uploadAudio } = useS3Upload();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isUploadingRef = useRef(false);

  // Attempt to upload a single audio file
  const attemptUpload = useCallback(async (audio: any) => {
    try {
      console.log('🚀 Attempting background upload:', {
        audioId: audio.id,
        attempt: audio.uploadAttempts + 1,
        size: audio.blob.size
      });

      incrementUploadAttempts(audio.id);

      // Use the existing upload function
      await uploadAudio(audio.blob);

      console.log('✅ Background upload successful:', audio.id);
      markAsUploaded(audio.id);

      return true;
    } catch (error) {
      console.error('❌ Background upload failed:', audio.id, error);
      return false;
    }
  }, [uploadAudio, markAsUploaded, incrementUploadAttempts]);

  // Process all pending uploads
  const processPendingUploads = useCallback(async () => {
    if (isUploadingRef.current) {
      console.log('🔄 Upload already in progress, skipping...');
      return;
    }

    const pending = getPendingUploads();
    if (pending.length === 0) {
      return;
    }

    console.log('📤 Processing pending uploads:', pending.length);
    isUploadingRef.current = true;

    try {
      // Process uploads sequentially to avoid overwhelming the server
      for (const audio of pending) {
        if (audio.uploadAttempts >= 3) {
          console.log('❌ Max upload attempts reached for:', audio.id);
          continue;
        }

        const success = await attemptUpload(audio);
        
        // Add delay between uploads to avoid rate limiting
        if (pending.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Clean up successfully uploaded audios
      cleanupUploaded();
    } finally {
      isUploadingRef.current = false;
    }
  }, [getPendingUploads, attemptUpload, cleanupUploaded]);

  // Start background upload service
  const startBackgroundUpload = useCallback(() => {
    if (intervalRef.current) {
      console.log('🔄 Background upload service already running');
      return;
    }

    console.log('🚀 Starting background upload service');
    
    // Process immediately
    processPendingUploads();

    // Then process every 30 seconds
    intervalRef.current = setInterval(() => {
      processPendingUploads();
    }, 30000);
  }, [processPendingUploads]);

  // Stop background upload service
  const stopBackgroundUpload = useCallback(() => {
    if (intervalRef.current) {
      console.log('⏹️ Stopping background upload service');
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Force immediate upload attempt
  const forceUploadNow = useCallback(async () => {
    console.log('🚀 Force uploading all pending audios...');
    await processPendingUploads();
  }, [processPendingUploads]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopBackgroundUpload();
    };
  }, [stopBackgroundUpload]);

  return {
    startBackgroundUpload,
    stopBackgroundUpload,
    forceUploadNow,
    isUploading: isUploadingRef.current
  };
} 