import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useRoute } from 'wouter';
import { Button, Drawer, DrawerHeader, DrawerBody, DrawerFooter, Heading } from "@sparrowengg/twigs-react";
import { Button as CustomButton } from '@/components/ui/button-custom';
import { Input } from '@/components/ui/input';
import { AdminTable, Column } from '@/components/ui/admin-table';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, AlertCircle, Loader2, Crown, RefreshCw, ChevronUp, ChevronDown, ArrowUpDown, CheckCircle, Users, Clock, UserCheck, ChevronLeft, ChevronRight, Play, Pause, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useClarity } from '@/hooks/useClarity';
import { S3Service, AssessmentUsersResponse, AssessmentUser, AssessmentSummary } from '@/lib/s3Service';
import { AuthenticatedAdminApiService } from '@/lib/authenticatedApiService';
import { Progress, ProgressCircle } from '@/components/ui/progress-custom';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { motion, AnimatePresence } from 'framer-motion';

// Interfaces for User Answers
interface Question {
  question_id: string;
  question_text: string;
  question_order: number;
  original_id: string;
}

interface ImageData {
  filename: string;
  url: string;
  size: number;
  key: string;
}

interface Interaction {
  question: string;
  question_id: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
}

interface AnswerResponse {
  status: string;
  message: string;
  data: {
    audio_url: string;
    audio_filename: string;
    audio_size: number;
    questions: {
      user_email: string;
      assessment_id: string;
      fetched_at: string;
      questions: Question[];
    };
    images: ImageData[];
    image_count: number;
    logs: {
      user_email: string;
      assessment_id: string;
      uploaded_at: string;
      logs: {
        session_start: string;
        user_agent: string;
        interactions: Interaction[];
        performance_metrics: {
          recording_duration: number;
        };
      };
    };
  };
}

// Custom Audio Player component
const CustomAudioPlayer = ({
  src,
}: {
  src: string;
}) => {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isAudioReady, setIsAudioReady] = useState(false);


  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const current = audioRef.current.currentTime;
    const total = audioRef.current.duration;
    setCurrentTime(current);
    setProgress((current / total) * 100);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration);
    setIsAudioReady(true);
  };

  const handleSeek = (percentage: number) => {
    if (!audioRef.current || !isFinite(duration)) return;
    const newTime = (percentage / 100) * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    setProgress(percentage);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  React.useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('ended', () => setIsPlaying(false));
      audio.addEventListener('play', () => setIsPlaying(true));
      audio.addEventListener('pause', () => setIsPlaying(false));

      return () => {
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('ended', () => setIsPlaying(false));
        audio.removeEventListener('play', () => setIsPlaying(true));
        audio.removeEventListener('pause', () => setIsPlaying(false));
      };
    }
  }, [src]);

  return (
    <div className="space-y-2">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Audio Controls - Play button on left, seeker on right */}
      <div className="flex items-center space-x-4">
        <Button
          variant="solid"
          color="primary"
          size="sm"
          onClick={togglePlayPause}
          disabled={!isAudioReady}
          className="px-3 py-2 flex-shrink-0"
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>

        {/* Progress Bar */}
        <div className="flex-1">
          <div
            className="relative w-full h-2 bg-gray-600 rounded-full cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const percentage = (x / rect.width) * 100;
              handleSeek(percentage);
            }}
          >
            <motion.div
              className="absolute top-0 left-0 h-full bg-teal-500 rounded-full"
              style={{ width: `${progress}%` }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          </div>
        </div>

        {/* Current Time */}
        <div className="text-sm text-gray-300 flex-shrink-0">
          {formatTime(currentTime)}
        </div>
      </div>
    </div>
  );
};

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


