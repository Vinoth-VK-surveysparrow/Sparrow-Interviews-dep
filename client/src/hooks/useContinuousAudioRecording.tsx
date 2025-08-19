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
        console.log('⚠️ Continuous recording already in progress');
        return;
      }

      console.log('🎤 Starting continuous audio recording for entire assessment...');
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
          console.log('📊 Continuous audio data chunk:', event.data.size, 'bytes');
          audioChunksRef.current.push(event.data);
          
          // Update preview URL every 30 seconds to show progress
          if (audioChunksRef.current.length % 30 === 0) {
            try {
              const currentBlob = new Blob([...audioChunksRef.current], { type: 'audio/webm' });
              const url = URL.createObjectURL(currentBlob);
              console.log('🔄 Updating continuous audio preview:', {
                totalSize: currentBlob.size,
                chunks: audioChunksRef.current.length,
                duration: recordingDuration
              });
              setAudioUrl(url);
            } catch (error) {
              console.error('❌ Error creating continuous audio preview:', error);
            }
          }
        }
      };

      mediaRecorder.onstart = () => {
        console.log('✅ Continuous audio recording started successfully');
        setIsRecording(true);
      };

      mediaRecorder.onerror = (error) => {
        console.error('❌ Continuous MediaRecorder error:', error);
        setIsRecording(false);
      };

      mediaRecorder.onstop = () => {
        console.log('⏹️ Continuous audio recording stopped');
        setIsRecording(false);
        
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }
      };

      // Start recording in chunks of 10 seconds for better data flow
      mediaRecorder.start(10000);
      console.log('🎙️ Continuous recording started with 10-second chunks');

    } catch (error) {
      console.error('❌ Error starting continuous audio recording:', error);
      setIsRecording(false);
    }
  }, [isRecording, recordingDuration]);

  const stopContinuousRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || !isRecording) {
        console.log('⚠️ stopContinuousRecording: No active recording to stop');
        resolve(null);
        return;
      }

      console.log('⏹️ Stopping continuous recording...');
      const mediaRecorder = mediaRecorderRef.current;
      
      // Calculate and preserve final duration before stopping
      const finalDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);
      console.log('📊 Final recording duration will be:', finalDuration, 'seconds');

      mediaRecorder.onstop = () => {
        try {
          console.log('📦 Processing continuous recording chunks:', {
            chunksCount: audioChunksRef.current.length,
            finalDuration: finalDuration,
            chunksDetails: audioChunksRef.current.map((chunk, i) => ({ 
              index: i, 
              size: chunk.size, 
              type: chunk.type 
            }))
          });

          if (audioChunksRef.current.length === 0) {
            console.error('❌ No audio chunks available from continuous recording');
            setIsRecording(false);
            mediaRecorderRef.current = null;
            resolve(null);
            return;
          }

          const finalAudioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          console.log('✅ Continuous recording complete:', {
            finalSize: finalAudioBlob.size,
            finalType: finalAudioBlob.type,
            finalDurationSeconds: finalDuration,
            chunksUsed: audioChunksRef.current.length
          });

          const url = URL.createObjectURL(finalAudioBlob);
          setAudioUrl(url);
          
          // Set final duration and stop recording state
          setRecordingDuration(finalDuration);
          setIsRecording(false);

          // Stop all tracks to release the microphone
          const stream = streamRef.current || mediaRecorder.stream;
          if (stream) {
            console.log('🔇 Stopping microphone tracks after continuous recording');
            stream.getTracks().forEach(track => {
              console.log('Stopping track:', track.kind, track.readyState);
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

          console.log('✅ Continuous recording stopped successfully:', {
            finalBlobSize: finalAudioBlob.size,
            finalDuration: finalDuration,
            recordingStopped: true
          });
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
    console.log('🧹 Force cleanup continuous recording...');
    
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
      console.log('✅ Preserving final recording duration:', finalDuration, 'seconds');
    }
    
    // Don't clear audio chunks in case we need them for recovery
    console.log('✅ Continuous recording cleanup complete, duration preserved:', finalDuration);
  }, [recordingDuration]);

  // Reset function for starting new assessment
  const resetRecording = useCallback(() => {
    console.log('🔄 Resetting recording state for new assessment...');
    setRecordingDuration(0);
    setAudioUrl(null);
    audioChunksRef.current = [];
    startTimeRef.current = 0;
    console.log('✅ Recording state reset complete');
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