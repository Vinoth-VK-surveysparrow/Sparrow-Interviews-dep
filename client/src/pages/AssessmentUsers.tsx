import { useState, useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table,
  TableHeader, 
  TableHead, 
  TableBody, 
  TableRow, 
  TableCell
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, AlertCircle, Loader2, Crown, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useClarity } from '@/hooks/useClarity';
import { S3Service, AssessmentUsersResponse, AssessmentUser } from '@/lib/s3Service';

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

const allColumns = [
  "User",
  "Email",
  "Test ID",
  "Completed At",
  "Status",
] as const;

export default function AssessmentUsers() {
  const [match, params] = useRoute('/admin/assessment-users/:assessmentId');
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [assessmentData, setAssessmentData] = useState<AssessmentUsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([...allColumns]);
  const [emailFilter, setEmailFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  
  // Refresh state
  const [refreshing, setRefreshing] = useState(false);
  
  // Microsoft Clarity tracking
  const { trackPageView, trackUserAction, setUserId, setTag } = useClarity(true, 'Assessment Users');

  // Set user identification for Clarity
  useEffect(() => {
    if (user?.email) {
      setUserId(user.email, user.displayName || undefined);
      setTag('user_type', 'admin');
      setTag('page_type', 'assessment_users');
    }
  }, [user?.email, user?.displayName, setUserId, setTag]);

  // Fetch assessment users data
  useEffect(() => {
    const fetchAssessmentUsers = async () => {
      if (!match || !params?.assessmentId) {
        setError('Invalid assessment ID');
        setLoading(false);
        return;
      }

      try {
        setError(null);
        console.log('🔍 Fetching users for assessment:', params.assessmentId);
        
        const usersData = await S3Service.getAssessmentUsers(params.assessmentId);
        setAssessmentData(usersData);
        
      } catch (error) {
        console.error('❌ Failed to fetch assessment users:', error);
        setError('Failed to load assessment users. Please try again later.');
        toast({
          title: "Error",
          description: "Failed to load assessment users. Please refresh the page.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAssessmentUsers();
  }, [match, params?.assessmentId, toast]);

  const filteredUsers = assessmentData?.users.filter((userRecord) => {
    return (
      (!emailFilter || userRecord.user_email.toLowerCase().includes(emailFilter.toLowerCase())) &&
      (!statusFilter || userRecord.status === statusFilter)
    );
  }) || [];

  const toggleColumn = (col: string) => {
    setVisibleColumns((prev) =>
      prev.includes(col)
        ? prev.filter((c) => c !== col)
        : [...prev, col]
    );
  };

  // Generate user display name and avatar
  const getUserDisplayInfo = (email: string) => {
    const name = email.split('@')[0];
    const displayName = name.charAt(0).toUpperCase() + name.slice(1);
    const initials = displayName.substring(0, 2).toUpperCase();
    const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${email}`;
    
    return { displayName, initials, avatarUrl };
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Refresh data function
  const handleRefresh = async () => {
    if (refreshing || !params?.assessmentId) return;
    
    try {
      setRefreshing(true);
      setError(null);
      
      console.log('🔄 Refreshing assessment users data for assessment:', params.assessmentId);
      const response = await S3Service.getAssessmentUsers(params.assessmentId);
      console.log('✅ Assessment users refreshed:', response);
      
      setAssessmentData(response);
      
      toast({
        title: "Success",
        description: "Assessment users refreshed successfully",
      });
    } catch (error) {
      console.error('❌ Failed to refresh assessment users:', error);
      setError('Failed to refresh assessment users. Please try again.');
      toast({
        title: "Error",
        description: "Failed to refresh assessment users. Please try again.",
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
            variant="outline"
            size="sm"
            onClick={() => window.history.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <SparrowIcon />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Assessment Users
              </h1>
              {assessmentData && (
                <div className="space-y-1">
                  <p className="text-lg text-gray-900 dark:text-white font-medium">
                    {assessmentData.assessment_name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {assessmentData.description}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                    <span>Time Limit: {assessmentData.time_limit} minutes</span>
                    <span>Total Completed: {assessmentData.total_users_completed}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
              <span className="text-gray-600 dark:text-gray-300">Loading assessment users...</span>
            </div>
          </div>
        ) : error ? (
          <Alert className="border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-800 dark:text-red-200">
              {error}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="container my-10 space-y-4 p-4 border border-border rounded-lg bg-background shadow-sm overflow-x-auto">
            {/* Filters and Controls */}
            <div className="flex flex-wrap gap-4 items-center justify-between mb-6">
              <div className="flex gap-2 flex-wrap">
                <Input
                  placeholder="Filter by email..."
                  value={emailFilter}
                  onChange={(e) => setEmailFilter(e.target.value)}
                  className="w-48"
                />
                <Input
                  placeholder="Filter by status..."
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-48"
                />
              </div>

              <div className="flex gap-2">
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      Columns
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-48">
                    {allColumns.map((col) => (
                      <DropdownMenuCheckboxItem
                        key={col}
                        checked={visibleColumns.includes(col)}
                        onCheckedChange={() => toggleColumn(col)}
                      >
                        {col}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Users Table */}
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  {visibleColumns.includes("User") && <TableHead className="w-[200px]">User</TableHead>}
                  {visibleColumns.includes("Email") && <TableHead className="w-[250px]">Email</TableHead>}
                  {visibleColumns.includes("Test ID") && <TableHead className="w-[150px]">Test ID</TableHead>}
                  {visibleColumns.includes("Completed At") && <TableHead className="w-[180px]">Completed At</TableHead>}
                  {visibleColumns.includes("Status") && <TableHead className="w-[100px]">Status</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length ? (
                  filteredUsers.map((userRecord, index) => {
                    const { displayName, initials, avatarUrl } = getUserDisplayInfo(userRecord.user_email);
                    
                    return (
                      <TableRow key={`${userRecord.user_email}-${index}`}>
                        {visibleColumns.includes("User") && (
                          <TableCell className="font-medium whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Avatar className="h-8 w-8 ring-2 ring-white hover:z-10">
                                      <AvatarImage src={avatarUrl} alt={displayName} />
                                      <AvatarFallback>{initials}</AvatarFallback>
                                    </Avatar>
                                  </TooltipTrigger>
                                  <TooltipContent className="text-sm">
                                    <p className="font-semibold">{displayName}</p>
                                    <p className="text-xs text-muted-foreground">{userRecord.user_email}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <span>{displayName}</span>
                            </div>
                          </TableCell>
                        )}
                        {visibleColumns.includes("Email") && (
                          <TableCell className="whitespace-nowrap">
                            {userRecord.user_email}
                          </TableCell>
                        )}
                        {visibleColumns.includes("Test ID") && (
                          <TableCell className="whitespace-nowrap">
                            {userRecord.test_id}
                          </TableCell>
                        )}
                        {visibleColumns.includes("Completed At") && (
                          <TableCell className="whitespace-nowrap">
                            {formatDate(userRecord.completed_at)}
                          </TableCell>
                        )}
                        {visibleColumns.includes("Status") && (
                          <TableCell className="whitespace-nowrap">
                            <Badge
                              className={cn(
                                "whitespace-nowrap",
                                userRecord.status === "completed" && "bg-green-500 text-white",
                                userRecord.status === "in_progress" && "bg-yellow-500 text-white",
                                userRecord.status === "pending" && "bg-gray-400 text-white",
                              )}
                            >
                              {userRecord.status}
                            </Badge>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={visibleColumns.length} className="text-center py-6">
                      No users found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </main>
  );
}
