import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ArrowRight, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useClarity } from '@/hooks/useClarity';
import { S3Service, AdminTest } from '@/lib/s3Service';
import { AuthenticatedAdminApiService } from '@/lib/authenticatedApiService';
import { TestsListPlaceholder } from '@/components/ui/table-placeholder';

// SurveySparrow logo component
const SparrowIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0.19154398143291473 -0.0020752372220158577 92.23655700683594 101.78607177734375" className="w-5 h-5">
    <g id="bird" fill="#4A9CA6">
      <path d="M77.8832 26.026C78.3666 19.2146 74.3957 12.8791 68.09 10.4029C61.7842 7.91926 54.6085 9.8675 50.3848 15.1991L47.3583 14.1507L44.2724 13.184L41.1492 12.3065C45.4175 4.96715 53.1138 0.334499 61.5463 0.0147496C69.9787 -0.297564 78.0097 3.75508 82.8059 10.7598L92.4281 11.4365L77.8832 26.026Z"></path>
      <path d="M84.9772 51.9928L84.9103 54.0972L84.7616 56.2016L84.5236 58.2837L84.1964 60.3435L83.78 62.4032L83.2818 64.4407L82.6944 66.4559L82.0177 68.4487L81.2592 70.397L80.4338 72.3229L79.4969 74.1819L78.5004 76.0409L77.4371 77.8404L76.2845 79.573L75.065 81.2833L73.7637 82.9267L72.4178 84.5031L70.9826 86.035L69.4805 87.4998L67.9413 88.9053L66.3351 90.2214L64.662 91.493L62.9442 92.6753L61.1819 93.7907L59.3601 94.8169L57.5159 95.7836L55.6272 96.661L53.6938 97.4493L51.7381 98.1483L49.7602 98.7803L47.7376 99.3083L45.715 99.7693L43.6477 100.119L41.6028 100.401L39.5207 100.58L37.4387 100.691H35.3714L33.2893 100.602L31.2073 100.424L29.14 100.163L27.0951 99.8139L25.0502 99.3752L23.0499 98.8472L21.0496 98.2524L19.7929 98.9513L18.4693 99.5685L17.1457 100.141L15.7775 100.624L14.387 101.019L12.9741 101.323L11.539 101.561L10.1038 101.718L8.64633 101.784L7.18887 101.762L5.75372 101.673L4.31856 101.472L2.88341 101.212L18.0529 85.9829C33.044 94.0287 51.4779 91.2848 63.5243 79.2087C75.5632 67.1325 78.3963 48.5499 70.5067 33.3878L77.8684 26.0038L78.9169 27.8331L79.8761 29.6921L80.7684 31.5734L81.5715 33.5217L82.2854 35.4922L82.9397 37.4851L83.4826 39.5002L83.9585 41.5377L84.3303 43.6198L84.6128 45.7019L84.8285 47.784L84.94 49.8661L84.9623 51.9705L84.9772 51.9928Z"></path>
      <path fillRule="evenodd" clipRule="evenodd" d="M36.3009 82.7781C53.4038 82.7781 67.2794 68.7909 67.2794 51.5318C67.2794 50.4685 67.2274 49.4126 67.1233 48.3715C66.7887 45.003 65.9187 41.7832 64.6025 38.8162L37.7733 65.5859L21.5404 49.3531C20.0829 47.8956 20.0829 45.531 21.5404 44.0735C22.9979 42.616 25.3625 42.616 26.82 44.0735L37.7807 55.0342L60.6539 32.213C57.1293 27.6993 52.3999 24.1895 46.9568 22.1744C46.927 22.1595 46.9047 22.1521 46.875 22.1446C46.4585 21.9959 46.0347 21.8472 45.6034 21.7059C45.5737 21.6985 45.5514 21.691 45.5216 21.6836C35.3565 18.2779 24.4776 16.4337 13.1823 16.4337C9.48659 16.4337 5.84293 16.6345 2.25132 17.0212C0.912839 20.8284 0.191544 24.9183 0.191544 29.1865C0.191544 36.169 2.13235 42.683 5.50087 48.2302C5.3819 49.3159 5.32984 50.4164 5.32984 51.5318C5.32984 68.7909 19.2055 82.7781 36.3084 82.7781H36.3009Z"></path>
    </g>
  </svg>
);

interface ListItem {
  icon: React.ReactNode;
  title: string;
  category: string;
  description: string;
  link: string;
  test_id: string;
}

