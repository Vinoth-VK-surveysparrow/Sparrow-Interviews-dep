import React from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Theme } from "@/components/ui/theme";
import { AssessmentProvider } from "@/contexts/AssessmentContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import Dashboard from "@/pages/Dashboard";
import Rules from "@/pages/Rules";
import Question from "@/pages/Question";
import Assessment from "@/pages/Assessment";
import Results from "@/pages/Results";
import Login from "@/pages/Login";
import NotFound from "@/pages/not-found";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { NavigationBlocker } from "@/components/NavigationBlocker";
import { AssessmentSecurity } from "@/components/AssessmentSecurity";
import { BackgroundUploadProvider } from "@/contexts/BackgroundUploadProvider";
import PermissionsTest from "@/components/PermissionsTest";
import SecurityRestrictions from "@/components/SecurityRestrictions";

function Header() {
  const { user, signOut, isAuthenticated } = useAuth();
  const [location] = useLocation();

  const handleSignOut = async () => {
    await signOut();
  };

  // Check if user is in assessment-related routes
  const isInAssessment = location.startsWith('/rules/') || 
                        location.startsWith('/assessment/') || 
                        location.startsWith('/question/') || 
                        location.startsWith('/results/');

  if (!isAuthenticated) {
    return null;
  }

  return (
    <header className="bg-background border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0.19154398143291473 -0.0020752372220158577 92.23655700683594 101.78607177734375" className="w-8 h-8">
              <g id="bird" fill="#4A9CA6">
                <path d="M77.8832 26.026C78.3666 19.2146 74.3957 12.8791 68.09 10.4029C61.7842 7.91926 54.6085 9.8675 50.3848 15.1991L47.3583 14.1507L44.2724 13.184L41.1492 12.3065C45.4175 4.96715 53.1138 0.334499 61.5463 0.0147496C69.9787 -0.297564 78.0097 3.75508 82.8059 10.7598L92.4281 11.4365L77.8832 26.026Z"></path>
                <path d="M84.9772 51.9928L84.9103 54.0972L84.7616 56.2016L84.5236 58.2837L84.1964 60.3435L83.78 62.4032L83.2818 64.4407L82.6944 66.4559L82.0177 68.4487L81.2592 70.397L80.4338 72.3229L79.4969 74.1819L78.5004 76.0409L77.4371 77.8404L76.2845 79.573L75.065 81.2833L73.7637 82.9267L72.4178 84.5031L70.9826 86.035L69.4805 87.4998L67.9413 88.9053L66.3351 90.2214L64.662 91.493L62.9442 92.6753L61.1819 93.7907L59.3601 94.8169L57.5159 95.7836L55.6272 96.661L53.6938 97.4493L51.7381 98.1483L49.7602 98.7803L47.7376 99.3083L45.715 99.7693L43.6477 100.119L41.6028 100.401L39.5207 100.58L37.4387 100.691H35.3714L33.2893 100.602L31.2073 100.424L29.14 100.163L27.0951 99.8139L25.0502 99.3752L23.0499 98.8472L21.0496 98.2524L19.7929 98.9513L18.4693 99.5685L17.1457 100.141L15.7775 100.624L14.387 101.019L12.9741 101.323L11.539 101.561L10.1038 101.718L8.64633 101.784L7.18887 101.762L5.75372 101.673L4.31856 101.472L2.88341 101.212L18.0529 85.9829C33.044 94.0287 51.4779 91.2848 63.5243 79.2087C75.5632 67.1325 78.3963 48.5499 70.5067 33.3878L77.8684 26.0038L78.9169 27.8331L79.8761 29.6921L80.7684 31.5734L81.5715 33.5217L82.2854 35.4922L82.9397 37.4851L83.4826 39.5002L83.9585 41.5377L84.3303 43.6198L84.6128 45.7019L84.8285 47.784L84.94 49.8661L84.9623 51.9705L84.9772 51.9928Z"></path>
                <path fillRule="evenodd" clipRule="evenodd" d="M36.3009 82.7781C53.4038 82.7781 67.2794 68.7909 67.2794 51.5318C67.2794 50.4685 67.2274 49.4126 67.1233 48.3715C66.7887 45.003 65.9187 41.7832 64.6025 38.8162L37.7733 65.5859L21.5404 49.3531C20.0829 47.8956 20.0829 45.531 21.5404 44.0735C22.9979 42.616 25.3625 42.616 26.82 44.0735L37.7807 55.0342L60.6539 32.213C57.1293 27.6993 52.3999 24.1895 46.9568 22.1744C46.927 22.1595 46.9047 22.1521 46.875 22.1446C46.4585 21.9959 46.0347 21.8472 45.6034 21.7059C45.5737 21.6985 45.5514 21.691 45.5216 21.6836C35.3565 18.2779 24.4776 16.4337 13.1823 16.4337C9.48659 16.4337 5.84293 16.6345 2.25132 17.0212C0.912839 20.8284 0.191544 24.9183 0.191544 29.1865C0.191544 36.169 2.13235 42.683 5.50087 48.2302C5.3819 49.3159 5.32984 50.4164 5.32984 51.5318C5.32984 68.7909 19.2055 82.7781 36.3084 82.7781H36.3009Z"></path>
              </g>
            </svg>
            <h1 className="text-xl font-semibold text-foreground">
              Sparrow Interviews
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
          <Theme
            size="sm"
            variant="dropdown"
            showLabel
            themes={["light", "dark", "system"]}
          />
            
            {/* Only show sign out button when NOT in assessment */}
            {!isInAssessment && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function SecurityWrapper() {
  const [location] = useLocation();
  
  // Check if user is in assessment-related routes where restrictions should apply
  const isInAssessment = location.startsWith('/rules/') || 
                        location.startsWith('/assessment/') || 
                        location.startsWith('/question/');

  return isInAssessment ? <SecurityRestrictions /> : null;
}

function Router() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <AssessmentSecurity />
      <SecurityWrapper />
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/">
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard">
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        </Route>
        <Route path="/rules/:assessmentId">
          <ProtectedRoute>
            <Rules />
          </ProtectedRoute>
        </Route>
        <Route path="/assessment/:assessmentId">
          <ProtectedRoute>
            <Assessment />
          </ProtectedRoute>
        </Route>
        <Route path="/question/:assessmentId/:questionNumber">
          <ProtectedRoute>
            <Question />
          </ProtectedRoute>
        </Route>
        <Route path="/results/:assessmentId">
          <ProtectedRoute>
            <Results />
          </ProtectedRoute>
        </Route>
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  // Prevent manual refresh and back button navigation
  React.useEffect(() => {
    // Prevent refresh (Ctrl+R, F5, Cmd+R)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && e.key === 'r') ||
        (e.metaKey && e.key === 'r') ||
        e.key === 'F5'
      ) {
        e.preventDefault();
        console.log('🚫 Manual refresh prevented');
        return false;
      }
    };

    // More aggressive back button prevention
    const preventBackNavigation = () => {
      // Add multiple history entries to make back button ineffective
      window.history.pushState(null, '', window.location.href);
      window.history.pushState(null, '', window.location.href);
      window.history.pushState(null, '', window.location.href);
    };

    // Handle popstate event (back/forward button)
    const handlePopState = (e: PopStateEvent) => {
      // Prevent the default back navigation
      e.preventDefault();
      e.stopImmediatePropagation();
      
      // Immediately push multiple states back aggressively
      const currentUrl = window.location.href;
      setTimeout(() => {
        for (let i = 0; i < 5; i++) {
          window.history.pushState(
            { block: true, index: i }, 
            'Navigation Blocked', 
            currentUrl
          );
        }
      }, 0);
      
      console.log('🚫 Back navigation silently blocked');
      
      // No alert - silent blocking
      return false;
    };

    // Prevent page unload (closing tab, etc.)
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const message = 'Are you sure you want to leave? Your progress might be lost.';
      e.preventDefault();
      e.returnValue = message;
      return message;
    };

    // Handle hash changes (prevents # navigation)
    const handleHashChange = (e: HashChangeEvent) => {
      e.preventDefault();
      window.location.hash = '';
      console.log('🚫 Hash navigation prevented');
    };

    // Initial setup
    preventBackNavigation();

    // Add event listeners
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('popstate', handlePopState, true); // Use capture phase
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('hashchange', handleHashChange);

    // More aggressive history buffer maintenance
    const historyInterval = setInterval(() => {
      const currentUrl = window.location.href;
      // Always maintain a buffer of history entries
      for (let i = 0; i < 3; i++) {
        window.history.pushState(
          { maintained: true, timestamp: Date.now(), index: i }, 
          'History Buffer', 
          currentUrl
        );
      }
    }, 500); // Check every 500ms instead of 1000ms

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('popstate', handlePopState, true);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('hashchange', handleHashChange);
      clearInterval(historyInterval);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BackgroundUploadProvider>
        <AssessmentProvider>
          <TooltipProvider>
              <NavigationBlocker />
            <Toaster />
            <Router />
          </TooltipProvider>
        </AssessmentProvider>
        </BackgroundUploadProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
