import { useEffect } from 'react';
import { useCustomToast } from '@/hooks/useCustomToast';
import CustomToaster from '@/components/CustomToaster';

export default function SecurityRestrictions() {
  const { toasterRef, showError, showWarning } = useCustomToast();

  useEffect(() => {
    // Prevent copy, cut, paste, and select operations
    const handleCopyPrevention = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Show toast warning in top-right
      showError("Action Prohibited", "Copying content is not allowed during assessments.");
    };

    // Prevent context menu (right-click)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      showError("Action Prohibited", "Right-click menu is disabled during assessments.");
    };

    // Prevent text selection
    const handleSelectStart = (e: Event) => {
      e.preventDefault();
      showError("Action Prohibited", "Text selection is not allowed during assessments.");
    };

    // Handle tab switching and window focus changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        showWarning("Tab Switch Detected", "Switching tabs during assessment is not recommended.");
      }
    };

    // Handle window blur (when user switches to another window or app)
    const handleWindowBlur = () => {
      showWarning("Window Switch Detected", "Switching windows during assessment is not recommended.");
    };

    // Detect when window is resized (split screen attempt)
    const handleWindowResize = () => {
      // Check if window is significantly smaller than screen (possible split screen)
      const screenWidth = window.screen.width;
      const windowWidth = window.innerWidth;
      const ratio = windowWidth / screenWidth;
      
      if (ratio < 0.8) {
        showWarning("Split Screen Detected", "Using split screen during assessment is not recommended.");
      }
    };

    // Prevent keyboard shortcuts for copy/paste/cut
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent copy operations (Ctrl+C, Ctrl+X)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'x')) {
        e.preventDefault();
        showError("Action Prohibited", "Copying content is not allowed during assessments.");
        return;
      }

      // Prevent paste operations (Ctrl+V)
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        showError("Action Prohibited", "Pasting content is not allowed during assessments.");
        return;
      }

      // Prevent select all (Ctrl+A)
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        showError("Action Prohibited", "Selecting all content is not allowed during assessments.");
        return;
      }

      // Prevent other restricted shortcuts (Ctrl+S, Ctrl+P)
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'p')) {
        e.preventDefault();
        showError("Action Prohibited", "This action is not allowed during assessments.");
        return;
      }

      // Prevent F12 (Developer Tools)
      if (e.key === 'F12') {
        e.preventDefault();
        showError("Action Prohibited", "Developer tools are not allowed during assessments.");
      }

      // Prevent Ctrl+Shift+I (Developer Tools)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        showError("Action Prohibited", "Developer tools are not allowed during assessments.");
      }

      // Prevent Ctrl+U (View Source)
      if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        showError("Action Prohibited", "Viewing page source is not allowed during assessments.");
      }
    };

    // Add event listeners
    document.addEventListener('copy', handleCopyPrevention);
    document.addEventListener('cut', handleCopyPrevention);
    document.addEventListener('paste', handleCopyPrevention);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('resize', handleWindowResize);

    // Apply CSS to prevent text selection
    const style = document.createElement('style');
    style.textContent = `
      * {
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        -webkit-touch-callout: none;
        -webkit-tap-highlight-color: transparent;
      }
      
      input, textarea {
        -webkit-user-select: text;
        -moz-user-select: text;
        -ms-user-select: text;
        user-select: text;
      }
    `;
    document.head.appendChild(style);

    // Cleanup function
    return () => {
      document.removeEventListener('copy', handleCopyPrevention);
      document.removeEventListener('cut', handleCopyPrevention);
      document.removeEventListener('paste', handleCopyPrevention);
      document.removeEventListener('selectstart', handleSelectStart);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('resize', handleWindowResize);
      
      // Remove the style element
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    };
  }, [showError, showWarning]);

  return <CustomToaster ref={toasterRef} defaultPosition="top-right" />;
} 