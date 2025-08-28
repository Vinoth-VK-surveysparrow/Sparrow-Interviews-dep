import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAssessment } from '@/contexts/AssessmentContext';

interface BehaviorMonitoringResponse {
  recent_flag_id: boolean;
  message?: string;
}

interface UseBehaviorMonitoringOptions {
  enabled?: boolean;
  delayBeforeStart?: number; // milliseconds to wait before starting monitoring
  pollingInterval?: number; // milliseconds between each check
}

interface UseBehaviorMonitoringReturn {
  isMonitoring: boolean;
  startMonitoring: () => void;
  stopMonitoring: () => void;
  flagCount: number;
  showWarning: boolean;
  warningMessage: string;
}

export function useBehaviorMonitoring(options: UseBehaviorMonitoringOptions = {}): UseBehaviorMonitoringReturn {
  const {
    enabled = true,
    delayBeforeStart = 25000, // 15 seconds default
    pollingInterval = 20000, // 10 seconds default
  } = options;

  const [isMonitoring, setIsMonitoring] = useState(false);
  const [flagCount, setFlagCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const { user } = useAuth();
  const { session } = useAssessment();

  const startTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(false);

  const checkBehavior = useCallback(async () => {
    if (!user?.email || !session.assessmentId || !isActiveRef.current) {
      return;
    }

    try {
      const encodedEmail = encodeURIComponent(user.email);
      // Use environment variable for proctoring API endpoint, fallback to default if not set
      const baseUrl = import.meta.env.VITE_PROCTORING_RESULTS_API || 'https://fizwdomhnwwc7avz3nufla3m5a0jhqvu.lambda-url.us-west-2.on.aws';
      const url = `${baseUrl}/results?email=${encodedEmail}&round=${session.assessmentId}`;
      
      console.log('🔍 Checking behavior monitoring:', { 
        email: user.email, 
        round: session.assessmentId,
        endpoint: url 
      });
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn('⚠️ Behavior monitoring endpoint returned non-OK status:', response.status);
        return;
      }

      const data: BehaviorMonitoringResponse = await response.json();
      console.log('📊 Behavior monitoring response:', data);

      if (data.recent_flag_id) {
        setFlagCount(prev => prev + 1);
        setWarningMessage('Do not look away from the screen and look into the camera when answering questions. Explain with your hands fully visible in front of the camera');
        setShowWarning(true);
        
        // Auto-hide warning after 5 seconds
        setTimeout(() => {
          setShowWarning(false);
        }, 5000);

        console.log('🚨 Behavior flag detected! Warning badge displayed to user.');
      }
    } catch (error) {
      console.error('❌ Error checking behavior monitoring:', error);
      // Don't show error to user to avoid disrupting assessment
    }
  }, [user?.email, session.assessmentId]);

  const startMonitoring = useCallback(() => {
    if (!enabled || !user?.email || !session.assessmentId) {
      console.log('🔍 Behavior monitoring not started:', { 
        enabled, 
        hasEmail: !!user?.email, 
        hasAssessmentId: !!session.assessmentId 
      });
      return;
    }

    // Clear any existing timeouts/intervals
    if (startTimeoutRef.current) {
      clearTimeout(startTimeoutRef.current);
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    console.log(`🔍 Starting behavior monitoring in ${delayBeforeStart}ms...`);
    setIsMonitoring(true);
    isActiveRef.current = true;
    setFlagCount(0);

    // Start monitoring after the specified delay
    startTimeoutRef.current = setTimeout(() => {
      if (!isActiveRef.current) return;

      console.log(`🔍 Behavior monitoring active - polling every ${pollingInterval}ms`);
      
      // Run first check immediately
      checkBehavior();
      
      // Set up polling interval
      pollingIntervalRef.current = setInterval(() => {
        if (isActiveRef.current) {
          checkBehavior();
        }
      }, pollingInterval);
    }, delayBeforeStart);
  }, [enabled, user?.email, session.assessmentId, delayBeforeStart, pollingInterval, checkBehavior]);

  const stopMonitoring = useCallback(() => {
    console.log('🔍 Stopping behavior monitoring');
    
    isActiveRef.current = false;
    setIsMonitoring(false);
    setShowWarning(false);
    setWarningMessage('');

    if (startTimeoutRef.current) {
      clearTimeout(startTimeoutRef.current);
      startTimeoutRef.current = null;
    }

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMonitoring();
    };
  }, [stopMonitoring]);

  // Auto-start monitoring when conditions are met
  useEffect(() => {
    if (enabled && user?.email && session.assessmentId && session.isActive && !isMonitoring) {
      console.log('🔍 Auto-starting behavior monitoring due to session changes');
      startMonitoring();
    }
  }, [enabled, user?.email, session.assessmentId, session.isActive, isMonitoring, startMonitoring]);

  return {
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    flagCount,
    showWarning,
    warningMessage,
  };
}
