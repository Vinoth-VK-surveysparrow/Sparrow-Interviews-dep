import { useRef, useCallback } from 'react';

interface UseAutoResizeTextareaOptions {
  minHeight?: number;
  maxHeight?: number;
}

export function useAutoResizeTextarea({
  minHeight = 56,
  maxHeight = 200,
}: UseAutoResizeTextareaOptions = {}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback((reset = false) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (reset) {
      textarea.style.height = `${minHeight}px`;
      return;
    }

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    
    // Calculate the new height
    const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
    
    // Set the new height
    textarea.style.height = `${newHeight}px`;
  }, [minHeight, maxHeight]);

  return {
    textareaRef,
    adjustHeight,
  };
}
