import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WarningBadgeProps {
  isVisible: boolean;
  message: string;
  duration?: number;
  onHide?: () => void;
  className?: string;
}

export function WarningBadge({ 
  isVisible, 
  message, 
  duration = 5000, 
  onHide,
  className 
}: WarningBadgeProps) {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShouldShow(true);
      
      // Auto-hide after duration
      const timer = setTimeout(() => {
        setShouldShow(false);
        onHide?.();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      setShouldShow(false);
    }
  }, [isVisible, duration, onHide]);

  if (!shouldShow) return null;

  return (
    <div
      className={cn(
        "flex justify-center w-full",
        className
      )}
    >
      <Badge
        className={cn(
          // Base styling with red outline
          "border-2 border-red-500 shadow-lg",
          "px-4 py-2 text-sm font-medium",
          "flex items-center gap-2",
          // Theme-aware background and text
          "bg-red-50 text-red-800",
          "dark:bg-red-950/30 dark:text-red-200",
          // Glow effect
          "shadow-red-500/20 dark:shadow-red-500/30"
        )}
        variant="outline"
      >
        <AlertTriangle className="h-4 w-4 text-red-500" />
        <span className="whitespace-nowrap">{message}</span>
      </Badge>
    </div>
  );
}
