import { useState, useRef, useCallback, useEffect } from 'react';

interface UseSpeechRecognitionReturn {
  transcript: string;
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  hasSupport: boolean;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
  readonly resultIndex: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onstart: ((event: Event) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((event: Event) => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const clearTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isStartingRef = useRef(false);
  const lastUpdateRef = useRef(0);
  const wordCountRef = useRef(0);

  // Simple browser support check - silent fallback if not supported
  const hasSupport = (() => {
    if (typeof window === 'undefined') return false;
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  })();

  const startListening = useCallback(() => {
    if (!hasSupport) {
      console.log('Speech recognition not supported in this browser');
      return;
    }

    try {
      // Stop any existing recognition
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }

      const SpeechRecognitionConstructor = (window.SpeechRecognition || window.webkitSpeechRecognition) as SpeechRecognitionConstructor;
      if (!SpeechRecognitionConstructor) {
        console.log('SpeechRecognition constructor not available');
        return;
      }

      const recognition = new SpeechRecognitionConstructor();
      
      // Configure recognition
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        console.log('Speech recognition started');
        setIsListening(true);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        try {
          let finalTranscript = '';
          let interimTranscript = '';

          // Process all results
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            if (result && result[0]) {
              const transcript = result[0].transcript;
              if (result.isFinal) {
                finalTranscript += transcript;
              } else {
                interimTranscript += transcript;
              }
            }
          }

          // Use final transcript if available, otherwise interim
          const currentTranscript = (finalTranscript || interimTranscript).trim();
          
          if (currentTranscript) {
            // Count words in current transcript
            const words = currentTranscript.split(/\s+/).filter(word => word.length > 0);
            
            // If we exceed 15 words, clear and start fresh with new words
            if (words.length > 15) {
              // Keep only the last 15 words (most recent)
              const recentWords = words.slice(-15);
              const limitedTranscript = recentWords.join(' ');
              
              // Reset word count
              wordCountRef.current = recentWords.length;
              
              setTranscript(limitedTranscript);
              console.log('Transcript limited to 15 words:', limitedTranscript);
            } else {
              // Normal update if under 15 words
              const now = Date.now();
              if (now - lastUpdateRef.current > 300 || finalTranscript) {
                setTranscript(currentTranscript);
                wordCountRef.current = words.length;
                lastUpdateRef.current = now;
                console.log('Transcript updated:', currentTranscript, `(${words.length} words)`);
              }
            }

            // Clear transcript after final result (but keep listening for new input)
            if (finalTranscript) {
              if (clearTimeoutRef.current) {
                clearTimeout(clearTimeoutRef.current);
              }
              clearTimeoutRef.current = setTimeout(() => {
                setTranscript('');
                wordCountRef.current = 0;
                clearTimeoutRef.current = null;
                console.log('Transcript cleared, ready for new input');
              }, 3000);
            }
          }
        } catch (error) {
          console.error('Error processing speech result:', error);
        }
      };

      recognition.onerror = (event: any) => {
        console.log('Speech recognition error:', event.error);
        setIsListening(false);
        
        // Auto-restart on certain errors
        if (event.error === 'no-speech' || event.error === 'audio-capture') {
          setTimeout(() => {
            if (recognitionRef.current === recognition) {
              startListening();
            }
          }, 1000);
        }
      };

      recognition.onend = () => {
        console.log('Speech recognition ended');
        setIsListening(false);
        
        // Auto-restart if we're still supposed to be listening
        if (recognitionRef.current === recognition) {
          setTimeout(() => {
            startListening();
          }, 100);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      console.log('Starting speech recognition...');
      
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      setIsListening(false);
    }
  }, [hasSupport]);

  const stopListening = useCallback(() => {
    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
    } catch (error) {
      // Silent cleanup
    }
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    if (clearTimeoutRef.current) {
      clearTimeout(clearTimeoutRef.current);
      clearTimeoutRef.current = null;
    }
    setTranscript('');
    wordCountRef.current = 0;
    console.log('Transcript manually reset');
  }, []);

  useEffect(() => {
    return () => {
      stopListening();
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
      }
    };
  }, [stopListening]);

  return {
    transcript,
    isListening,
    startListening,
    stopListening,
    resetTranscript,
    hasSupport,
  };
}
