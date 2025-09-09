import React from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Home, ArrowLeft, AlertTriangle } from 'lucide-react';

export default function NotFoundPage() {
  const [, setLocation] = useLocation();

  const goHome = () => {
    setLocation('/test-selection');
  };

  const goBack = () => {
    window.history.back();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center space-y-6">
        {/* Error Icon */}
        <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-10 h-10 text-red-600" />
        </div>

        {/* Error Message */}
        <div className="space-y-2">
          <h1 className="text-6xl font-bold text-gray-900">404</h1>
          <h2 className="text-2xl font-semibold text-gray-800">Page Not Found</h2>
          <p className="text-gray-600 max-w-sm mx-auto">
            The page you're looking for doesn't exist or you don't have permission to access it.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Button 
            onClick={goHome}
            className="flex items-center gap-2 flex-1"
          >
            <Home className="w-4 h-4" />
            Go Home
          </Button>
          <Button 
            variant="outline" 
            onClick={goBack}
            className="flex items-center gap-2 flex-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </Button>
        </div>

        {/* Additional Help */}
        <div className="pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            If you believe this is an error, please contact support.
          </p>
        </div>
      </div>
    </div>
  );
}
