import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAssessment } from '@/contexts/AssessmentContext';

// Mapping of flag reasons to user-friendly warning messages
const FLAG_REASON_MESSAGES: Record<string, string> = {
  'Suspicious Gaze Direction': 'Do not look away from the screen; keep your eyes focused on the camera.',
  'Hands Not Visible': 'Keep both hands clearly visible in front of the camera at all times.',
  'Headphones Detected': 'Remove any headphones, earbuds, or audio devices before continuing the assessment.',
  'Electronic Device Detected': 'Do not use or keep any electronic devices near you during the assessment.',
  'Profile Not Clearly Visible': 'Sit facing the camera directly with your full face clearly visible.',
  'Looking Outside Screen': 'Avoid looking outside the screen; stay focused on the assessment window.',
};

interface BehaviorMonitoringResponse {
  email: string;
  round: string;
  recent_flag_id: boolean;
  flag_count: number;
  total_images: number;
  flag_reason: string;
  message?: string;
}

interface UseBehaviorMonitoringOptions {
  enabled?: boolean;
  delayBeforeStart?: number; // milliseconds to wait before starting monitoring (default: 15 seconds)
  pollingInterval?: number; // milliseconds between each check (default: 10 seconds)
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
      const baseUrl = import.meta.env.VITE_PROCTORING_RESULTS_API || 'https://fizwdomhnwwc7avz3nufla3m5a0jhqvu.lambda-url.us-west-2.on.aws/results';
      const url = `${baseUrl}?email=${encodedEmail}&round=${session.assessmentId}`;
      
      console.log('🔍 Checking behavior monitoring:', { email: user.email, round: session.assessmentId });
      
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
        
        // Parse flag_reason to find the most frequent violation
        // Format: "Profile Not Clearly Visible (40%), Suspicious Gaze Direction (31%), ..."
        const reasonEntries = data.flag_reason?.split(',').map(r => r.trim()).filter(r => r) || [];
        
        console.log('🔍 Raw reasons from API:', reasonEntries);
        
        // Parse each entry to extract reason and percentage
        const parsedReasons: Array<{ reason: string; percentage: number }> = [];
        
        reasonEntries.forEach(entry => {
          // Match pattern: "Reason Text (XX%)"
          const match = entry.match(/^(.+?)\s*\((\d+)%\)$/);
          if (match) {
            const reason = match[1].trim();
            const percentage = parseInt(match[2], 10);
            parsedReasons.push({ reason, percentage });
          } else {
            // If no percentage found, treat the whole entry as reason with 0%
            parsedReasons.push({ reason: entry.trim(), percentage: 0 });
          }
        });
        
        console.log('📊 Parsed reasons with percentages:', parsedReasons);
        
        // Sort by percentage (highest first)
        parsedReasons.sort((a, b) => b.percentage - a.percentage);
        
        console.log('📊 Sorted by percentage:', parsedReasons);
        
        // Find the most frequent reason, skipping "Multiple Violations" and "No Violations Detected"
        let mostFrequentReason = '';
        
        for (const entry of parsedReasons) {
          if (entry.reason !== 'Multiple Violations' && entry.reason !== 'No Violations Detected') {
            mostFrequentReason = entry.reason;
            break;
          }
        }
        
        // If no valid reason found, use first available (even if it's Multiple Violations)
        if (!mostFrequentReason && parsedReasons.length > 0) {
          // Skip "No Violations Detected" but allow others
          for (const entry of parsedReasons) {
            if (entry.reason !== 'No Violations Detected') {
              mostFrequentReason = entry.reason;
              break;
            }
          }
        }
        
        // If still no reason, use the original flag_reason
        if (!mostFrequentReason) {
          mostFrequentReason = data.flag_reason || '';
        }
        
        console.log('🎯 Selected most frequent reason:', mostFrequentReason);
        console.log('🔑 Available message keys:', Object.keys(FLAG_REASON_MESSAGES));
        console.log('✅ Has exact match?', FLAG_REASON_MESSAGES.hasOwnProperty(mostFrequentReason));
        
        // Get appropriate warning message based on most frequent flag reason
        let warningMessage = FLAG_REASON_MESSAGES[mostFrequentReason];
        
        // If no exact match found, try case-insensitive matching
        if (!warningMessage) {
          const matchedKey = Object.keys(FLAG_REASON_MESSAGES).find(
            key => key.toLowerCase() === mostFrequentReason.toLowerCase()
          );
          if (matchedKey) {
            warningMessage = FLAG_REASON_MESSAGES[matchedKey];
            console.log('✅ Found case-insensitive match:', matchedKey);
          }
        }
        
        // Final fallback
        if (!warningMessage) {
          warningMessage = "Do not look away from the screen and look at the camera. Keep your hands visible in front of the camera.";
          console.warn('⚠️ No matching message found for:', mostFrequentReason);
        }
        
        // Show warning badge
        setWarningMessage(warningMessage);
        setShowWarning(true);

        console.log('🚨 Behavior flag detected!', { 
          flag_reason: data.flag_reason,
          parsed_reasons: parsedReasons,
          most_frequent_reason: mostFrequentReason,
          message: warningMessage,
          flag_count: data.flag_count 
        });
        
        // Auto-hide warning after 5 seconds
        setTimeout(() => {
          setShowWarning(false);
        }, 5000);
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
    setShowWarning(false);
    setWarningMessage('');

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
