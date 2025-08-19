import { useState, useRef, useCallback, useEffect } from 'react';
import { useAssessment } from '@/contexts/AssessmentContext';

interface UseAudioRecordingReturn {
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  audioUrl: string | null;
  forceCleanup: () => void;
}

export function useAudioRecording(): UseAudioRecordingReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  // Removed S3 dependencies - Assessment component handles upload

  const startRecording = useCallback(async () => {
    try {
      console.log('Starting audio recording...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log('Audio data available:', event.data.size);
          audioChunksRef.current.push(event.data);
          
          // Create URL for local preview (no IndexedDB saving)
          if (audioChunksRef.current.length % 10 === 0) { // Update URL every 10 chunks
            try {
              const currentBlob = new Blob([...audioChunksRef.current], { type: 'audio/webm' });
              const url = URL.createObjectURL(currentBlob);
              console.log('Updating audio preview URL:', currentBlob.size);
              setAudioUrl(url);
            } catch (error) {
              console.error('Error creating audio preview:', error);
            }
          }
        }
      };

      mediaRecorder.onstart = () => {
        console.log('Audio recording started successfully');
      };

      mediaRecorder.onerror = (error) => {
        console.error('MediaRecorder error during recording:', error);
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      console.log('Audio recording initialized');
    } catch (error) {
      console.error('Error starting audio recording:', error);
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || !isRecording) {
        console.log('stopRecording: Already stopped or no recorder');
        resolve(null);
        return;
      }

      console.log('stopRecording: Stopping MediaRecorder...');
      const mediaRecorder = mediaRecorderRef.current;
      
      // Immediately stop listening to data events to prevent further chunks
      mediaRecorder.ondataavailable = null;
      
      mediaRecorder.onstop = () => {
        try {
          console.log('stopRecording: MediaRecorder stopped, processing chunks:', {
            chunksCount: audioChunksRef.current.length,
            chunksDetails: audioChunksRef.current.map((chunk, i) => ({ 
              index: i, 
              size: chunk.size, 
              type: chunk.type 
            }))
          });
          
          if (audioChunksRef.current.length === 0) {
            console.error('❌ No audio chunks available - recording may have failed');
            setIsRecording(false);
            mediaRecorderRef.current = null;
            resolve(null);
            return;
          }
          
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          console.log('stopRecording: Created audio blob:', {
            size: audioBlob.size,
            type: audioBlob.type,
            chunksUsed: audioChunksRef.current.length
          });
          
          const url = URL.createObjectURL(audioBlob);
          setAudioUrl(url);
          setIsRecording(false);
          
          // Stop all tracks to release the microphone
          const stream = streamRef.current || mediaRecorder.stream;
          if (stream) {
            console.log('stopRecording: Stopping microphone tracks');
            stream.getTracks().forEach(track => {
              console.log('Stopping track:', track.kind, track.readyState);
              track.stop();
            });
            streamRef.current = null;
          }
          
          // Clear the media recorder reference
          mediaRecorderRef.current = null;
          
          console.log('✅ stopRecording: Complete, final blob size:', audioBlob.size);
          resolve(audioBlob);
        } catch (error) {
          console.error('❌ Error in recording stop handler:', error);
          setIsRecording(false);
          mediaRecorderRef.current = null;
          resolve(null);
        }
      };

      mediaRecorder.onerror = (error) => {
        console.error('MediaRecorder error during stop:', error);
        setIsRecording(false);
        mediaRecorderRef.current = null;
        resolve(null);
      };

      try {
        // Set state to false immediately to prevent new events
        setIsRecording(false);
        mediaRecorder.stop();
      } catch (error) {
        console.error('Error stopping MediaRecorder:', error);
        setIsRecording(false);
        mediaRecorderRef.current = null;
        resolve(null);
      }
    });
  }, [isRecording]);

  // Force cleanup function
  const forceCleanup = useCallback(() => {
    console.log('forceCleanup: Forcing audio recording cleanup');
    
    // Stop MediaRecorder if active
    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.ondataavailable = null;
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.onerror = null;
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch (error) {
        console.error('Error force stopping MediaRecorder:', error);
      }
      mediaRecorderRef.current = null;
    }
    
    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        console.log('Force stopping track:', track.kind, track.readyState);
        track.stop();
      });
      streamRef.current = null;
    }
    
    setIsRecording(false);
    console.log('forceCleanup: Complete');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      forceCleanup();
    };
  }, [forceCleanup]);

  return {
    isRecording,
    startRecording,
    stopRecording,
    audioUrl,
    forceCleanup,
  };
}
