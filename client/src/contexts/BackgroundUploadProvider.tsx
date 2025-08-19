import React, { createContext, useContext, useEffect } from 'react';
import { useLocalAudioStorage } from '@/hooks/useLocalAudioStorage';
import { useBackgroundUpload } from '@/hooks/useBackgroundUpload';

interface BackgroundUploadContextType {
  saveAudioLocally: (audioBlob: Blob, assessmentId: string, userEmail: string) => Promise<string>;
  forceUploadNow: () => Promise<void>;
  storedCount: number;
  getAllStoredAudios: () => any[];
  clearAllAudios: () => void;
}

const BackgroundUploadContext = createContext<BackgroundUploadContextType | undefined>(undefined);

export function BackgroundUploadProvider({ children }: { children: React.ReactNode }) {
  const localAudioStorage = useLocalAudioStorage();
  const backgroundUpload = useBackgroundUpload();

  // Start background upload service when provider mounts
  useEffect(() => {
    console.log('🚀 BackgroundUploadProvider: Starting background upload service');
    backgroundUpload.startBackgroundUpload();

    return () => {
      console.log('⏹️ BackgroundUploadProvider: Stopping background upload service');
      backgroundUpload.stopBackgroundUpload();
    };
  }, [backgroundUpload]);

  // Show upload status in console periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const pending = localAudioStorage.getPendingUploads();
      if (pending.length > 0) {
        console.log('📊 Background upload status:', {
          totalStored: localAudioStorage.storedCount,
          pendingUploads: pending.length,
          pendingDetails: pending.map(p => ({
            id: p.id,
            attempts: p.uploadAttempts,
            size: p.blob.size
          }))
        });
      }
    }, 60000); // Every minute

    return () => clearInterval(interval);
  }, [localAudioStorage]);

  const contextValue: BackgroundUploadContextType = {
    saveAudioLocally: localAudioStorage.saveAudioLocally,
    forceUploadNow: backgroundUpload.forceUploadNow,
    storedCount: localAudioStorage.storedCount,
    getAllStoredAudios: localAudioStorage.getAllStoredAudios,
    clearAllAudios: localAudioStorage.clearAllAudios,
  };

  return (
    <BackgroundUploadContext.Provider value={contextValue}>
      {children}
    </BackgroundUploadContext.Provider>
  );
}

export function useBackgroundUploadContext() {
  const context = useContext(BackgroundUploadContext);
  if (context === undefined) {
    throw new Error('useBackgroundUploadContext must be used within a BackgroundUploadProvider');
  }
  return context;
} 