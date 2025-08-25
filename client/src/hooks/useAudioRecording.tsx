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
      
      // Enhanced audio constraints
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      // Check if we have a valid audio track
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio tracks available');
      }
      
      console.log('Audio track info:', {
        label: audioTracks[0].label,
        enabled: audioTracks[0].enabled,
        muted: audioTracks[0].muted,
        readyState: audioTracks[0].readyState
      });
      
      // Choose the best available format
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/mp4';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = ''; // Use default
          }
        }
      }
      
      console.log('Using MIME type:', mimeType || 'default');
      
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        console.log('Data available event:', {
          size: event.data.size,
          type: event.data.type,
          timestamp: Date.now()
        });
        
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log('Audio chunk added, total chunks:', audioChunksRef.current.length);
          
          // Create URL for local preview
          if (audioChunksRef.current.length % 5 === 0) { // Update URL every 5 chunks
            try {
              const currentBlob = new Blob([...audioChunksRef.current], { 
                type: mimeType || 'audio/webm' 
              });
              const url = URL.createObjectURL(currentBlob);
              
              setAudioUrl(url);
            } catch (error) {
              console.error('Error creating audio preview:', error);
            }
          }
        } else {
          console.warn('Received empty or invalid data chunk');
        }
      };

      mediaRecorder.onstart = () => {
        console.log('Audio recording started successfully');
        setIsRecording(true);
      };

      mediaRecorder.onerror = (error) => {
        console.error('MediaRecorder error during recording:', error);
        setIsRecording(false);
      };

      // Start recording with shorter intervals for more reliable data collection
      mediaRecorder.start(500); // Collect data every 500ms
      console.log('Audio recording initialized');
      
      // Verify recording starts properly after a brief delay
      setTimeout(() => {
        if (mediaRecorder.state !== 'recording') {
          console.error('MediaRecorder failed to start recording, state:', mediaRecorder.state);
          throw new Error('Failed to start recording');
        }
      }, 100);
      
    } catch (error) {
      console.error('Error starting audio recording:', error);
      setIsRecording(false);
      throw error; // Rethrow to let caller handle
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || !isRecording) {
        
        resolve(null);
        return;
      }

      
      const mediaRecorder = mediaRecorderRef.current;
      
      // Immediately stop listening to data events to prevent further chunks
      mediaRecorder.ondataavailable = null;
      
      mediaRecorder.onstop = () => {
        try {
          console.log('stopRecording: MediaRecorder stopped, processing chunks:', {
            chunksCount: audioChunksRef.current.length,
            totalSize: audioChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0),
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
          
          // Use the same MIME type that was used for recording
          const recordedMimeType = audioChunksRef.current[0]?.type || 'audio/webm';
          const audioBlob = new Blob(audioChunksRef.current, { type: recordedMimeType });
          
          console.log('stopRecording: Created audio blob:', {
            size: audioBlob.size,
            type: audioBlob.type,
            chunksUsed: audioChunksRef.current.length,
            duration: 'unknown' // We could calculate this if needed
          });
          
          // Validate blob size
          if (audioBlob.size < 100) { // Very small blobs are likely empty
            console.warn('⚠️ Audio blob is very small, may contain no audio data');
          }
          
          const url = URL.createObjectURL(audioBlob);
          setAudioUrl(url);
          setIsRecording(false);
          
          // Stop all tracks to release the microphone
          const stream = streamRef.current || mediaRecorder.stream;
          if (stream) {
            
            stream.getTracks().forEach(track => {
              
              track.stop();
            });
            streamRef.current = null;
          }
          
          // Clear the media recorder reference
          mediaRecorderRef.current = null;
          
          
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
        
        track.stop();
      });
      streamRef.current = null;
    }
    
    setIsRecording(false);
    
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
