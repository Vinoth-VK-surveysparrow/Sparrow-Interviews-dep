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

  // Simple browser support check - silent fallback if not supported
  const hasSupport = (() => {
    if (typeof window === 'undefined') return false;
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  })();

  const startListening = useCallback(() => {
    if (!hasSupport) return;

    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }

      const SpeechRecognitionConstructor = (window.SpeechRecognition || window.webkitSpeechRecognition) as SpeechRecognitionConstructor;
      const recognition = new SpeechRecognitionConstructor();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        try {
          const lastResult = event.results[event.results.length - 1];
          
          if (lastResult && lastResult[0]) {
            const currentTranscript = lastResult[0].transcript.trim();
            
            if (currentTranscript) {
              // Throttle updates to prevent excessive re-renders
              const now = Date.now();
              if (now - lastUpdateRef.current > 500 || lastResult.isFinal) {
                setTranscript(currentTranscript);
                lastUpdateRef.current = now;
              }

              if (clearTimeoutRef.current) {
                clearTimeout(clearTimeoutRef.current);
                clearTimeoutRef.current = null;
              }

              if (lastResult.isFinal) {
                clearTimeoutRef.current = setTimeout(() => {
                  setTranscript('');
                  clearTimeoutRef.current = null;
                }, 3000);
              }
            }
          }
        } catch (error) {
          // Silent error handling
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
        // Silent error handling - no retries or logs
      };

      recognition.onend = () => {
        setIsListening(false);
        // No auto-restart - keep it simple
      };

      recognitionRef.current = recognition;
      recognition.start();
      
    } catch (error) {
      // Silent fallback if speech recognition fails
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
