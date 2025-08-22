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

export function useSpeechRecognition(enableAutoRestart: boolean = true): UseSpeechRecognitionReturn {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [shouldKeepListening, setShouldKeepListening] = useState(false);
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
      
      return;
    }

    setShouldKeepListening(true);

    try {
      // Stop any existing recognition
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }

      const SpeechRecognitionConstructor = (window.SpeechRecognition || window.webkitSpeechRecognition) as SpeechRecognitionConstructor;
      if (!SpeechRecognitionConstructor) {
        
        return;
      }

      const recognition = new SpeechRecognitionConstructor();
      
      // Configure recognition
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        
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
              
            } else {
              // Normal update if under 15 words
              const now = Date.now();
              if (now - lastUpdateRef.current > 300 || finalTranscript) {
                setTranscript(currentTranscript);
                wordCountRef.current = words.length;
                lastUpdateRef.current = now;
                
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
                
              }, 3000);
            }
          }
        } catch (error) {
          console.error('Error processing speech result:', error);
        }
      };

      recognition.onerror = (event: any) => {
        
        setIsListening(false);
        
        // Don't auto-restart on network errors or other critical errors
        if (enableAutoRestart && shouldKeepListening && 
            (event.error === 'no-speech' || event.error === 'audio-capture') &&
            event.error !== 'network' && event.error !== 'aborted') {
          setTimeout(() => {
            if (recognitionRef.current === recognition && shouldKeepListening) {
              startListening();
            }
          }, 1000);
        }
      };

      recognition.onend = () => {
        
        setIsListening(false);
        
        // Only auto-restart if we should keep listening and auto-restart is enabled
        if (enableAutoRestart && recognitionRef.current === recognition && shouldKeepListening) {
          setTimeout(() => {
            if (shouldKeepListening) {
              startListening();
            }
          }, 100);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      
      
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      setIsListening(false);
    }
  }, [hasSupport]);

  const stopListening = useCallback(() => {
    setShouldKeepListening(false); // Stop auto-restart
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
