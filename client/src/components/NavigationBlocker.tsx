import { useEffect } from 'react';

export const NavigationBlocker = () => {
  useEffect(() => {
    // Disable right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // Disable specific keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent refresh shortcuts
      if (
        (e.ctrlKey && e.key === 'r') ||
        (e.metaKey && e.key === 'r') ||
        e.key === 'F5' ||
        (e.ctrlKey && e.shiftKey && e.key === 'R') ||
        (e.metaKey && e.shiftKey && e.key === 'R')
      ) {
        e.preventDefault();
        e.stopPropagation();
        console.log('🚫 Refresh attempt blocked');
        return false;
      }

      // Prevent developer tools
      if (
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        (e.metaKey && e.altKey && e.key === 'I') ||
        e.key === 'F12'
      ) {
        e.preventDefault();
        e.stopPropagation();
        console.log('🚫 Developer tools blocked');
        return false;
      }

      // Prevent back/forward shortcuts
      if (
        (e.altKey && e.key === 'ArrowLeft') ||
        (e.altKey && e.key === 'ArrowRight') ||
        (e.metaKey && e.key === 'ArrowLeft') ||
        (e.metaKey && e.key === 'ArrowRight')
      ) {
        e.preventDefault();
        e.stopPropagation();
        console.log('🚫 Navigation shortcut blocked');
        return false;
      }
    };

    // Aggressive history management
    const manageHistory = () => {
      // Clear existing history and add multiple dummy entries
      const currentUrl = window.location.href;
      
      // Replace current state multiple times to create a buffer
      for (let i = 0; i < 5; i++) {
        window.history.pushState(
          { preventBack: true, index: i }, 
          `State ${i}`, 
          currentUrl
        );
      }
    };

    // Handle any popstate events (back/forward)
    const handlePopState = (e: PopStateEvent) => {
      // Stop all propagation immediately
      e.preventDefault();
      e.stopImmediatePropagation();
      
      // Force user to stay on current page
      const currentUrl = window.location.href;
      
      // Immediately push multiple states to create a stronger barrier
      for (let i = 0; i < 3; i++) {
        window.history.pushState(
          { preventBack: true, forced: true, index: i }, 
          'Blocked Navigation', 
          currentUrl
        );
      }

      // No alert - silent blocking
      console.log('🚫 Back/Forward navigation silently blocked');
      return false;
    };

    // Handle beforeunload - prevent page unload completely
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Try to prevent unload completely
      e.preventDefault();
      e.returnValue = '';
      
      // Immediately try to restore focus and prevent leaving
      setTimeout(() => {
        window.focus();
      }, 0);
      
      console.log('🚫 Page unload attempt blocked');
      return '';
    };

    // Handle visibility change to detect tab switching attempts
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('⚠️ Tab hidden - user may be trying to navigate away');
        // Immediately try to regain focus when tab becomes visible again
        const focusInterval = setInterval(() => {
          if (!document.hidden) {
            window.focus();
            clearInterval(focusInterval);
          }
        }, 100);
      }
    };

    // Disable text selection and drag
    const handleSelectStart = (e: Event) => {
      e.preventDefault();
      return false;
    };

    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
      return false;
    };

    // Initial setup
    manageHistory();

    // Add all event listeners with capture = true for maximum control
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('selectstart', handleSelectStart, true);
    document.addEventListener('dragstart', handleDragStart, true);
    document.addEventListener('visibilitychange', handleVisibilityChange, true);
    window.addEventListener('popstate', handlePopState, true);
    window.addEventListener('beforeunload', handleBeforeUnload, true);

    // Continuously maintain history buffer
    const historyMaintainer = setInterval(() => {
      if (window.history.length < 10) {
        manageHistory();
      }
    }, 2000);

    // Override browser navigation methods
    const originalBack = window.history.back;
    const originalForward = window.history.forward;
    const originalGo = window.history.go;

    window.history.back = () => {
      console.log('🚫 history.back() silently blocked');
      // Silent block - no action taken
    };

    window.history.forward = () => {
      console.log('🚫 history.forward() silently blocked');
      // Silent block - no action taken
    };

    window.history.go = () => {
      console.log('🚫 history.go() silently blocked');
      // Silent block - no action taken
    };

    // Cleanup function
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('selectstart', handleSelectStart, true);
      document.removeEventListener('dragstart', handleDragStart, true);
      document.removeEventListener('visibilitychange', handleVisibilityChange, true);
      window.removeEventListener('popstate', handlePopState, true);
      window.removeEventListener('beforeunload', handleBeforeUnload, true);
      clearInterval(historyMaintainer);

      // Restore original methods
      window.history.back = originalBack;
      window.history.forward = originalForward;
      window.history.go = originalGo;
    };
  }, []);

  return null; // This component doesn't render anything
}; 