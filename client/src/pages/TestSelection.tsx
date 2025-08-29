import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useClarity } from '@/hooks/useClarity';
import CardPlaceholder from '@/components/CardPlaceholder';

// Test interface based on your API response
interface Test {
  test_name: string;
  description: string;
  test_id: string;
}

interface UserTestsResponse {
  user_email: string;
  tests: Test[];
  test_count: number;
}



// Sparrow logo component using the Symbol.svg (same as Dashboard and Assessment screens)
const SparrowLogo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0.19154398143291473 -0.0020752372220158577 92.23655700683594 101.78607177734375" className="w-16 h-16 mx-auto">
    <g id="bird" fill="#4A9CA6">
      <path d="M77.8832 26.026C78.3666 19.2146 74.3957 12.8791 68.09 10.4029C61.7842 7.91926 54.6085 9.8675 50.3848 15.1991L47.3583 14.1507L44.2724 13.184L41.1492 12.3065C45.4175 4.96715 53.1138 0.334499 61.5463 0.0147496C69.9787 -0.297564 78.0097 3.75508 82.8059 10.7598L92.4281 11.4365L77.8832 26.026Z"></path>
      <path d="M84.9772 51.9928L84.9103 54.0972L84.7616 56.2016L84.5236 58.2837L84.1964 60.3435L83.78 62.4032L83.2818 64.4407L82.6944 66.4559L82.0177 68.4487L81.2592 70.397L80.4338 72.3229L79.4969 74.1819L78.5004 76.0409L77.4371 77.8404L76.2845 79.573L75.065 81.2833L73.7637 82.9267L72.4178 84.5031L70.9826 86.035L69.4805 87.4998L67.9413 88.9053L66.3351 90.2214L64.662 91.493L62.9442 92.6753L61.1819 93.7907L59.3601 94.8169L57.5159 95.7836L55.6272 96.661L53.6938 97.4493L51.7381 98.1483L49.7602 98.7803L47.7376 99.3083L45.715 99.7693L43.6477 100.119L41.6028 100.401L39.5207 100.58L37.4387 100.691H35.3714L33.2893 100.602L31.2073 100.424L29.14 100.163L27.0951 99.8139L25.0502 99.3752L23.0499 98.8472L21.0496 98.2524L19.7929 98.9513L18.4693 99.5685L17.1457 100.141L15.7775 100.624L14.387 101.019L12.9741 101.323L11.539 101.561L10.1038 101.718L8.64633 101.784L7.18887 101.762L5.75372 101.673L4.31856 101.472L2.88341 101.212L18.0529 85.9829C33.044 94.0287 51.4779 91.2848 63.5243 79.2087C75.5632 67.1325 78.3963 48.5499 70.5067 33.3878L77.8684 26.0038L78.9169 27.8331L79.8761 29.6921L80.7684 31.5734L81.5715 33.5217L82.2854 35.4922L82.9397 37.4851L83.4826 39.5002L83.9585 41.5377L84.3303 43.6198L84.6128 45.7019L84.8285 47.784L84.94 49.8661L84.9623 51.9705L84.9772 51.9928Z"></path>
      <path fillRule="evenodd" clipRule="evenodd" d="M36.3009 82.7781C53.4038 82.7781 67.2794 68.7909 67.2794 51.5318C67.2794 50.4685 67.2274 49.4126 67.1233 48.3715C66.7887 45.003 65.9187 41.7832 64.6025 38.8162L37.7733 65.5859L21.5404 49.3531C20.0829 47.8956 20.0829 45.531 21.5404 44.0735C22.9979 42.616 25.3625 42.616 26.82 44.0735L37.7807 55.0342L60.6539 32.213C57.1293 27.6993 52.3999 24.1895 46.9568 22.1744C46.927 22.1595 46.9047 22.1521 46.875 22.1446C46.4585 21.9959 46.0347 21.8472 45.6034 21.7059C45.5737 21.6985 45.5514 21.691 45.5216 21.6836C35.3565 18.2779 24.4776 16.4337 13.1823 16.4337C9.48659 16.4337 5.84293 16.6345 2.25132 17.0212C0.912839 20.8284 0.191544 24.9183 0.191544 29.1865C0.191544 36.169 2.13235 42.683 5.50087 48.2302C5.3819 49.3159 5.32984 50.4164 5.32984 51.5318C5.32984 68.7909 19.2055 82.7781 36.3084 82.7781H36.3009Z"></path>
    </g>
  </svg>
);