export default function AdminTests() {
  const [tests, setTests] = useState<AdminTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Microsoft Clarity tracking
  const { trackPageView, trackUserAction, setUserId, setTag } = useClarity(true, 'Admin Tests');

  // Set user identification for Clarity
  useEffect(() => {
    if (user?.email) {
      setUserId(user.email, user.displayName || undefined);
      setTag('user_type', 'admin');
      setTag('page_type', 'admin_tests');
    }
  }, [user?.email, user?.displayName, setUserId, setTag]);

  // Fetch tests data
  useEffect(() => {
    const fetchData = async () => {
      // Don't fetch if auth is still loading
      if (authLoading) {
        return;
      }

      // Don't fetch if no user email
      if (!user?.email) {
        setLoading(false);
        return;
      }

      try {
        setError(null);
        setLoading(true);

        console.log('🔍 Admin fetching all tests with Firebase auth');
        const allTests = await AuthenticatedAdminApiService.getAllTests();
        console.log('✅ All tests fetched for admin with auth:', allTests);

        // Cache tests in localStorage for other pages to use
        localStorage.setItem('admin_tests', JSON.stringify(allTests));
        setTests(allTests);
      } catch (error) {
        console.error('❌ Failed to fetch tests:', error);
        setError('Failed to load tests. Please try again later.');
        toast({
          title: "Error",
          description: "Failed to load tests. Please refresh the page.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.email, authLoading, toast]);

  const handleViewRounds = (testId: string, testName: string) => {
    console.log('🎯 Admin viewing rounds for test:', testId);

    // Track admin action
    trackUserAction('admin_view_rounds', {
      test_id: testId,
      test_name: testName,
      user_email: user?.email || 'unknown',
    });

    // Navigate to assessment progress page
    setLocation(`/admin/assessment-progress/${testId}`);
  };

  // Refresh data function
  const handleRefresh = async () => {
    if (refreshing) return;

    try {
      setRefreshing(true);
      setError(null);

      console.log('🔄 Refreshing tests data with Firebase auth');
      const allTests = await AuthenticatedAdminApiService.getAllTests();
      console.log('✅ Tests refreshed with auth:', allTests);

      // Update cache
      localStorage.setItem('admin_tests', JSON.stringify(allTests));
      setTests(allTests);

      toast({
        title: "Success",
        description: "Tests data refreshed successfully",
      });
    } catch (error) {
      console.error('❌ Failed to refresh tests:', error);
      setError('Failed to refresh tests. Please try again.');
      toast({
        title: "Error",
        description: "Failed to refresh tests. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  // Convert AdminTest to ListItem format
  const listItems: ListItem[] = tests.map((test, index) => ({
    icon: <SparrowIcon />,
    title: test.test_name,
    category: 'Assessment Test',
    description: `Manage assessments and view rounds for ${test.test_name}`,
    link: `/dashboard?test_id=${test.test_id}`,
    test_id: test.test_id,
  }));

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Fixed Header - Consistent with main layout */}
          <div className="flex items-center justify-between min-h-[4rem]">
            <div className="flex justify-start">
              {/* Admin panel removed - functionality moved to app sidebar */}
            </div>
          </div>

          {/* Loading Placeholders */}
          <section className="py-8 min-h-[60vh]">
            <TestsListPlaceholder />
          </section>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Fixed Header - Consistent with main layout */}
          <div className="flex items-center justify-between min-h-[4rem]">
            <div className="flex justify-start">
              {/* Admin panel removed - functionality moved to app sidebar */}
            </div>
          </div>

          <div className="flex items-center justify-center min-h-[40vh]">
            <Alert className="border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800 max-w-md">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-red-800 dark:text-red-200">
                {error}
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* Fixed Header - No layout shifts */}
        <div className="flex items-center justify-between min-h-[4rem]">
          <div className="flex justify-start">
            {/* Admin panel removed - functionality moved to app sidebar */}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Tests View */}
        <section className="py-8 min-h-[60vh]">
          <div className="container mx-auto px-0 md:px-8">
            <div className="flex flex-col">
              <Separator />
              {listItems.map((item, index) => (
                <div key={index}>
                  <div className="grid items-center gap-4 px-4 py-5 md:grid-cols-4">
                    <div className="order-2 flex items-center gap-2 md:order-none">
                      <span className="flex h-14 w-16 shrink-0 items-center justify-center rounded-md bg-muted">
                        {item.icon}
                      </span>
                      <div className="flex flex-col gap-1">
                        <h3 className="text-sm font-semibold">{item.title}</h3>
                        <p className="text-xs text-muted-foreground">
                          {item.category}
                        </p>
                      </div>
                    </div>
                    <p className="order-1 text-sm font-medium md:order-none md:col-span-2">
                      {item.description}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewRounds(item.test_id, item.title)}
                      className="order-3 ml-auto w-fit gap-2 md:order-none text-xs"
                    >
                      <span>View Rounds</span>
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                  <Separator />
                </div>
              ))}
            </div>
          </div>
        </section>

        {tests.length === 0 && !loading && (
          <div className="flex items-center justify-center min-h-[40vh]">
            <div className="text-center">
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 mb-6 mx-auto w-24 h-24 flex items-center justify-center">
                <SparrowIcon />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No Tests Available
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 max-w-md mx-auto">
                No tests are currently available in the system.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
