import React, { useEffect, useState } from 'react';
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

  // Check if user is in assessment or rules (security-critical routes)
  const isInSecureMode = location.startsWith('/rules/') || 
                        location.startsWith('/assessment/') || 
                        location.startsWith('/question/');

  useEffect(() => {
    if (!isInSecureMode) return;

    console.log('🔒 Entering secure assessment mode');

    // Request fullscreen when entering assessment
    const enterFullscreen = async () => {
      try {
        setIsFullscreenTransition(true);
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if ((document.documentElement as any).webkitRequestFullscreen) {
          await (document.documentElement as any).webkitRequestFullscreen();
        } else if ((document.documentElement as any).msRequestFullscreen) {
          await (document.documentElement as any).msRequestFullscreen();
        }
        console.log('✅ Fullscreen mode activated');
        
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

    enterFullscreen();

    // Detect permission dialogs
    const checkForPermissionDialogs = () => {
      // Check if there are any active permission dialogs
      const hasActiveModals = document.querySelector('[role="dialog"]') ||
                            document.querySelector('.permission-dialog') ||
                            document.activeElement?.closest('[role="dialog"]');
      
      if (hasActiveModals !== null) {
        setPermissionDialogOpen(true);
        console.log('🔓 Permission dialog detected - security relaxed');
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

    // Prevent text selection and copying (only when no permission dialogs)
    const preventCopy = (e: Event) => {
      if (permissionDialogOpen) {
        console.log('🔓 Permission dialog open - allowing interaction');
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
      console.log('🚫 Copy attempt blocked');
    };

    const preventKeyboardShortcuts = (e: KeyboardEvent) => {
      if (permissionDialogOpen) {
        console.log('🔓 Permission dialog open - allowing keyboard interaction');
        return;
      }

      // Prevent common copy shortcuts
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'a' || e.key === 'x' || e.key === 'v')) {
        e.preventDefault();
        setShowCopyWarning(true);
        setTimeout(() => setShowCopyWarning(false), 3000);
        console.log('🚫 Keyboard shortcut blocked:', e.key);
      }

      // Prevent F12, Ctrl+Shift+I (Dev Tools)
      if (e.key === 'F12' || 
          (e.ctrlKey && e.shiftKey && e.key === 'I') ||
          (e.ctrlKey && e.shiftKey && e.key === 'J') ||
          (e.ctrlKey && e.key === 'U')) {
        e.preventDefault();
        console.log('🚫 Developer tools shortcut blocked');
      }

      // Prevent Alt+Tab (Windows) and Cmd+Tab (Mac)
      if ((e.altKey && e.key === 'Tab') || (e.metaKey && e.key === 'Tab')) {
        e.preventDefault();
        console.log('🚫 Tab switching blocked');
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
      console.log('🚫 Context menu blocked');
    };

    // Detect when user leaves the tab/window (only after security is fully initialized)
    const handleVisibilityChange = () => {
      if (!securityInitialized || isFullscreenTransition || permissionDialogOpen) {
        console.log('🔄 Security still initializing or permission dialog open, ignoring visibility change');
        return;
      }

      if (document.hidden) {
        setShowTabWarning(true);
        console.log('⚠️ User left the tab - showing warning');
        
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
        console.log('✅ User returned to tab');
      }
    };

    // Prevent window blur (losing focus) - only after initialization and when no permission dialog
    const handleWindowBlur = () => {
      if (!securityInitialized || isFullscreenTransition || permissionDialogOpen) {
        console.log('🔄 Security still initializing or permission dialog open, ignoring window blur');
        return;
      }

      // Only show warning if blur is not due to permission dialog
      setTimeout(() => {
        if (!permissionDialogOpen) {
          setShowTabWarning(true);
          console.log('⚠️ Window lost focus');
          
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
        console.log('✅ Window regained focus');
      }
    };

    // Fullscreen change handler
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && securityInitialized && !isFullscreenTransition) {
        console.log('⚠️ Exited fullscreen - attempting to re-enter');
        // Try to re-enter fullscreen after a short delay
        setTimeout(() => {
          if (isInSecureMode) {
            enterFullscreen();
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

    // Disable text selection via CSS
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    document.body.style.msUserSelect = 'none';

    // Cleanup function
    return () => {
      console.log('🔓 Exiting secure assessment mode');
      
      // Disconnect permission observer
      permissionObserver.disconnect();
      
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
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
      document.body.style.msUserSelect = '';

      // Exit fullscreen
      if (document.exitFullscreen && document.fullscreenElement) {
        document.exitFullscreen().catch(console.warn);
      }
    };
  }, [isInSecureMode]);

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
        <div className="fixed top-4 right-4 z-[9999] animate-slide-in-right">
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