export default function TestSelection() {
  const [tests, setTests] = useState<Test[]>([]);
  const [loadingTests, setLoadingTests] = useState(true);
  const [loadingTest, setLoadingTest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Microsoft Clarity tracking
  const { trackPageView, trackUserAction, setUserId, setTag } = useClarity(true, 'Test Selection');

  // Set user identification for Clarity
  useEffect(() => {
    if (user?.email) {
      setUserId(user.email, user.displayName || undefined);
      setTag('user_type', 'authenticated');
    }
  }, [user?.email, user?.displayName, setUserId, setTag]);

  // Fetch user tests on component mount
  useEffect(() => {
    const fetchUserTests = async () => {
      // Don't fetch if auth is still loading
      if (authLoading) {
        return;
      }

      // Don't fetch if no user email
      if (!user?.email) {
        setLoadingTests(false);
        return;
      }

      try {
        setError(null);
        console.log('🔍 Fetching tests for user:', user.email);
        
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
        const url = `${API_BASE_URL}/users/${user.email}/tests`;
        console.log('🔍 Full API URL:', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch user tests: ${response.status} ${response.statusText}`);
        }
        
        const data: UserTestsResponse = await response.json();
        console.log('✅ User tests fetched:', data);
        
        // Check if user has any specific tests assigned
        if (data.tests && data.tests.length > 0) {
          setTests(data.tests);
        } else {
          // User has no tests assigned - show empty state
          console.log('⚠️ No user-specific tests found');
          setTests([]);
        }
      } catch (error) {
        console.error('❌ Failed to fetch user tests:', error);
        setError('Failed to load tests. Please try again later.');
        toast({
          title: "Error",
          description: "Failed to load tests. Please refresh the page.",
          variant: "destructive",
        });
      } finally {
        setLoadingTests(false);
      }
    };

    fetchUserTests();
  }, [user?.email, authLoading, toast]);

  const handleSelectTest = async (testId: string) => {
    if (!user?.email) {
      toast({
        title: "Authentication Required", 
        description: "Please ensure you are logged in to select a test.",
        variant: "destructive",
      });
      return;
    }

    setLoadingTest(testId);
    
    // Track test selection
    const selectedTest = tests.find(test => test.test_id === testId);
    trackUserAction('test_selected', {
      test_id: testId,
      test_name: selectedTest?.test_name || 'unknown',
      user_email: user.email,
      // is_fallback_test: isShowingFallbackTests
    });
    
    try {
      console.log('🎯 Selecting test:', testId);
      
      // Store the selected test_id in localStorage or context for later use
      localStorage.setItem('selectedTestId', testId);
      
      // Navigate to dashboard with the selected test
      setLocation(`/dashboard?test_id=${testId}`);
      
    } catch (error) {
      console.error('❌ Error selecting test:', error);
      toast({
        title: "Error",
        description: "Failed to select test. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingTest(null);
    }
  };

  if (loadingTests) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Assessment Tests
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Choose from the available tests below to begin your assessment journey.
            </p>
          </div>
          <br></br>
          <br></br>

          {/* Placeholder cards while loading */}
          <div className="relative">
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-6 min-w-max px-1 justify-center">
                <CardPlaceholder count={3} />
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Alert className="border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800 max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-800 dark:text-red-200">
              {error}
            </AlertDescription>
          </Alert>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Assessment Tests
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Choose from the available tests below to begin your assessment journey.
          </p>
        </div>

        <br></br>
        <br></br>

        {/* Horizontal scrollable container with navigation - same as Dashboard */}
        <div className="relative">
          <div className="overflow-x-auto pb-4" id="tests-container">
            <div className={`flex gap-6 min-w-max px-1 ${tests.length === 1 ? 'justify-center' : ''}`}>
              {tests.map((test) => (
                <Card 
                  key={test.test_id}
                  className="flex-shrink-0 w-72 h-[480px] shadow-sm transition-all duration-200 overflow-hidden relative border-gray-200 dark:border-gray-700 hover:border-teal-300 hover:shadow-md cursor-pointer"
                  onClick={() => handleSelectTest(test.test_id)}
                >
                  <CardContent className="p-8 h-full flex flex-col justify-between relative">
                    {/* Icon Section */}
                    <div className="bg-gray-100 dark:bg-custom-dark-2 rounded-lg p-6 mb-6 flex items-center justify-center">
                      <SparrowLogo />
                    </div>
                    
                    {/* Content Section */}
                    <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                      {test.test_name}
                    </h3>
                    <p className="text-sm leading-relaxed mb-4 text-gray-600 dark:text-gray-300">
                      {test.description}
                    </p>
                    
                    {/* Button Section */}
                    <div className="mt-auto">
                      <Button
                        onClick={() => handleSelectTest(test.test_id)}
                        disabled={loadingTest === test.test_id}
                        className="group relative overflow-hidden w-full" 
                        size="lg"
                      >
                        {loadingTest === test.test_id ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Selecting...
                          </>
                        ) : (
                          <>
                            <span className="mr-8 transition-opacity duration-500 group-hover:opacity-0">
                              Select Test
                            </span>
                            <i className="absolute right-1 top-1 bottom-1 rounded-sm z-10 grid w-1/4 place-items-center transition-all duration-500 bg-primary-foreground/15 group-hover:w-[calc(100%-0.5rem)] group-active:scale-95">
                              <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
                            </i>
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
          
          {/* Right arrow indicator */}
          {tests.length > 2 && (
            <div className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10">
              <Button
                variant="outline"
                size="sm"
                className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-lg border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-white/95 dark:hover:bg-gray-700/95"
                onClick={() => {
                  const container = document.getElementById('tests-container');
                  if (container) {
                    container.scrollBy({ left: 300, behavior: 'smooth' });
                  }
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {tests.length === 0 && !loadingTests && (
          <div className="flex items-center justify-center min-h-[40vh]">
            <div className="text-center">
              <div className="bg-gray-100 dark:bg-custom-dark-2 rounded-lg p-6 mb-6 mx-auto w-24 h-24 flex items-center justify-center">
                <SparrowLogo />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">No Tests Available</h2>
              <p className="text-gray-600 dark:text-gray-300 max-w-md mx-auto">
                You don't have any tests assigned at the moment. Please contact your administrator.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
