import { useState, useRef, useCallback } from 'react';

interface UseContinuousAudioRecordingReturn {
  isRecording: boolean;
  startContinuousRecording: () => Promise<void>;
  stopContinuousRecording: () => Promise<Blob | null>;
  audioUrl: string | null;
  recordingDuration: number;
  forceCleanup: () => void;
}

export function useContinuousAudioRecording(): UseContinuousAudioRecordingReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startContinuousRecording = useCallback(async () => {
    try {
      if (isRecording) {
        
        return;
      }

      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      startTimeRef.current = Date.now();
      setRecordingDuration(0);

      // Only update duration when needed (not every second to prevent flickering)
      // Duration will be calculated when recording stops

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          
          audioChunksRef.current.push(event.data);
          
          // Update preview URL every 30 seconds to show progress
          if (audioChunksRef.current.length % 30 === 0) {
            try {
              const currentBlob = new Blob([...audioChunksRef.current], { type: 'audio/webm' });
              const url = URL.createObjectURL(currentBlob);
              
              setAudioUrl(url);
            } catch (error) {
              console.error('❌ Error creating continuous audio preview:', error);
            }
          }
        }
      };

      mediaRecorder.onstart = () => {
        
        setIsRecording(true);
      };

      mediaRecorder.onerror = (error) => {
        console.error('❌ Continuous MediaRecorder error:', error);
        setIsRecording(false);
      };

      mediaRecorder.onstop = () => {
        
        setIsRecording(false);
        
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }
      };

      // Start recording in chunks of 10 seconds for better data flow
      mediaRecorder.start(10000);
      

    } catch (error) {
      console.error('❌ Error starting continuous audio recording:', error);
      setIsRecording(false);
    }
  }, [isRecording, recordingDuration]);

  const stopContinuousRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || !isRecording) {
        
        resolve(null);
        return;
      }

      
      const mediaRecorder = mediaRecorderRef.current;
      
      // Calculate and preserve final duration before stopping
      const finalDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);
      

      mediaRecorder.onstop = () => {
        try {
          

          if (audioChunksRef.current.length === 0) {
            console.error('❌ No audio chunks available from continuous recording');
            setIsRecording(false);
            mediaRecorderRef.current = null;
            resolve(null);
            return;
          }

          const finalAudioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          

          const url = URL.createObjectURL(finalAudioBlob);
          setAudioUrl(url);
          
          // Set final duration and stop recording state
          setRecordingDuration(finalDuration);
          setIsRecording(false);

          // Stop all tracks to release the microphone
          const stream = streamRef.current || mediaRecorder.stream;
          if (stream) {
            
            stream.getTracks().forEach(track => {
              
              track.stop();
            });
            streamRef.current = null;
          }

          // Clear duration interval but DON'T reset duration
          if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
            durationIntervalRef.current = null;
          }

          // Clear the media recorder reference
          mediaRecorderRef.current = null;

          
          resolve(finalAudioBlob);
        } catch (error) {
          console.error('❌ Error processing continuous recording stop:', error);
          setIsRecording(false);
          mediaRecorderRef.current = null;
          resolve(null);
        }
      };

      mediaRecorder.onerror = (error) => {
        console.error('❌ MediaRecorder error during continuous stop:', error);
        setIsRecording(false);
        mediaRecorderRef.current = null;
        resolve(null);
      };

      // Stop the recording
      if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    });
  }, [isRecording]);

  const forceCleanup = useCallback(() => {
    
    
    // Preserve final duration before cleanup
    const finalDuration = startTimeRef.current > 0 ? 
      Math.floor((Date.now() - startTimeRef.current) / 1000) : recordingDuration;
    
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch (error) {
        console.warn('⚠️ Error stopping MediaRecorder during cleanup:', error);
      }
      mediaRecorderRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }

    setIsRecording(false);
    // Keep the final duration, don't reset to 0
    if (finalDuration > 0) {
      setRecordingDuration(finalDuration);
      
    }
    
    // Don't clear audio chunks in case we need them for recovery
    
  }, [recordingDuration]);

  // Reset function for starting new assessment
  const resetRecording = useCallback(() => {
    
    setRecordingDuration(0);
    setAudioUrl(null);
    audioChunksRef.current = [];
    startTimeRef.current = 0;
    
  }, []);

  return {
    isRecording,
    startContinuousRecording,
    stopContinuousRecording,
    audioUrl,
    recordingDuration,
    forceCleanup,
    resetRecording,
  };
} 