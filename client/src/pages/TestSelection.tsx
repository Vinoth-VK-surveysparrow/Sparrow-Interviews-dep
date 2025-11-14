import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button, CircleLoader } from "@sparrowengg/twigs-react";
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, Loader2, AlertCircle, ChevronDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useClarity } from '@/hooks/useClarity';
import CardPlaceholder from '@/components/CardPlaceholder';
import { AcknowledgmentModal } from '@/components/AcknowledgmentModal';

// Test interface based on your API response
interface Test {
  test_name: string;
  description: string;
  test_id: string;
  time_status: "allowed" | "not_started_yet" | "expired";
  time_slot?: string[];
}

interface AcknowledgmentPDF {
  data: string; // base64 encoded PDF data
  filename: string;
  content_type: string;
}

interface TestDetails {
  test_id: string;
  test_name: string;
  description: string;
  created_at: string;
  created_by: string;
}

interface UserTestsResponse {
  user_email: string;
  role: string;
  tests: Test[];
  test_count: number;
}

interface TestAvailabilityResponse {
  test_id: string;
  user_email: string;
  assessments: any[];
  assessment_count: number;
  test_details?: TestDetails;
  acknowledgement_pdf?: AcknowledgmentPDF;
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
  const [userRole, setUserRole] = useState<string>('');
  const [loadingTests, setLoadingTests] = useState(true);
  const [loadingTest, setLoadingTest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  
  // Ref for scrollable container
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Function to scroll down in the container
  const handleScrollDown = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({
        top: 120, // Scroll down by approximately 2 test items
        behavior: 'smooth'
      });
    }
  };
  
  // Acknowledgment modal state
  const [showAcknowledgmentModal, setShowAcknowledgmentModal] = useState(false);
  const [acknowledgmentPdf, setAcknowledgmentPdf] = useState<AcknowledgmentPDF | null>(null);
  const [pendingTestId, setPendingTestId] = useState<string | null>(null);

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
        
        console.log('🔍 TestSelection: Fetching user tests with Firebase auth for:', user.email);
        
        // Import authenticated API service
        const { AuthenticatedApiService } = await import('@/lib/authenticatedApiService');
        const data: UserTestsResponse = await AuthenticatedApiService.getUserTests(user.email);
        console.log('✅ User tests fetched with auth:', data);
        
        // Set user role
        setUserRole(data.role || '');
        
        // Check if user has any specific tests assigned
        if (data.tests && data.tests.length > 0) {
          setTests(data.tests);
          // Set first test as selected by default
          setSelectedTest(data.tests[0]);
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

    // Check if test is locked
    const selectedTest = tests.find(test => test.test_id === testId);
    if (selectedTest?.time_status !== "allowed") {
      // Format time slot for display
      const formatTimeSlot = (timeSlot: string[]) => {
        if (!timeSlot || timeSlot.length === 0) return "";
        
        const formatDateTime = (dateTimeStr: string) => {
          try {
            // Parse the date string (e.g., "2025-09-23 03:00 PM")
            const parts = dateTimeStr.split(' ');
            if (parts.length !== 3) {
              return dateTimeStr; // Fallback if format is unexpected
            }
            
            const [datePart, timePart, period] = parts;
            const [year, month, day] = datePart.split('-');
            const [hours, minutes] = timePart.split(':');
            
            // Convert to 24-hour format for Date object
            let hour24 = parseInt(hours);
            if (period === 'PM' && hour24 !== 12) {
              hour24 += 12;
            } else if (period === 'AM' && hour24 === 12) {
              hour24 = 0;
            }
            
            // Create Date object
            const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hour24, parseInt(minutes));
            
            // Format date as "Sep 23" and time as "3:00 PM"
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const formattedDate = `${monthNames[date.getMonth()]} ${date.getDate()}`;
            const formattedTime = date.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            });
            
            return `${formattedDate} ${formattedTime}`;
          } catch (error) {
            console.error('Error parsing date:', dateTimeStr, error);
            // Fallback to original string if parsing fails
            return dateTimeStr;
          }
        };
        
        if (timeSlot.length === 1) {
          return formatDateTime(timeSlot[0]);
        } else if (timeSlot.length === 2) {
          const start = formatDateTime(timeSlot[0]);
          const end = formatDateTime(timeSlot[1]);
          // Extract just the time from end time if same date
          const startDate = timeSlot[0].split(' ')[0];
          const endDate = timeSlot[1].split(' ')[0];
          if (startDate === endDate) {
            const endTime = timeSlot[1].split(' ')[1] + ' ' + timeSlot[1].split(' ')[2];
            return `${start} - ${endTime}`;
          } else {
            return `${start} - ${end}`;
          }
        } else {
          return timeSlot.map(formatDateTime).join(", ");
        }
      };
      
      const timeSlotDisplay = selectedTest?.time_slot ? formatTimeSlot(selectedTest.time_slot) : "";
      
      if (selectedTest?.time_status === "expired") {
        toast({
          title: "Time slot ended",
          description: timeSlotDisplay ? `Was scheduled: ${timeSlotDisplay}` : "This test's time slot has ended.",
        });
      } else if (selectedTest?.time_status === "not_started_yet") {
        toast({
          title: "Test not started",
          description: timeSlotDisplay ? `Test starts only between: ${timeSlotDisplay}` : "This test has not started yet.",
        });
      }
      return;
    }

    setLoadingTest(testId);
    
    // Track test selection
    trackUserAction('test_selected', {
      test_id: testId,
      test_name: selectedTest?.test_name || 'unknown',
      user_email: user.email,
    });
    
    try {
      console.log('🎯 Selecting test:', testId);
      
      // Check if test has acknowledgment PDF by calling test availability API
      console.log('🔍 TestSelection: Checking test availability with Firebase auth');
      
      const { AuthenticatedApiService } = await import('@/lib/authenticatedApiService');
      const testData: TestAvailabilityResponse = await AuthenticatedApiService.checkTestAvailability(testId, {
        user_email: user.email
      });
      
      console.log('✅ Test availability checked:', testData);
      
      // Check if acknowledgment_pdf exists
      if (testData.acknowledgement_pdf) {
        console.log('📄 Acknowledgment PDF found, showing modal');
        setAcknowledgmentPdf(testData.acknowledgement_pdf);
        setPendingTestId(testId);
        setShowAcknowledgmentModal(true);
      } else {
        console.log('✅ No acknowledgment required, proceeding to dashboard');
        // Store the selected test_id and navigate directly
        localStorage.setItem('selectedTestId', testId);
        setLocation(`/dashboard?test_id=${testId}`);
      }
      
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

  // Handle acknowledgment modal proceed
  const handleAcknowledgmentProceed = () => {
    if (pendingTestId) {
      console.log('✅ Acknowledgment completed, proceeding to dashboard');
      localStorage.setItem('selectedTestId', pendingTestId);
      setLocation(`/dashboard?test_id=${pendingTestId}`);
    }
    setShowAcknowledgmentModal(false);
    setAcknowledgmentPdf(null);
    setPendingTestId(null);
  };

  if (loadingTests) {
    return (
      <div className="relative overflow-hidden" style={{ height: 'calc(100vh - 65px)' }}>
        {/* Background logo on the right */}
        <div className="absolute right-0 top-0 bottom-0 w-1/2 pointer-events-none overflow-hidden flex items-center justify-center">
          {/* Large Sparrow Logo - darker to blend with background */}
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0.19154398143291473 -0.0020752372220158577 92.23655700683594 101.78607177734375" 
            className="w-full h-auto opacity-[0.03] dark:opacity-[0.08]"
            style={{ maxWidth: '800px' }}
          >
            <g id="bird" fill="#4A9CA6">
              <path d="M77.8832 26.026C78.3666 19.2146 74.3957 12.8791 68.09 10.4029C61.7842 7.91926 54.6085 9.8675 50.3848 15.1991L47.3583 14.1507L44.2724 13.184L41.1492 12.3065C45.4175 4.96715 53.1138 0.334499 61.5463 0.0147496C69.9787 -0.297564 78.0097 3.75508 82.8059 10.7598L92.4281 11.4365L77.8832 26.026Z"></path>
              <path d="M84.9772 51.9928L84.9103 54.0972L84.7616 56.2016L84.5236 58.2837L84.1964 60.3435L83.78 62.4032L83.2818 64.4407L82.6944 66.4559L82.0177 68.4487L81.2592 70.397L80.4338 72.3229L79.4969 74.1819L78.5004 76.0409L77.4371 77.8404L76.2845 79.573L75.065 81.2833L73.7637 82.9267L72.4178 84.5031L70.9826 86.035L69.4805 87.4998L67.9413 88.9053L66.3351 90.2214L64.662 91.493L62.9442 92.6753L61.1819 93.7907L59.3601 94.8169L57.5159 95.7836L55.6272 96.661L53.6938 97.4493L51.7381 98.1483L49.7602 98.7803L47.7376 99.3083L45.715 99.7693L43.6477 100.119L41.6028 100.401L39.5207 100.58L37.4387 100.691H35.3714L33.2893 100.602L31.2073 100.424L29.14 100.163L27.0951 99.8139L25.0502 99.3752L23.0499 98.8472L21.0496 98.2524L19.7929 98.9513L18.4693 99.5685L17.1457 100.141L15.7775 100.624L14.387 101.019L12.9741 101.323L11.539 101.561L10.1038 101.718L8.64633 101.784L7.18887 101.762L5.75372 101.673L4.31856 101.472L2.88341 101.212L18.0529 85.9829C33.044 94.0287 51.4779 91.2848 63.5243 79.2087C75.5632 67.1325 78.3963 48.5499 70.5067 33.3878L77.8684 26.0038L78.9169 27.8331L79.8761 29.6921L80.7684 31.5734L81.5715 33.5217L82.2854 35.4922L82.9397 37.4851L83.4826 39.5002L83.9585 41.5377L84.3303 43.6198L84.6128 45.7019L84.8285 47.784L84.94 49.8661L84.9623 51.9705L84.9772 51.9928Z"></path>
              <path fillRule="evenodd" clipRule="evenodd" d="M36.3009 82.7781C53.4038 82.7781 67.2794 68.7909 67.2794 51.5318C67.2794 50.4685 67.2274 49.4126 67.1233 48.3715C66.7887 45.003 65.9187 41.7832 64.6025 38.8162L37.7733 65.5859L21.5404 49.3531C20.0829 47.8956 20.0829 45.531 21.5404 44.0735C22.9979 42.616 25.3625 42.616 26.82 44.0735L37.7807 55.0342L60.6539 32.213C57.1293 27.6993 52.3999 24.1895 46.9568 22.1744C46.927 22.1595 46.9047 22.1521 46.875 22.1446C46.4585 21.9959 46.0347 21.8472 45.6034 21.7059C45.5737 21.6985 45.5514 21.691 45.5216 21.6836C35.3565 18.2779 24.4776 16.4337 13.1823 16.4337C9.48659 16.4337 5.84293 16.6345 2.25132 17.0212C0.912839 20.8284 0.191544 24.9183 0.191544 29.1865C0.191544 36.169 2.13235 42.683 5.50087 48.2302C5.3819 49.3159 5.32984 50.4164 5.32984 51.5318C5.32984 68.7909 19.2055 82.7781 36.3084 82.7781H36.3009Z"></path>
            </g>
          </svg>
        </div>

        {/* Main content */}
        <div className="relative z-10">
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="max-w-7xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Left side placeholder - Test list */}
                <Card className="lg:col-span-2 shadow-sm border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
                  <CardContent className="p-0">
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                      {/* Placeholder test items */}
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="px-6 py-5">
                          <div className="animate-pulse">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Right side placeholder - Test details */}
                <div className="lg:col-span-3">
                  <div className="flex items-center min-h-[400px]">
                    <div className="w-full text-center">
                      <div className="animate-pulse space-y-6">
                        {/* Title placeholder */}
                        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mx-auto"></div>
                        {/* Description placeholder */}
                        <div className="space-y-2">
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto"></div>
                        </div>
                        {/* Guidelines placeholder */}
                        <div className="space-y-4 mt-8">
                          {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="flex items-center gap-2">
                              <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                            </div>
                          ))}
                        </div>
                        {/* Button placeholder */}
                        <div className="flex justify-end mt-8">
                          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
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
    <div className="relative overflow-hidden" style={{ height: 'calc(100vh - 65px)' }}>
      {/* Background logo on the right */}
      <div className="absolute right-0 top-0 bottom-0 w-1/2 pointer-events-none overflow-hidden flex items-center justify-center">
        {/* Large Sparrow Logo - darker to blend with background */}
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0.19154398143291473 -0.0020752372220158577 92.23655700683594 101.78607177734375" 
          className="w-full h-auto opacity-[0.03] dark:opacity-[0.08]"
          style={{ maxWidth: '800px' }}
        >
          <g id="bird" fill="#4A9CA6">
            <path d="M77.8832 26.026C78.3666 19.2146 74.3957 12.8791 68.09 10.4029C61.7842 7.91926 54.6085 9.8675 50.3848 15.1991L47.3583 14.1507L44.2724 13.184L41.1492 12.3065C45.4175 4.96715 53.1138 0.334499 61.5463 0.0147496C69.9787 -0.297564 78.0097 3.75508 82.8059 10.7598L92.4281 11.4365L77.8832 26.026Z"></path>
            <path d="M84.9772 51.9928L84.9103 54.0972L84.7616 56.2016L84.5236 58.2837L84.1964 60.3435L83.78 62.4032L83.2818 64.4407L82.6944 66.4559L82.0177 68.4487L81.2592 70.397L80.4338 72.3229L79.4969 74.1819L78.5004 76.0409L77.4371 77.8404L76.2845 79.573L75.065 81.2833L73.7637 82.9267L72.4178 84.5031L70.9826 86.035L69.4805 87.4998L67.9413 88.9053L66.3351 90.2214L64.662 91.493L62.9442 92.6753L61.1819 93.7907L59.3601 94.8169L57.5159 95.7836L55.6272 96.661L53.6938 97.4493L51.7381 98.1483L49.7602 98.7803L47.7376 99.3083L45.715 99.7693L43.6477 100.119L41.6028 100.401L39.5207 100.58L37.4387 100.691H35.3714L33.2893 100.602L31.2073 100.424L29.14 100.163L27.0951 99.8139L25.0502 99.3752L23.0499 98.8472L21.0496 98.2524L19.7929 98.9513L18.4693 99.5685L17.1457 100.141L15.7775 100.624L14.387 101.019L12.9741 101.323L11.539 101.561L10.1038 101.718L8.64633 101.784L7.18887 101.762L5.75372 101.673L4.31856 101.472L2.88341 101.212L18.0529 85.9829C33.044 94.0287 51.4779 91.2848 63.5243 79.2087C75.5632 67.1325 78.3963 48.5499 70.5067 33.3878L77.8684 26.0038L78.9169 27.8331L79.8761 29.6921L80.7684 31.5734L81.5715 33.5217L82.2854 35.4922L82.9397 37.4851L83.4826 39.5002L83.9585 41.5377L84.3303 43.6198L84.6128 45.7019L84.8285 47.784L84.94 49.8661L84.9623 51.9705L84.9772 51.9928Z"></path>
            <path fillRule="evenodd" clipRule="evenodd" d="M36.3009 82.7781C53.4038 82.7781 67.2794 68.7909 67.2794 51.5318C67.2794 50.4685 67.2274 49.4126 67.1233 48.3715C66.7887 45.003 65.9187 41.7832 64.6025 38.8162L37.7733 65.5859L21.5404 49.3531C20.0829 47.8956 20.0829 45.531 21.5404 44.0735C22.9979 42.616 25.3625 42.616 26.82 44.0735L37.7807 55.0342L60.6539 32.213C57.1293 27.6993 52.3999 24.1895 46.9568 22.1744C46.927 22.1595 46.9047 22.1521 46.875 22.1446C46.4585 21.9959 46.0347 21.8472 45.6034 21.7059C45.5737 21.6985 45.5514 21.691 45.5216 21.6836C35.3565 18.2779 24.4776 16.4337 13.1823 16.4337C9.48659 16.4337 5.84293 16.6345 2.25132 17.0212C0.912839 20.8284 0.191544 24.9183 0.191544 29.1865C0.191544 36.169 2.13235 42.683 5.50087 48.2302C5.3819 49.3159 5.32984 50.4164 5.32984 51.5318C5.32984 68.7909 19.2055 82.7781 36.3084 82.7781H36.3009Z"></path>
          </g>
        </svg>
      </div>

      {/* Main content */}
      <div className="relative z-10">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-8">
            {/* Admin Access - Top Left for Admin Users Only */}
            {userRole === 'admin' && (
              <div className="flex justify-start">
                {/* Admin panel removed - functionality moved to app sidebar */}
              </div>
            )}

            {/* Two column layout with centered left section */}
            <div className="max-w-7xl mx-auto">
              <div className="flex items-start gap-6">
                {/* Left side - Centered tests list that expands equally */}
                <div className="flex-1 flex justify-center">
                  <div className="flex-shrink-0 relative">
                  <Card className="shadow-sm border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden w-fit min-w-[320px] max-w-[450px]">
                    <CardContent className="p-0 relative">
                      {/* Scrollable container - max height for 9 items, then scroll */}
                      <div 
                        ref={scrollContainerRef}
                        className={`divide-y divide-gray-200 dark:divide-gray-700 ${
                          tests.length > 9 ? 'max-h-[540px] overflow-y-auto' : ''
                        }`}
                      >
                      {tests.map((test) => {
                        const isLocked = test.time_status !== "allowed";
                        const isSelected = selectedTest?.test_id === test.test_id;
                        
                        return (
                          <div
                            key={test.test_id}
                            onClick={() => setSelectedTest(test)}
                            className={`px-6 py-5 cursor-pointer transition-colors ${
                              isSelected 
                                ? 'bg-teal-50 dark:bg-teal-900/20' 
                                : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <h3 className={`text-base font-semibold ${
                                  isSelected 
                                    ? 'text-teal-700 dark:text-teal-300' 
                                    : 'text-gray-900 dark:text-white'
                                }`}>
                                  {test.test_name}
                                </h3>
                                {isLocked && (
                                  <span className="text-sm text-gray-500 dark:text-gray-400 mt-1 block">
                                    {test.time_status === "expired" ? "Expired" : "Not Started"}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      </div>
                      
                      {/* Down arrow indicator when scrollable */}
                      {tests.length > 9 && (
                        <button
                          onClick={handleScrollDown}
                          className="absolute bottom-2 right-2 bg-white dark:bg-gray-800 rounded-full p-1 shadow-md border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer z-10"
                          aria-label="Scroll down to see more tests"
                        >
                          <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400 animate-bounce" />
                        </button>
                      )}
                    </CardContent>
                  </Card>
                  </div>
                </div>

                {/* Right side - Test details (no box, just content) */}
                <div className="flex-1 min-w-0">
                  {selectedTest ? (
                    <div className="flex items-center min-h-[400px]">
                      <div className="w-full">
                        {/* Title Section - Centered */}
                        <div className="mb-6 text-center">
                          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                            {selectedTest.test_name}
                          </h1>
                          <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
                            {selectedTest.description}
                          </p>
                        </div>
                        
                        {/* Time slot info */}
                        {selectedTest.time_slot && selectedTest.time_slot.length > 0 && (
                          <div className="mb-6">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {selectedTest.time_slot.length === 2 
                                ? `Available: ${selectedTest.time_slot[0]} - ${selectedTest.time_slot[1]}`
                                : `Available: ${selectedTest.time_slot[0]}`
                              }
                            </p>
                          </div>
                        )}
                        
                        {/* Assessment Rules with Titles and Separators */}
                        <div className="space-y-6 mb-8">
                          {/* Rule 1: Multiple Rounds */}
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-5 h-5 rounded-full border-2 border-gray-500 dark:border-gray-400 flex items-center justify-center">
                                <div className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full"></div>
                              </div>
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Multiple Assessment Rounds</h3>
                            </div>
                            <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed ml-7">
                              This assessment may contain multiple rounds of evaluation
                            </p>
                          </div>

                          {/* Separator Line */}
                          <div className="border-t border-gray-300 dark:border-gray-600"></div>

                          {/* Rule 2: No Leaving */}
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-5 h-5 rounded-full border-2 border-gray-500 dark:border-gray-400 flex items-center justify-center">
                                <div className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full"></div>
                              </div>
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Complete All Rounds</h3>
                            </div>
                            <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed ml-7">
                              Once started, you must not leave the assessment without completing all rounds
                            </p>
                          </div>

                          {/* Separator Line */}
                          <div className="border-t border-gray-300 dark:border-gray-600"></div>

                          {/* Rule 3: Monitoring */}
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-5 h-5 rounded-full border-2 border-gray-500 dark:border-gray-400 flex items-center justify-center">
                                <div className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full"></div>
                              </div>
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Proctored Assessment</h3>
                            </div>
                            <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed ml-7">
                              You will be monitored throughout the entire assessment process
                            </p>
                          </div>

                          {/* Separator Line */}
                          <div className="border-t border-gray-300 dark:border-gray-600"></div>

                          {/* Rule 4: AI Evaluation */}
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-5 h-5 rounded-full border-2 border-gray-500 dark:border-gray-400 flex items-center justify-center">
                                <div className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full"></div>
                              </div>
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">AI Evaluation</h3>
                            </div>
                            <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed ml-7">
                              AI will evaluate you throughout the assessment process
                            </p>
                          </div>
                        </div>
                        
                        {/* Start Now button aligned to the right */}
                        <div className="flex justify-end">
                          <Button
                            onClick={() => handleSelectTest(selectedTest.test_id)}
                            disabled={loadingTest === selectedTest.test_id || selectedTest.time_status !== "allowed"}
                            variant="solid"
                            color="primary"
                            size="lg"
                          >
                            {loadingTest === selectedTest.test_id ? (
                              <CircleLoader size="sm" />
                            ) : (
                              selectedTest.time_status === "expired" 
                                ? "Expired" 
                                : selectedTest.time_status === "not_started_yet" 
                                ? "Not Started" 
                                : "Start Now"
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center min-h-[400px]">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Select a test to view details
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {tests.length === 0 && !loadingTests && (
              <div className="max-w-4xl mx-auto">
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
              </div>
            )}
          </div>
        </main>

        {/* Acknowledgment Modal */}
        <AcknowledgmentModal
          isOpen={showAcknowledgmentModal}
          acknowledgmentPdf={acknowledgmentPdf}
          onProceed={handleAcknowledgmentProceed}
          onClose={() => {
            setShowAcknowledgmentModal(false);
            setAcknowledgmentPdf(null);
            setPendingTestId(null);
          }}
        />
      </div>
    </div>
  );
}
