import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

export function AssessmentSecurity() {
  const [location] = useLocation();
  const [showCopyWarning, setShowCopyWarning] = useState(false);
  const [showTabWarning, setShowTabWarning] = useState(false);
  const [isFullscreenTransition, setIsFullscreenTransition] = useState(false);
  const [securityInitialized, setSecurityInitialized] = useState(false);
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  
  // Refs to prevent infinite loops
  const fullscreenAttemptedRef = useRef(false);
  const cleanupExecutedRef = useRef(false);

  // Check if user is in assessment or rules (security-critical routes)
  const isInSecureMode = location.startsWith('/rules/') || 
                        location.startsWith('/assessment/') || 
                        location.startsWith('/question/') ||
                        location.startsWith('/conductor/') ||
                        location.startsWith('/triple-step/');

  useEffect(() => {
    if (!isInSecureMode) {
      // Reset refs when leaving secure mode
      fullscreenAttemptedRef.current = false;
      cleanupExecutedRef.current = false;
      return;
    }

    // Prevent running multiple times
    if (cleanupExecutedRef.current) return;
    cleanupExecutedRef.current = false;

    // Request fullscreen when entering assessment
    const enterFullscreen = async () => {
      // Prevent multiple fullscreen attempts
      if (fullscreenAttemptedRef.current) return;
      fullscreenAttemptedRef.current = true;
      
      try {
        setIsFullscreenTransition(true);
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if ((document.documentElement as any).webkitRequestFullscreen) {
          await (document.documentElement as any).webkitRequestFullscreen();
        } else if ((document.documentElement as any).msRequestFullscreen) {
          await (document.documentElement as any).msRequestFullscreen();
        }
        
        
        // Allow time for fullscreen transition to complete
        setTimeout(() => {
          setIsFullscreenTransition(false);
          setSecurityInitialized(true);
        }, 1500);
      } catch (error) {
        console.warn('⚠️ Could not enter fullscreen mode:', error);
        setIsFullscreenTransition(false);
        setSecurityInitialized(true);
      }
    };

    // Only attempt fullscreen if not already attempted
    if (!fullscreenAttemptedRef.current) {
      enterFullscreen();
    }

    // Detect permission dialogs
    const checkForPermissionDialogs = () => {
      // More comprehensive check for browser permission dialogs
      const hasActiveModals = document.querySelector('[role="dialog"]') ||
                            document.querySelector('.permission-dialog') ||
                            document.querySelector('[data-permission-dialog]') ||
                            document.activeElement?.closest('[role="dialog"]') ||
                            // Check for common browser permission dialog selectors
                            document.querySelector('div[class*="permission"]') ||
                            document.querySelector('div[class*="Permission"]') ||
                            document.querySelector('div[id*="permission"]') ||
                            // Check if focus is on browser chrome elements
                            document.activeElement === document.body ||
                            document.activeElement === null;
      
      const isPermissionDialogLikely = hasActiveModals !== null ||
                                      // Check if window lost focus to potential permission dialog
                                      (!document.hasFocus() && !document.hidden);
      
      if (isPermissionDialogLikely) {
        setPermissionDialogOpen(true);
        
      } else {
        setPermissionDialogOpen(false);
      }
    };

    // Monitor for permission dialogs
    const permissionObserver = new MutationObserver(checkForPermissionDialogs);
    permissionObserver.observe(document.body, { 
      childList: true, 
      subtree: true, 
      attributes: true 
    });

    // Additional listeners to detect permission requests
    const handleFocusChange = () => {
      setTimeout(checkForPermissionDialogs, 100);
    };

    const handleWindowBlurForPermissions = () => {
      // When window loses focus, it might be due to permission dialog
      setTimeout(() => {
        if (!document.hasFocus() && !document.hidden) {
          setPermissionDialogOpen(true);
        }
      }, 100);
    };

    const handleWindowFocusForPermissions = () => {
      // When window regains focus, check if permission dialog closed
      setTimeout(checkForPermissionDialogs, 100);
    };

    // Monitor focus changes that might indicate permission dialogs
    document.addEventListener('focusin', handleFocusChange);
    document.addEventListener('focusout', handleFocusChange);
    window.addEventListener('blur', handleWindowBlurForPermissions, true); // Use capture
    window.addEventListener('focus', handleWindowFocusForPermissions, true); // Use capture

    // Add special handling for getUserMedia calls that trigger permission dialogs
    const originalGetUserMedia = navigator.mediaDevices?.getUserMedia;
    if (originalGetUserMedia) {
      navigator.mediaDevices.getUserMedia = function(...args) {
        // Set permission dialog state when getUserMedia is called
        setPermissionDialogOpen(true);
        
        return originalGetUserMedia.apply(this, args).then(
          (stream) => {
            // Permission granted - dialog closed
            setTimeout(() => setPermissionDialogOpen(false), 1000);
            return stream;
          },
          (error) => {
            // Permission denied or error - dialog closed
            setTimeout(() => setPermissionDialogOpen(false), 1000);
            throw error;
          }
        );
      };
    }

    // Prevent text selection and copying (only when no permission dialogs)
    const preventCopy = (e: Event) => {
      if (permissionDialogOpen) {
        
        return;
      }
      
      // Only prevent copy on assessment content, not browser UI
      const target = e.target as Element;
      if (target?.closest('[role="dialog"]') || target?.closest('.permission-prompt')) {
        return;
      }
      
      e.preventDefault();
      setShowCopyWarning(true);
      setTimeout(() => setShowCopyWarning(false), 3000);
      
    };

    const preventKeyboardShortcuts = (e: KeyboardEvent) => {
      if (permissionDialogOpen) {
        
        return;
      }

      // Prevent common copy shortcuts
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'a' || e.key === 'x' || e.key === 'v')) {
        e.preventDefault();
        setShowCopyWarning(true);
        setTimeout(() => setShowCopyWarning(false), 3000);
        
      }

      // Prevent F12, Ctrl+Shift+I (Dev Tools)
      if (e.key === 'F12' || 
          (e.ctrlKey && e.shiftKey && e.key === 'I') ||
          (e.ctrlKey && e.shiftKey && e.key === 'J') ||
          (e.ctrlKey && e.key === 'U')) {
        e.preventDefault();
        
      }

      // Prevent Alt+Tab (Windows) and Cmd+Tab (Mac)
      if ((e.altKey && e.key === 'Tab') || (e.metaKey && e.key === 'Tab')) {
        e.preventDefault();
        
      }
    };

    // Prevent right-click context menu (only on assessment content)
    const preventContextMenu = (e: MouseEvent) => {
      if (permissionDialogOpen) {
        return;
      }
      
      const target = e.target as Element;
      if (target?.closest('[role="dialog"]') || target?.closest('.permission-prompt')) {
        return;
      }
      
      e.preventDefault();
      
    };

    // Detect when user leaves the tab/window (only after security is fully initialized)
    const handleVisibilityChange = () => {
      if (!securityInitialized || isFullscreenTransition || permissionDialogOpen) {
        
        return;
      }

      if (document.hidden) {
        setShowTabWarning(true);
        
        
        // Auto-hide warning after 3 seconds and try to regain focus
        setTimeout(() => {
          setShowTabWarning(false);
          window.focus();
          if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(console.warn);
          }
        }, 3000);
      } else {
        setShowTabWarning(false);
        
      }
    };

    // Prevent window blur (losing focus) - only after initialization and when no permission dialog
    const handleWindowBlur = () => {
      if (!securityInitialized || isFullscreenTransition || permissionDialogOpen) {
        
        return;
      }

      // Only show warning if blur is not due to permission dialog
      setTimeout(() => {
        if (!permissionDialogOpen) {
          setShowTabWarning(true);
          
          
          // Auto-hide warning after 3 seconds
          setTimeout(() => {
            setShowTabWarning(false);
            window.focus();
          }, 3000);
        }
      }, 100); // Small delay to check if permission dialog opened
    };

    const handleWindowFocus = () => {
      if (securityInitialized && !isFullscreenTransition) {
        setShowTabWarning(false);
        
      }
    };

    // Fullscreen change handler
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && securityInitialized && !isFullscreenTransition) {
        
        // Only try to re-enter fullscreen if we're still in secure mode and haven't attempted recently
        setTimeout(() => {
          if (isInSecureMode && !fullscreenAttemptedRef.current) {
            fullscreenAttemptedRef.current = false; // Reset to allow re-attempt
            if (!fullscreenAttemptedRef.current) {
              enterFullscreen();
            }
          }
        }, 500);
      }
    };

    // Add event listeners (without capture for most to allow browser UI interactions)
    document.addEventListener('copy', preventCopy);
    document.addEventListener('cut', preventCopy);
    document.addEventListener('selectstart', preventCopy);
    document.addEventListener('dragstart', preventCopy);
    document.addEventListener('keydown', preventKeyboardShortcuts); // Removed capture: true
    document.addEventListener('contextmenu', preventContextMenu);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    // Disable text selection via CSS (but allow browser dialogs to function)
    const applySelectRestrictions = () => {
      const bodyStyle = document.body.style as any;
      if (!permissionDialogOpen) {
        bodyStyle.userSelect = 'none';
        bodyStyle.webkitUserSelect = 'none';
        bodyStyle.mozUserSelect = 'none';
        bodyStyle.msUserSelect = 'none';
      } else {
        // Temporarily allow selection when permission dialog is open
        bodyStyle.userSelect = '';
        bodyStyle.webkitUserSelect = '';
        bodyStyle.mozUserSelect = '';
        bodyStyle.msUserSelect = '';
      }
    };

    // Apply initial restrictions
    applySelectRestrictions();

    // Update restrictions when permission dialog state changes
    const updateSelectRestrictions = () => {
      applySelectRestrictions();
    };

    // Monitor permission dialog state changes
    const permissionStateInterval = setInterval(updateSelectRestrictions, 500);

    // Cleanup function
    return () => {
      
      
      // Clear intervals
      clearInterval(permissionStateInterval);
      
      // Disconnect permission observer
      permissionObserver.disconnect();
      
      // Remove new permission-related listeners
      document.removeEventListener('focusin', handleFocusChange);
      document.removeEventListener('focusout', handleFocusChange);
      window.removeEventListener('blur', handleWindowBlurForPermissions, true);
      window.removeEventListener('focus', handleWindowFocusForPermissions, true);
      
      // Restore original getUserMedia
      if (originalGetUserMedia && navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = originalGetUserMedia;
      }
      
      document.removeEventListener('copy', preventCopy);
      document.removeEventListener('cut', preventCopy);
      document.removeEventListener('selectstart', preventCopy);
      document.removeEventListener('dragstart', preventCopy);
      document.removeEventListener('keydown', preventKeyboardShortcuts);
      document.removeEventListener('contextmenu', preventContextMenu);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);

      // Restore text selection
      const bodyStyle = document.body.style as any;
      bodyStyle.userSelect = '';
      bodyStyle.webkitUserSelect = '';
      bodyStyle.mozUserSelect = '';
      bodyStyle.msUserSelect = '';

      // Exit fullscreen
      if (document.exitFullscreen && document.fullscreenElement) {
        document.exitFullscreen().catch(console.warn);
      }
    };
  }, [isInSecureMode, permissionDialogOpen]); // Depend on route and permission dialog state

  // Don't render anything if not in secure mode
  if (!isInSecureMode) return null;

  return (
    <>
      {/* Copy Warning */}
      {showCopyWarning && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[9999]">
          <Alert className="bg-red-100 border-red-500 text-red-800 shadow-lg">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Copying content is not allowed during the assessment!
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Tab Switch Warning - Small corner notification */}
      {showTabWarning && (
        <div className="fixed top-4 right-4 z-[9999] animate-in slide-in-from-right duration-300">
          <Alert className="bg-orange-100 border-orange-500 text-orange-800 shadow-lg max-w-sm">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="font-medium">
              <div className="text-sm">
                <div className="font-semibold">Security Alert</div>
                <div className="text-xs mt-1">Please stay focused on the assessment</div>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}
    </>
  );
} 