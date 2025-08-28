import { useEffect, useCallback } from 'react';
import { clarityService } from '@/lib/clarityService';

export interface ClarityHookReturn {
  trackEvent: (eventName: string, customData?: Record<string, any>) => void;
  trackPageView: (pageName: string, customData?: Record<string, any>) => void;
  trackAssessmentEvent: (eventType: string, assessmentData: Record<string, any>) => void;
  trackUserAction: (actionType: string, actionData?: Record<string, any>) => void;
  setTag: (key: string, value: string) => void;
  setUserId: (userId: string, displayName?: string) => void;
  isReady: boolean;
}

export function useClarity(
  autoTrackPageView: boolean = true,
  pageName?: string
): ClarityHookReturn {
  
  // Auto-track page views on mount
  useEffect(() => {
    if (autoTrackPageView && clarityService.isReady()) {
      const currentPageName = pageName || document.title || window.location.pathname;
      clarityService.trackPageView(currentPageName);
    }
  }, [autoTrackPageView, pageName]);

  const trackEvent = useCallback((eventName: string, customData?: Record<string, any>) => {
    clarityService.trackEvent(eventName, customData);
  }, []);

  const trackPageView = useCallback((pageName: string, customData?: Record<string, any>) => {
    clarityService.trackPageView(pageName, customData);
  }, []);

  const trackAssessmentEvent = useCallback((eventType: string, assessmentData: Record<string, any>) => {
    clarityService.trackAssessmentEvent(eventType, assessmentData);
  }, []);

  const trackUserAction = useCallback((actionType: string, actionData?: Record<string, any>) => {
    clarityService.trackUserAction(actionType, actionData);
  }, []);

  const setTag = useCallback((key: string, value: string) => {
    clarityService.setTag(key, value);
  }, []);

  const setUserId = useCallback((userId: string, displayName?: string) => {
    clarityService.setUserId(userId, displayName);
  }, []);

  return {
    trackEvent,
    trackPageView,
    trackAssessmentEvent,
    trackUserAction,
    setTag,
    setUserId,
    isReady: clarityService.isReady()
  };
}