export default function AssessmentUsers() {
  const [match, params] = useRoute('/admin/assessment-users/:assessmentId');
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [assessmentData, setAssessmentData] = useState<AssessmentUsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [emailFilter, setEmailFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Sorting state
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Table sorting state
  const [tableSortColumn, setTableSortColumn] = useState<string>('');
  const [tableSortDirection, setTableSortDirection] = useState<'asc' | 'desc'>('asc');

  // Refresh state
  const [refreshing, setRefreshing] = useState(false);

  // Drawer state for user answers
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AssessmentUser | null>(null);
  const [userAnswers, setUserAnswers] = useState<AnswerResponse | null>(null);
  const [loadingUserAnswers, setLoadingUserAnswers] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Function to fetch user answers for the drawer
  const fetchUserAnswers = async (userEmail: string) => {
    try {
      setLoadingUserAnswers(true);
      console.log('🔍 AssessmentUsers: Fetching user answers with Firebase auth');

      const { AuthenticatedApiService } = await import('@/lib/authenticatedApiService');
      const data: AnswerResponse = await AuthenticatedApiService.getUserAnswers({
        user_email: userEmail,
        assessment_id: params?.assessmentId || '',
      });
      setUserAnswers(data);
      setCurrentImageIndex(0); // Reset to first image

    } catch (err) {
      console.error('Error fetching user answers:', err);
      toast({
        title: "Error",
        description: "Failed to load user answers",
        variant: "destructive",
      });
    } finally {
      setLoadingUserAnswers(false);
    }
  };

  // Get question duration from interactions
  const getQuestionDuration = (questionId: string): number | null => {
    if (!userAnswers?.data?.logs?.logs?.interactions) return null;

    const interaction = userAnswers.data.logs.logs.interactions.find(
      (interaction: Interaction) => interaction.question_id === questionId
    );

    return interaction ? interaction.duration_seconds : null;
  };

  // Format duration for display
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // Handle user row click - open drawer instead of navigating
  const handleUserClick = async (userRecord: AssessmentUser) => {
    if (userRecord.status === 'completed') {
      setSelectedUser(userRecord);
      setIsDrawerOpen(true);
      await fetchUserAnswers(userRecord.user_email);
    } else {
      toast({
        description: "User has not completed the assessment yet",
      });
    }
  };

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
        
        const usersData = await AuthenticatedAdminApiService.getAssessmentUsers(params.assessmentId);
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

  // Sorting function
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Table sorting function
  const handleTableSort = (column: string) => {
    if (tableSortColumn === column) {
      setTableSortDirection(tableSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setTableSortColumn(column);
      setTableSortDirection('asc');
    }
  };

  // Get sorted and filtered users
  const processedUsers = useMemo(() => {
    if (!assessmentData?.users) return [];

    // First filter
    let filtered = assessmentData.users.filter((userRecord) => {
      const emailMatch = !emailFilter || userRecord.user_email.toLowerCase().includes(emailFilter.toLowerCase());
      const statusMatch = !statusFilter || userRecord.status === statusFilter;
      return emailMatch && statusMatch;
    });

    // Default sort: Show completed users first
    filtered = filtered.sort((a, b) => {
      // Completed users come first
      if (a.status === 'completed' && b.status !== 'completed') return -1;
      if (a.status !== 'completed' && b.status === 'completed') return 1;

      // If both are completed or both are not, maintain current order
      return 0;
    });

    // Then apply existing sort on top of the default completed-first sorting
    if (sortField) {
      filtered = filtered.sort((a, b) => {
        let aValue: any = a[sortField as keyof AssessmentUser];
        let bValue: any = b[sortField as keyof AssessmentUser];

        // Handle null values for completed_at
        if (sortField === 'completed_at') {
          aValue = aValue || '';
          bValue = bValue || '';
        }

        // Convert to strings for comparison
        const aStr = String(aValue).toLowerCase();
        const bStr = String(bValue).toLowerCase();

        if (sortDirection === 'asc') {
          return aStr.localeCompare(bStr);
        } else {
          return bStr.localeCompare(aStr);
        }
      });
    }

    // Apply table column sorting
    if (tableSortColumn) {
      filtered = filtered.sort((a, b) => {
        let aValue: any = a[tableSortColumn as keyof AssessmentUser];
        let bValue: any = b[tableSortColumn as keyof AssessmentUser];

        // Handle null values
        if (tableSortColumn === 'completed_at') {
          aValue = aValue || '';
          bValue = bValue || '';
        }

        // Convert to strings for comparison
        const aStr = String(aValue).toLowerCase();
        const bStr = String(bValue).toLowerCase();

        if (tableSortDirection === 'asc') {
          return aStr.localeCompare(bStr);
        } else {
          return bStr.localeCompare(aStr);
        }
      });
    }

    return filtered;
  }, [assessmentData?.users, emailFilter, statusFilter, sortField, sortDirection, tableSortColumn, tableSortDirection]);

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
    const avatarUrl = '/user.png';

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

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-500 text-white';
      case 'started':
      case 'in_progress':
        return 'bg-yellow-500 text-white';
      case 'not_started':
        return 'bg-red-400 text-white';
      case 'pending':
        return 'bg-blue-400 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  const allColumns: Column[] = [
    {
      key: "user",
      label: "User",
      width: "200px",
      render: (value, row) => {
        const { displayName, initials, avatarUrl } = getUserDisplayInfo(row.user_email);
        return (
          <div className="flex items-center gap-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="h-8 w-8 hover:z-10">
                    <AvatarImage src={avatarUrl} alt={displayName} />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent className="text-sm">
                  <p className="font-semibold">{displayName}</p>
                  <p className="text-xs text-muted-foreground">{row.user_email}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span>{displayName}</span>
          </div>
        );
      }
    },
    {
      key: "user_email",
      label: "Email",
      width: "250px"
    },
    {
      key: "test_id",
      label: "Test ID",
      width: "150px"
    },
    {
      key: "completed_at",
      label: "Completed At",
      width: "180px",
      render: (value) => value ? formatDate(value) : 'Not completed'
    },
    {
      key: "status",
      label: "Status",
      width: "100px",
      sortable: true,
      render: (value) => (
        <Badge className={getStatusColor(value)}>
          {value}
        </Badge>
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
    if (refreshing || !params?.assessmentId) return;
    
    try {
      setRefreshing(true);
      setError(null);
      
      console.log('🔄 Refreshing assessment users data for assessment:', params.assessmentId);
      const response = await AuthenticatedAdminApiService.getAssessmentUsers(params.assessmentId);
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
        {/* Assessment Layout - Card + Progress Circle */}
        <div className="flex items-center gap-60">
          {/* Assessment Content - No Box */}
          <div className="flex-1 max-w-3xl ml-8">
              {/* Left side - Back button and Assessment info */}
              <div className="flex items-start gap-4">
                <Button
                  variant="solid"
                  color="primary"
                  onClick={() => window.history.back()}
                  className="h-10 w-10 p-0 mt-1"
                  leftIcon={<ArrowLeft className="h-4 w-4" />}
                >
                </Button>

                <div className="flex-1">
                  <div className="flex flex-col">
                    <span className="font-semibold text-black dark:text-white/90 text-lg">
                      {assessmentData?.assessment_name || 'Assessment Users'}
                    </span>
                    {assessmentData && (
                      <>
                        <span className="text-black dark:text-white/60 text-sm">
                          {assessmentData.description}
                        </span>
                        <span className="text-black dark:text-white/50 text-xs mt-1">
                          Time Limit: {assessmentData.time_limit} minutes
                        </span>

                        {/* Stats below the title */}
                        {assessmentData.summary && (
                          <div className="flex items-center gap-6 mt-4">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-5 w-5 text-green-500" />
                              <div>
                                <p className="text-xs text-black dark:text-white/60">Completed</p>
                                <p className="text-lg font-bold text-black dark:text-white/90">
                                  {assessmentData.summary.total_users_completed}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Users className="h-5 w-5 text-blue-500" />
                              <div>
                                <p className="text-xs text-black dark:text-white/60">Assigned</p>
                                <p className="text-lg font-bold text-black dark:text-white/90">
                                  {assessmentData.summary.total_users_assigned}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Clock className="h-5 w-5 text-orange-500" />
                              <div>
                                <p className="text-xs text-black dark:text-white/60">Not Started</p>
                                <p className="text-lg font-bold text-black dark:text-white/90">
                                  {assessmentData.summary.total_users_not_started}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

          {/* Progress Circle - Outside and to the right */}
          {assessmentData && !loading && !error && (
            <div className="flex-shrink-0">
              <ProgressCircle
                value={assessmentData.summary
                  ? (assessmentData.summary.total_users_completed / assessmentData.summary.total_users_assigned) * 100
                  : (processedUsers.filter(u => u.status === 'completed').length / processedUsers.length) * 100
                }
                size={120}
                strokeWidth={8}
                className="text-green-500"
                trackClassName="text-gray-200 dark:text-gray-600"
              >
                <div className="text-center">
                  <div className="text-xl font-bold text-black dark:text-white">
                    {assessmentData.summary
                      ? Math.round((assessmentData.summary.total_users_completed / assessmentData.summary.total_users_assigned) * 100)
                      : Math.round((processedUsers.filter(u => u.status === 'completed').length / processedUsers.length) * 100)
                    }%
                  </div>
                </div>
              </ProgressCircle>
            </div>
          )}
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
          <div className="container my-10 space-y-4 p-4 border border-border rounded-lg bg-background shadow-sm">
            <div className="flex flex-wrap gap-4 items-center justify-between mb-6">
              <div className="flex gap-2 flex-wrap">
                <Input
                  placeholder="Filter by status..."
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-48"
                />
              </div>
            </div>

            {/* Users Table */}
            <AdminTable
              columns={allColumns}
              data={processedUsers}
              visibleColumns={visibleColumns}
              onToggleColumn={toggleColumn}
              onRefresh={handleRefresh}
              refreshing={refreshing}
              searchValue={emailFilter}
              onSearchChange={setEmailFilter}
              searchPlaceholder="Filter by email..."
              emptyMessage="No users found."
              sortColumn={tableSortColumn}
              sortDirection={tableSortDirection}
              onSort={handleTableSort}
              onRowClick={handleUserClick}
              rowClassName="hover:bg-[#333333] hover:shadow-sm hover:scale-[1.01] transition-all duration-200 ease-in-out border-l-2 hover:border-l-blue-500"
            />
          </div>
        )}

        {/* User Answers Drawer */}
        <Drawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
        >
          <DrawerHeader className="bg-card border-b border-border">
            <Heading size="h4" className="text-foreground text-xs">
              {selectedUser?.user_email} - Assessment Answers
            </Heading>
          </DrawerHeader>
          <DrawerBody className="bg-background">
            {loadingUserAnswers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
                <span className="ml-2 text-gray-600 dark:text-gray-300">Loading answers...</span>
              </div>
            ) : userAnswers && userAnswers.data ? (
              <div className="space-y-6">
                {/* Questions Section */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Questions ({userAnswers.data.questions?.questions?.length || 0})
                  </h3>
                  <Accordion type="single" collapsible className="w-full">
                    {userAnswers.data.questions?.questions?.map((question, index) => {
                      const duration = getQuestionDuration(question.question_id);
                      return (
                        <AccordionItem
                          key={question.question_id}
                          value={question.question_id}
                        >
                          <AccordionTrigger>
                            <div className="flex items-start gap-3 text-left">
                              <Badge variant="secondary" className="text-xs mt-0.5">
                                Q{question.question_order}
                              </Badge>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900 dark:text-white leading-relaxed">
                                  {question.question_text}
                                </p>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                              <Clock className="h-4 w-4" />
                              <span>
                                Time taken: {duration ? formatDuration(duration) : 'Not available'}
                              </span>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    }) || (
                      <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                        No questions found.
                      </div>
                    )}
                  </Accordion>
                </div>

                {/* Images Section */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Screenshots ({userAnswers.data.image_count || 0})
                  </h3>
                  {userAnswers.data.images && userAnswers.data.images.length > 0 ? (
                    <div className="space-y-4">
                      {/* Image Navigation */}
                      <div className="flex items-center justify-between">
                        <Button
                          variant="solid"
                          color="primary"
                          size="sm"
                          onClick={() => setCurrentImageIndex(Math.max(0, currentImageIndex - 1))}
                          disabled={currentImageIndex === 0}
                          leftIcon={<ChevronLeft className="h-4 w-4" />}
                        >
                          Previous
                        </Button>
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          {currentImageIndex + 1} of {userAnswers.data.images.length}
                        </span>
                        <Button
                          variant="solid"
                          color="primary"
                          size="sm"
                          onClick={() => setCurrentImageIndex(Math.min(userAnswers.data.images.length - 1, currentImageIndex + 1))}
                          disabled={currentImageIndex === userAnswers.data.images.length - 1}
                          rightIcon={<ChevronRight className="h-4 w-4" />}
                        >
                          Next
                        </Button>
                      </div>

                      {/* Current Image */}
                      <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                        <img
                          src={userAnswers.data.images[currentImageIndex]?.url}
                          alt={`Screenshot ${currentImageIndex + 1}`}
                          className="w-full h-auto max-h-96 object-contain bg-gray-50 dark:bg-gray-800"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = '/user.png'; // Fallback image
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      No screenshots available.
                    </div>
                  )}
                </div>

                {/* Audio Section */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Audio Recording
                  </h3>
                  {userAnswers.data.audio_url ? (
                    <CustomAudioPlayer src={userAnswers.data.audio_url} />
                  ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      No audio recording available.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                Failed to load user answers.
              </div>
            )}
          </DrawerBody>
          <DrawerFooter className="bg-card border-t border-border">
            <Button
              variant="solid"
              color="primary"
              onClick={() => setIsDrawerOpen(false)}
            >
              Close
            </Button>
          </DrawerFooter>
        </Drawer>
      </div>
    </main>
  );
}
