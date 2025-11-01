import { useLocation } from "wouter";
import { HomeIcon, PlusIcon, PageIcon, UsersIcon, UserCirclePlusIcon } from "@sparrowengg/twigs-react-icons";
import { Settings, LogOut } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import SettingsModal from "./SettingsModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function AppSidebar() {
  const { theme } = useTheme();
  const [location] = useLocation();
  const { user, signOut } = useAuth();
  const [userRole, setUserRole] = useState<string>('');
  const [loadingRole, setLoadingRole] = useState<boolean>(true);
  const [roleCheckCompleted, setRoleCheckCompleted] = useState<boolean>(false);
  const [signOutDialogOpen, setSignOutDialogOpen] = useState<boolean>(false);

  // Check if user is admin
  const isAdmin = userRole === 'admin';

  // Check if user is in active assessment or login page (hide sidebar during assessments and login)
  const isInActiveAssessment = location.startsWith('/assessment/') || 
                              location.startsWith('/question/') ||
                              location.startsWith('/conductor/') ||
                              location.startsWith('/triple-step/') ||
                              location.startsWith('/sales-ai/') ||
                              location.startsWith('/rapid-fire/');
  
  const shouldHideSidebar = isInActiveAssessment || location === '/login';

  // Fetch user role
  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user?.email) {
        setUserRole('');
        setLoadingRole(false);
        return;
      }

      try {
        setLoadingRole(true);
        const { AuthenticatedApiService } = await import('@/lib/authenticatedApiService');
        const data = await AuthenticatedApiService.getUserTests(user.email);
        setUserRole(data.role || '');
      } catch (error) {
        console.error('Failed to fetch user role:', error);
        setUserRole('');
      } finally {
        setLoadingRole(false);
        setRoleCheckCompleted(true);
      }
    };

    fetchUserRole();
  }, [user?.email]);

  // Don't render sidebar during active assessments or login page
  if (shouldHideSidebar) {
    return null;
  }

  // Determine effective theme for styling
  const effectiveTheme = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;

  const isActive = (path: string) => {
    if (path === "/") {
      return location === "/" || location === "/test-selection";
    }
    return location.startsWith(path);
  };

  return (
    <TooltipProvider>
      <div
        className="w-12 border-r fixed left-0 top-0 flex flex-col"
        style={{
          height: '100vh',
          backgroundColor: effectiveTheme === 'light' ? '#f6f6f6' : undefined
        }}
      >
        {/* Content area below header */}
        <div 
          className="flex flex-col justify-between flex-1"
          style={{ 
            marginTop: '64px', 
            height: 'calc(100vh - 64px)',
            padding: '16px 0'
          }}
        >
          {/* Top Icons */}
          <div className="flex flex-col items-center space-y-2">
            {/* Show icons only after user authentication and role check is complete */}
            {user && roleCheckCompleted && (
              <>
                {/* Home Icon */}
                <div className="flex justify-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => window.location.href = '/'}
                        className="w-8 h-8 rounded flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        style={{
                          backgroundColor: isActive("/") ? (effectiveTheme === 'dark' ? '#374151' : '#e5e7eb') : 'transparent'
                        }}
                      >
                        <HomeIcon className="w-5 h-5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>Home</p>
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* Admin-only icons */}
                {isAdmin && (
              <>
                {/* Create Assessment Icon */}
                <div className="flex justify-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => window.location.href = '/admin/create-assessment'}
                        className="w-8 h-8 rounded flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        style={{
                          backgroundColor: isActive("/admin/create-assessment") ? (effectiveTheme === 'dark' ? '#374151' : '#e5e7eb') : 'transparent'
                        }}
                      >
                        <PlusIcon className="w-5 h-5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>Create Assessment</p>
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* Tests Icon */}
                <div className="flex justify-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => window.location.href = '/admin/tests'}
                        className="w-8 h-8 rounded flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        style={{
                          backgroundColor: isActive("/admin/tests") ? (effectiveTheme === 'dark' ? '#374151' : '#e5e7eb') : 'transparent'
                        }}
                      >
                        <PageIcon className="w-5 h-5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>Tests</p>
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* Users Icon */}
                <div className="flex justify-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => window.location.href = '/admin/users'}
                        className="w-8 h-8 rounded flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        style={{
                          backgroundColor: isActive("/admin/users") ? (effectiveTheme === 'dark' ? '#374151' : '#e5e7eb') : 'transparent'
                        }}
                      >
                        <UsersIcon className="w-5 h-5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>Users</p>
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* User Access Icon */}
                <div className="flex justify-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => window.location.href = '/admin/user-access'}
                        className="w-8 h-8 rounded flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        style={{
                          backgroundColor: isActive("/admin/user-access") ? (effectiveTheme === 'dark' ? '#374151' : '#e5e7eb') : 'transparent'
                        }}
                      >
                        <UserCirclePlusIcon className="w-5 h-5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>User Access</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </>
            )}
              </>
            )}
          </div>

          {/* Bottom Icons */}
          <div className="flex flex-col items-center space-y-2">
            {/* Settings Icon */}
            <div className="flex justify-center">
              <SettingsModal>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="w-8 h-8 rounded flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Settings className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>Settings</p>
                  </TooltipContent>
                </Tooltip>
              </SettingsModal>
            </div>

            {/* Sign Out Button */}
            <div className="flex justify-center">
              <AlertDialog open={signOutDialogOpen} onOpenChange={setSignOutDialogOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <button
                        className="w-8 h-8 rounded flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                      >
                        <LogOut className="w-5 h-5" />
                      </button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>Sign Out</p>
                  </TooltipContent>
                </Tooltip>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Sign Out</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to sign out? You will need to sign in again to access your account.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={signOut}>Sign Out</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
