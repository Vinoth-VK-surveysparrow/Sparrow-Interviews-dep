import  clarity  from '@microsoft/clarity';

// Microsoft Clarity Service
export class ClarityService {
  private static isInitialized = false;

  static init(): void {
    if (this.isInitialized) {
      console.warn('⚠️ Microsoft Clarity already initialized');
      return;
    }

    try {
      const projectId = import.meta.env.VITE_CLARITY_PROJECT_ID;
      if (!projectId || projectId === 'YOUR_PROJECT_ID') {
        console.warn('⚠️ Microsoft Clarity project ID not configured. Please set VITE_CLARITY_PROJECT_ID in your environment variables.');
        return;
      }
      (function (c: any, l: Document, a: string, r: string, i: string, t?: HTMLScriptElement, y?: Node) {
        (c as any)[a] =
          (c as any)[a] ||
          function (...args: any[]) {
            ((c as any)[a].q = (c as any)[a].q || []).push(args);
          };
        t = l.createElement(r) as HTMLScriptElement;
        t.async = true;
        t.src = 'https://www.clarity.ms/tag/' + i;
        y = l.getElementsByTagName(r)[0];
        y.parentNode!.insertBefore(t, y);
      })(window, document, 'clarity', 'script', projectId);
      this.isInitialized = true;
      console.log('✅ Microsoft Clarity initialized successfully (ID:', projectId, ')');
    } catch (error) {
      console.error('❌ Failed to initialize Microsoft Clarity:', error);
    }
  }

  static trackEvent(eventName: string, customData?: Record<string, any>): void {
    if (!this.isInitialized) {
      console.warn('⚠️ Clarity not initialized. Call ClarityService.init() first');
      return;
    }
    try {
      (<any>window).clarity('event', eventName, customData);
      console.log(`[CLARITY] Event tracked: ${eventName}`, customData);
    } catch (error) {
      console.error('❌ Failed to track Clarity event:', error);
    }
  }

  static setTag(key: string, value: string): void {
    if (!this.isInitialized) {
      console.warn('⚠️ Clarity not initialized. Call ClarityService.init() first');
      return;
    }
    try {
      (<any>window).clarity('set', key, value);
      console.log(`[CLARITY] Tag set: ${key}=${value}`);
    } catch (error) {
      console.error('❌ Failed to set Clarity tag:', error);
    }
  }

  static setUserId(userId: string, displayName?: string): void {
    if (!this.isInitialized) {
      console.warn('⚠️ Clarity not initialized. Call ClarityService.init() first');
      return;
    }
    try {
      const userIdentifier = displayName || userId;
      (<any>window).clarity('identify', userIdentifier);
      console.log(`[CLARITY] User identified: ${userIdentifier}`);
      if (displayName && userId !== displayName) {
        this.setTag('user_email', userId);
      }
    } catch (error) {
      console.error('❌ Failed to identify user in Clarity:', error);
    }
  }

  static trackPageView(pageName: string, customData?: Record<string, any>): void {
    this.trackEvent('page_view', {
      page_name: pageName,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      ...customData,
    });
  }

  static trackAssessmentEvent(eventType: string, assessmentData: Record<string, any>): void {
    this.trackEvent(`assessment_${eventType}`, {
      ...assessmentData,
      timestamp: new Date().toISOString(),
    });
  }

  static trackUserAction(actionType: string, actionData?: Record<string, any>): void {
    this.trackEvent(`user_${actionType}`, {
      ...actionData,
      timestamp: new Date().toISOString(),
    });
  }

  static isReady(): boolean {
    return this.isInitialized;
  }
}

export const clarityService = ClarityService;

