import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from "@sparrowengg/twigs-react";
import { AlertCircle, Loader2, Home } from 'lucide-react';
import NotFoundPage from '@/pages/NotFoundPage';

interface AdminProtectedRouteProps {
  children: React.ReactNode;
}

interface UserRole {
  role: string;
}

// Function to fetch user role from API
const fetchUserRole = async (userEmail: string): Promise<string> => {
  try {
    console.log('🔍 AdminProtectedRoute: Checking role with Firebase auth for:', userEmail);
    
    const { AuthenticatedApiService } = await import('@/lib/authenticatedApiService');
    const data = await AuthenticatedApiService.getUserTests(userEmail);
    console.log('✅ Role check result with auth:', data);
    return data.role || 'user';
  } catch (error) {
    console.error('Error fetching user role:', error);
    return 'user'; // Default to non-admin if error
  }
};

export function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user?.email) {
        setRoleLoading(false);
        return;
      }

      try {
        setRoleLoading(true);
        setError(null);
        const role = await fetchUserRole(user.email);
        setUserRole(role);
      } catch (err) {
        console.error('Failed to check admin role:', err);
        setError('Failed to verify admin permissions');
        setUserRole('user'); // Default to non-admin on error
      } finally {
        setRoleLoading(false);
      }
    };

    if (!authLoading && user) {
      checkAdminRole();
    } else if (!authLoading && !user) {
      setRoleLoading(false);
    }
  }, [user, authLoading]);

  // Show loading while checking authentication and role
  if (authLoading || roleLoading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
            <span className="text-gray-600 dark:text-gray-300">Verifying access...</span>
          </div>
        </div>
      </main>
    );
  }

  // User not authenticated
  if (!user) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You must be logged in to access this page.
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  // Error occurred while checking role
  if (error) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
          <Button onClick={() => setLocation('/test-selection')}>
            <Home className="h-4 w-4 mr-2" />
            Return Home
          </Button>
        </div>
      </main>
    );
  }

  // User is not an admin - show 404 page
  if (userRole !== 'admin') {
    return <NotFoundPage />;
  }

  // User is admin, render the protected content
  return <>{children}</>;
}
