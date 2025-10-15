import { useState, useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';
import { Button } from "@sparrowengg/twigs-react";
import { Input } from '@/components/ui/input';
import { AdminTable, Column } from '@/components/ui/admin-table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, AlertCircle, Loader2, Eye, RefreshCw } from 'lucide-react';
import { TablePlaceholder } from '@/components/ui/table-placeholder';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useClarity } from '@/hooks/useClarity';
import { S3Service, AssessmentProgress as AssessmentProgressType } from '@/lib/s3Service';
import { AuthenticatedAdminApiService } from '@/lib/authenticatedApiService';

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


export default function AssessmentProgress() {
  const [match, params] = useRoute('/admin/assessment-progress/:testId');
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [assessments, setAssessments] = useState<AssessmentProgressType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [nameFilter, setNameFilter] = useState("");
  const [testName, setTestName] = useState("");
  
  // Refresh state
  const [refreshing, setRefreshing] = useState(false);
  
  // Microsoft Clarity tracking
  const { trackPageView, trackUserAction, setUserId, setTag } = useClarity(true, 'Assessment Progress');

  // Set user identification for Clarity
  useEffect(() => {
    if (user?.email) {
      setUserId(user.email, user.displayName || undefined);
      setTag('user_type', 'admin');
      setTag('page_type', 'assessment_progress');
    }
  }, [user?.email, user?.displayName, setUserId, setTag]);

  // Fetch assessment progress data
  useEffect(() => {
    const fetchAssessmentProgress = async () => {
      if (!match || !params?.testId) {
        setError('Invalid test ID');
        setLoading(false);
        return;
      }

      try {
        setError(null);
        console.log('🔍 Fetching assessment progress for test:', params.testId);
        
        const progressData = await AuthenticatedAdminApiService.getAssessmentProgress(params.testId);
        setAssessments(progressData);
        
        // Try to get test name from localStorage or API
        const tests = JSON.parse(localStorage.getItem('admin_tests') || '[]');
        const test = tests.find((t: any) => t.test_id === params.testId);
        setTestName(test?.test_name || `Test ${params.testId}`);
        
      } catch (error) {
        console.error('❌ Failed to fetch assessment progress:', error);
        setError('Failed to load assessment progress. Please try again later.');
        toast({
          title: "Error",
          description: "Failed to load assessment progress. Please refresh the page.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAssessmentProgress();
  }, [match, params?.testId, toast]);

  const filteredAssessments = assessments.filter((assessment) => {
    return !nameFilter || assessment.assessment_name.toLowerCase().includes(nameFilter.toLowerCase());
  });

  const toggleColumn = (col: string) => {
    setVisibleColumns((prev) =>
      prev.includes(col)
        ? prev.filter((c) => c !== col)
        : [...prev, col]
    );
  };

  const handleViewUsers = (assessmentId: string, assessmentName: string) => {
    console.log('🎯 Admin viewing users for assessment:', assessmentId);
    
    // Track user action
    trackUserAction('admin_view_users', {
      assessment_id: assessmentId,
      assessment_name: assessmentName,
      user_email: user?.email || 'unknown',
    });
    
    // Navigate to assessment users page
    setLocation(`/admin/assessment-users/${assessmentId}`);
  };

  const allColumns: Column[] = [
    {
      key: "assessment_name",
      label: "Assessment Name",
      width: "200px"
    },
    {
      key: "description",
      label: "Description",
      width: "300px"
    },
    {
      key: "time_limit",
      label: "Time Limit",
      width: "120px",
      render: (value) => `${value} min`
    },
    {
      key: "completed_count",
      label: "Completed Count",
      width: "120px"
    },
    {
      key: "user_info",
      label: "User Info",
      width: "100px",
      render: (value, row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleViewUsers(row.assessment_id, row.assessment_name)}
          className="h-8 w-8 p-0"
        >
          <Eye className="h-4 w-4" />
        </Button>
      )
    }
  ];

  const allColumnKeys = allColumns.map(col => col.key);

  // Initialize visible columns
  useEffect(() => {
    setVisibleColumns([...allColumnKeys]);
  }, []);

  // Refresh data function
  const handleRefresh = async () => {
    if (refreshing || !params?.testId) return;
    
    try {
      setRefreshing(true);
      setError(null);
      
      console.log('🔄 Refreshing assessment progress data for test:', params.testId);
      const progressData = await S3Service.getAssessmentProgress(params.testId);
      console.log('✅ Assessment progress refreshed:', progressData);
      
      setAssessments(progressData);
      
      toast({
        title: "Success",
        description: "Assessment progress refreshed successfully",
      });
    } catch (error) {
      console.error('❌ Failed to refresh assessment progress:', error);
      setError('Failed to refresh assessment progress. Please try again.');
      toast({
        title: "Error",
        description: "Failed to refresh assessment progress. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  if (!match) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Alert className="border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-red-800 dark:text-red-200">
            Invalid route
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="solid"
            color="primary"
            size="sm"
            onClick={() => window.history.back()}
            leftIcon={<ArrowLeft className="h-4 w-4" />}
          >
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Assessment Progress
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              {testName}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-6">
            {/* Header Placeholder */}
            <div className="flex items-center gap-4">
              <div className="h-10 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="space-y-2">
                <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            </div>
            {/* Table Placeholder */}
            <TablePlaceholder rows={5} columns={5} />
          </div>
        ) : error ? (
          <Alert className="border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-800 dark:text-red-200">
              {error}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="container my-10 space-y-4 p-4 border border-border rounded-lg bg-background shadow-sm">
            {/* Assessment Progress Table */}
            <AdminTable
              columns={allColumns}
              data={filteredAssessments}
              visibleColumns={visibleColumns}
              onToggleColumn={toggleColumn}
              onRefresh={handleRefresh}
              refreshing={refreshing}
              searchValue={nameFilter}
              onSearchChange={setNameFilter}
              searchPlaceholder="Filter by assessment name..."
              emptyMessage="No assessments found."
            />
          </div>
        )}
      </div>
    </main>
  );
}
