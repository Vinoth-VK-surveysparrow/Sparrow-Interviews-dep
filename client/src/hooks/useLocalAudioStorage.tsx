import { useState, useCallback } from 'react';

interface StoredAudio {
  id: string;
  blob: Blob;
  timestamp: number;
  assessmentId: string;
  userEmail: string;
  uploaded: boolean;
  uploadAttempts: number;
}

export function useLocalAudioStorage() {
  const [storedAudios, setStoredAudios] = useState<Map<string, StoredAudio>>(new Map());

  // Save audio locally with metadata
  const saveAudioLocally = useCallback(async (
    audioBlob: Blob, 
    assessmentId: string, 
    userEmail: string
  ): Promise<string> => {
    const audioId = `audio_${assessmentId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const storedAudio: StoredAudio = {
      id: audioId,
      blob: audioBlob,
      timestamp: Date.now(),
      assessmentId,
      userEmail,
      uploaded: false,
      uploadAttempts: 0
    };

    console.log('💾 Saving audio locally:', {
      audioId,
      size: audioBlob.size,
      type: audioBlob.type,
      assessmentId,
      userEmail
    });

    setStoredAudios(prev => {
      const newMap = new Map(prev);
      newMap.set(audioId, storedAudio);
      return newMap;
    });

    // Also save to localStorage as backup
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        localStorage.setItem(`audio_backup_${audioId}`, JSON.stringify({
          id: audioId,
          data: base64,
          timestamp: storedAudio.timestamp,
          assessmentId,
          userEmail,
          size: audioBlob.size,
          type: audioBlob.type
        }));
        console.log('💾 Audio backed up to localStorage:', audioId);
      };
      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.warn('⚠️ Could not backup to localStorage:', error);
    }

    return audioId;
  }, []);

  // Mark audio as successfully uploaded
  const markAsUploaded = useCallback((audioId: string) => {
    console.log('✅ Marking audio as uploaded:', audioId);
    
    setStoredAudios(prev => {
      const newMap = new Map(prev);
      const audio = newMap.get(audioId);
      if (audio) {
        newMap.set(audioId, { ...audio, uploaded: true });
      }
      return newMap;
    });

    // Remove from localStorage backup
    try {
      localStorage.removeItem(`audio_backup_${audioId}`);
      console.log('🗑️ Removed audio backup from localStorage:', audioId);
    } catch (error) {
      console.warn('⚠️ Could not remove localStorage backup:', error);
    }
  }, []);

  // Increment upload attempts
  const incrementUploadAttempts = useCallback((audioId: string) => {
    setStoredAudios(prev => {
      const newMap = new Map(prev);
      const audio = newMap.get(audioId);
      if (audio) {
        const newAudio = { ...audio, uploadAttempts: audio.uploadAttempts + 1 };
        newMap.set(audioId, newAudio);
        console.log(`🔄 Upload attempt ${newAudio.uploadAttempts} for audio:`, audioId);
      }
      return newMap;
    });
  }, []);

  // Get pending uploads (not uploaded yet)
  const getPendingUploads = useCallback(() => {
    const pending: StoredAudio[] = [];
    storedAudios.forEach(audio => {
      if (!audio.uploaded && audio.uploadAttempts < 3) {
        pending.push(audio);
      }
    });
    return pending;
  }, [storedAudios]);

  // Clean up successfully uploaded audios
  const cleanupUploaded = useCallback(() => {
    setStoredAudios(prev => {
      const newMap = new Map();
      prev.forEach((audio, id) => {
        if (!audio.uploaded) {
          newMap.set(id, audio);
        }
      });
      console.log('🧹 Cleaned up uploaded audios, remaining:', newMap.size);
      return newMap;
    });
  }, []);

  // Get all stored audios (for debugging)
  const getAllStoredAudios = useCallback(() => {
    return Array.from(storedAudios.values());
  }, [storedAudios]);

  // Clear all stored audios (emergency cleanup)
  const clearAllAudios = useCallback(() => {
    console.log('🗑️ Clearing all stored audios');
    setStoredAudios(new Map());
    
    // Clear localStorage backups
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('audio_backup_')) {
          localStorage.removeItem(key);
        }
      });
      console.log('🗑️ Cleared all localStorage audio backups');
    } catch (error) {
      console.warn('⚠️ Could not clear localStorage backups:', error);
    }
  }, []);

  return {
    saveAudioLocally,
    markAsUploaded,
    incrementUploadAttempts,
    getPendingUploads,
    cleanupUploaded,
    getAllStoredAudios,
    clearAllAudios,
    storedCount: storedAudios.size
  };
} 