import { useRef, useCallback } from 'react';
import { ToasterRef } from '@/components/CustomToaster';

type Variant = 'default' | 'success' | 'error' | 'warning';

interface CustomToastOptions {
  title?: string;
  message: string;
  variant?: Variant;
  duration?: number;
}

export function useCustomToast() {
  const toasterRef = useRef<ToasterRef>(null);

  const showToast = useCallback((options: CustomToastOptions) => {
    toasterRef.current?.show({
      title: options.title,
      message: options.message,
      variant: options.variant || 'default',
      duration: options.duration || 4000,
      position: 'top-right',
    });
  }, []);

  const showError = useCallback((title: string, message: string) => {
    showToast({ title, message, variant: 'error', duration: 3000 });
  }, [showToast]);

  const showWarning = useCallback((title: string, message: string) => {
    showToast({ title, message, variant: 'warning', duration: 5000 });
  }, [showToast]);

  const showSuccess = useCallback((title: string, message: string) => {
    showToast({ title, message, variant: 'success', duration: 3000 });
  }, [showToast]);

  return {
    toasterRef,
    showToast,
    showError,
    showWarning,
    showSuccess,
  };
} 