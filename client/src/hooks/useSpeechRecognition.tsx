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
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManualStopRef = useRef(false);
  const consecutiveErrorsRef = useRef(0);
  const pageVisibilityRef = useRef(true);

  // Simple browser support check - silent fallback if not supported
  const hasSupport = (() => {
    if (typeof window === 'undefined') return false;
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  })();

  // Page visibility handler to prevent freezing when tab becomes inactive
  useEffect(() => {
    const handleVisibilityChange = () => {
      pageVisibilityRef.current = !document.hidden;
      
      if (document.hidden) {
        console.log('🙈 Tab became inactive, pausing speech recognition');
        // Don't stop completely, just mark as inactive
      } else {
        console.log('👀 Tab became active, resuming speech recognition');
        // If we were listening before, restart recognition
        if (isListening && recognitionRef.current) {
          console.log('🔄 Restarting recognition after tab became active');
          startListening();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isListening]);

  const startListening = useCallback(() => {
    if (!hasSupport) {
      return;
    }

    // Don't start if tab is not visible (prevent memory leaks)
    if (!pageVisibilityRef.current) {
      console.log('🙈 Tab is not visible, delaying speech recognition start');
      return;
    }

    setShouldKeepListening(true);

    try {
      // Reset manual stop flag
      isManualStopRef.current = false;
      
      // Stop any existing recognition more gracefully
      if (recognitionRef.current) {
        try {
          isManualStopRef.current = true; // Prevent restart during cleanup
          recognitionRef.current.stop();
          recognitionRef.current = null;
        } catch (e) {
          console.log('Error stopping existing recognition:', e);
        }
      }

      // Clear all pending timers to prevent conflicts
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
      
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }

      const SpeechRecognitionConstructor = (window.SpeechRecognition || window.webkitSpeechRecognition) as SpeechRecognitionConstructor;
      if (!SpeechRecognitionConstructor) {
        return;
      }

      const recognition = new SpeechRecognitionConstructor();
      
      // Enhanced configuration for better reliability
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      // Helper function to schedule restart with intelligent backoff
      const scheduleRestart = (delay: number, errorType?: string) => {
        // Don't restart if we manually stopped or tab is not visible
        if (isManualStopRef.current || !pageVisibilityRef.current) {
          console.log('🚫 Skipping restart due to manual stop or inactive tab');
          return;
        }
        
        // Implement exponential backoff for consecutive errors
        if (errorType && errorType !== 'no-speech') {
          consecutiveErrorsRef.current++;
          const backoffDelay = Math.min(delay * Math.pow(2, consecutiveErrorsRef.current - 1), 10000);
          console.log(`⏰ Scheduling restart with backoff: ${backoffDelay}ms (consecutive errors: ${consecutiveErrorsRef.current})`);
          delay = backoffDelay;
        } else {
          // Reset error counter for successful operations
          consecutiveErrorsRef.current = 0;
        }
        
        if (restartTimeoutRef.current) {
          clearTimeout(restartTimeoutRef.current);
        }
        
        restartTimeoutRef.current = setTimeout(() => {
          if (recognitionRef.current === recognition && !isStartingRef.current && !isManualStopRef.current) {
            console.log('🔄 Executing scheduled restart...');
            isStartingRef.current = true;
            startListening();
          }
        }, delay);
      };

      recognition.onstart = () => {
        setIsListening(true);
        isStartingRef.current = false;
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
            
            // Dynamic transcript management - keep reasonable window
            if (words.length > 20) {
              // Keep only the last 20 words (most recent)
              const recentWords = words.slice(-20);
              const limitedTranscript = recentWords.join(' ');
              
              // Reset word count
              wordCountRef.current = recentWords.length;
              
              setTranscript(limitedTranscript);
            } else {
              // Normal update with throttling
              const now = Date.now();
              if (now - lastUpdateRef.current > 200 || finalTranscript) {
                setTranscript(currentTranscript);
                wordCountRef.current = words.length;
                lastUpdateRef.current = now;
              }
            }

            // Extended clearing time for better word detection
            if (finalTranscript) {
              if (clearTimeoutRef.current) {
                clearTimeout(clearTimeoutRef.current);
              }
              clearTimeoutRef.current = setTimeout(() => {
                setTranscript('');
                wordCountRef.current = 0;
                clearTimeoutRef.current = null;
                console.log('📝 Transcript cleared, ready for new input');
              }, 5000); // Increased to 5 seconds
              
              // Reset silence timeout when we get final speech
              if (silenceTimeoutRef.current) {
                clearTimeout(silenceTimeoutRef.current);
                silenceTimeoutRef.current = null;
              }
            } else {
              // Set silence timeout for interim results
              if (silenceTimeoutRef.current) {
                clearTimeout(silenceTimeoutRef.current);
              }
              silenceTimeoutRef.current = setTimeout(() => {
                console.log('🔇 Extended silence detected, keeping recognition alive');
                // Just log, don't restart - let the natural onend handle it
              }, 8000); // 8 seconds silence tolerance
            }
          }
        } catch (error) {
          console.error('❌ Error processing speech result:', error);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('🚨 Speech recognition error:', event.error, event.message);
        setIsListening(false);
        
        // Enhanced error handling with specific strategies
        const errorType = event.error;
        
        // Don't restart if manually stopped
        if (isManualStopRef.current) {
          console.log('🚫 Manual stop in progress, ignoring error');
          return;
        }
        
        if (errorType === 'no-speech') {
          console.log('🔇 No speech detected, restarting recognition...');
          scheduleRestart(1000, errorType);
        } else if (errorType === 'audio-capture') {
          console.log('🎤 Audio capture failed, retrying...');
          scheduleRestart(2000, errorType);
        } else if (errorType === 'not-allowed') {
          console.error('🚫 Microphone permission denied');
          consecutiveErrorsRef.current = 0; // Don't count permission errors
          // Don't restart for permission errors
        } else if (errorType === 'network') {
          console.log('🌐 Network error, retrying with delay...');
          scheduleRestart(3000, errorType);
        } else if (errorType === 'aborted') {
          console.log('⏹️ Recognition aborted, restarting...');
          scheduleRestart(500, errorType);
        } else if (errorType === 'service-not-allowed') {
          console.error('🚫 Speech service not allowed');
          consecutiveErrorsRef.current = 0;
          // Don't restart for service errors
        } else {
          console.log(`🔄 Unknown error (${errorType}), attempting restart...`);
          scheduleRestart(2000, errorType);
        }
      };

      recognition.onend = () => {
        console.log('🔚 Speech recognition ended');
        setIsListening(false);
        
        // Clear silence timeout when recognition ends
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }
        
        // Only auto-restart if we're still supposed to be listening and not manually stopped
        if (recognitionRef.current === recognition && !isStartingRef.current && !isManualStopRef.current) {
          console.log('🔄 Auto-restarting speech recognition...');
          // Reset consecutive errors on normal end (successful cycle)
          consecutiveErrorsRef.current = 0;
          scheduleRestart(200);
        } else if (isManualStopRef.current) {
          console.log('✋ Recognition ended due to manual stop');
        }
      };

      recognitionRef.current = recognition;
      isStartingRef.current = true;
      
      // Add delay before starting to ensure proper initialization
      setTimeout(() => {
        try {
          if (recognitionRef.current === recognition) {
            recognition.start();
            console.log('🚀 Speech recognition start command sent');
          }
        } catch (startError) {
          console.error('❌ Failed to start recognition:', startError);
          setIsListening(false);
          isStartingRef.current = false;
        }
      }, 100);
      
    } catch (error) {
      console.error('❌ Failed to initialize speech recognition:', error);
      setIsListening(false);
      isStartingRef.current = false;
    }
  }, [hasSupport]);

  const stopListening = useCallback(() => {
    setShouldKeepListening(false); // Stop auto-restart
    try {
      // Set manual stop flag to prevent auto-restart
      isManualStopRef.current = true;
      consecutiveErrorsRef.current = 0; // Reset error counter
      
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      
      // Clear all timers
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
      
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
    } catch (error) {
      console.log('Error during stop cleanup:', error);
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
      // Comprehensive cleanup on unmount
      stopListening();
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
        clearTimeoutRef.current = null;
      }
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
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
