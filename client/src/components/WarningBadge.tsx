import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WarningBadgeProps {
  show: boolean;
  message: string;
  className?: string;
}

export function WarningBadge({ show, message, className }: WarningBadgeProps) {
  if (!show) return null;

  return (
    <div 
      className={cn(
        "flex items-center justify-center animate-in slide-in-from-top-2 duration-300",
        className
      )}
    >
      <Badge 
        className={cn(
          // Base styling matching theme
          "px-4 py-2 text-sm font-medium",
          "flex items-center gap-2",
          // Red outline with theme-aware background
          "border-2 border-red-500",
          "bg-red-50 text-red-900", // Light mode colors
          "dark:bg-red-950/20 dark:text-red-400", // Dark mode colors
          // Hover and focus states
          "hover:bg-red-100 dark:hover:bg-red-950/30",
          // Animation for visibility
          "transition-all duration-300 ease-in-out",
          // Shadow for depth
          "shadow-md dark:shadow-red-900/20"
        )}
        variant="outline"
      >
        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
        <span className="font-semibold">{message}</span>
      </Badge>
    </div>
  );
}

export default WarningBadge;
