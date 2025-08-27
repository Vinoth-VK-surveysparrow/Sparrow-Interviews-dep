import React from 'react';
import { Link, useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChevronRight, CheckCircle, Loader2, AlertCircle, Lock, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useS3Upload } from '@/hooks/useS3Upload';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { S3Service, Assessment } from '@/lib/s3Service';
import PermissionsTest from '@/components/PermissionsTest';

// Sparrow logo component using the Symbol.svg
const SparrowLogo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0.19154398143291473 -0.0020752372220158577 92.23655700683594 101.78607177734375" className="w-16 h-16 mx-auto">
    <g id="bird" fill="#4A9CA6">
      <path d="M77.8832 26.026C78.3666 19.2146 74.3957 12.8791 68.09 10.4029C61.7842 7.91926 54.6085 9.8675 50.3848 15.1991L47.3583 14.1507L44.2724 13.184L41.1492 12.3065C45.4175 4.96715 53.1138 0.334499 61.5463 0.0147496C69.9787 -0.297564 78.0097 3.75508 82.8059 10.7598L92.4281 11.4365L77.8832 26.026Z"></path>
      <path d="M84.9772 51.9928L84.9103 54.0972L84.7616 56.2016L84.5236 58.2837L84.1964 60.3435L83.78 62.4032L83.2818 64.4407L82.6944 66.4559L82.0177 68.4487L81.2592 70.397L80.4338 72.3229L79.4969 74.1819L78.5004 76.0409L77.4371 77.8404L76.2845 79.573L75.065 81.2833L73.7637 82.9267L72.4178 84.5031L70.9826 86.035L69.4805 87.4998L67.9413 88.9053L66.3351 90.2214L64.662 91.493L62.9442 92.6753L61.1819 93.7907L59.3601 94.8169L57.5159 95.7836L55.6272 96.661L53.6938 97.4493L51.7381 98.1483L49.7602 98.7803L47.7376 99.3083L45.715 99.7693L43.6477 100.119L41.6028 100.401L39.5207 100.58L37.4387 100.691H35.3714L33.2893 100.602L31.2073 100.424L29.14 100.163L27.0951 99.8139L25.0502 99.3752L23.0499 98.8472L21.0496 98.2524L19.7929 98.9513L18.4693 99.5685L17.1457 100.141L15.7775 100.624L14.387 101.019L12.9741 101.323L11.539 101.561L10.1038 101.718L8.64633 101.784L7.18887 101.762L5.75372 101.673L4.31856 101.472L2.88341 101.212L18.0529 85.9829C33.044 94.0287 51.4779 91.2848 63.5243 79.2087C75.5632 67.1325 78.3963 48.5499 70.5067 33.3878L77.8684 26.0038L78.9169 27.8331L79.8761 29.6921L80.7684 31.5734L81.5715 33.5217L82.2854 35.4922L82.9397 37.4851L83.4826 39.5002L83.9585 41.5377L84.3303 43.6198L84.6128 45.7019L84.8285 47.784L84.94 49.8661L84.9623 51.9705L84.9772 51.9928Z"></path>
      <path fillRule="evenodd" clipRule="evenodd" d="M36.3009 82.7781C53.4038 82.7781 67.2794 68.7909 67.2794 51.5318C67.2794 50.4685 67.2274 49.4126 67.1233 48.3715C66.7887 45.003 65.9187 41.7832 64.6025 38.8162L37.7733 65.5859L21.5404 49.3531C20.0829 47.8956 20.0829 45.531 21.5404 44.0735C22.9979 42.616 25.3625 42.616 26.82 44.0735L37.7807 55.0342L60.6539 32.213C57.1293 27.6993 52.3999 24.1895 46.9568 22.1744C46.927 22.1595 46.9047 22.1521 46.875 22.1446C46.4585 21.9959 46.0347 21.8472 45.6034 21.7059C45.5737 21.6985 45.5514 21.691 45.5216 21.6836C35.3565 18.2779 24.4776 16.4337 13.1823 16.4337C9.48659 16.4337 5.84293 16.6345 2.25132 17.0212C0.912839 20.8284 0.191544 24.9183 0.191544 29.1865C0.191544 36.169 2.13235 42.683 5.50087 48.2302C5.3819 49.3159 5.32984 50.4164 5.32984 51.5318C5.32984 68.7909 19.2055 82.7781 36.3084 82.7781H36.3009Z"></path>
    </g>
  </svg>
);

interface DashboardAssessment {
  assessment_id: string;
  assessment_name: string;
  description: string;
  order: number;
  type?: string;
  completed: boolean;
  unlocked: boolean;
}

export default function Dashboard() {
  const [assessments, setAssessments] = useState<DashboardAssessment[]>([]);
  const [loadingAssessments, setLoadingAssessments] = useState(true);
  const [loadingAssessment, setLoadingAssessment] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasGeminiApiKey, setHasGeminiApiKey] = useState(false);
  const { initiateAssessment, fetchQuestions } = useS3Upload();
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Debug function for development
  const handleClearCache = () => {
    if (process.env.NODE_ENV === 'development') {
      S3Service.clearCompletionCache();
      refreshAssessmentStates();
      toast({
        title: "Cache Cleared",
        description: "Completion cache has been cleared for debugging.",
      });
    }
  };

  // Check for Gemini API key
  useEffect(() => {
    const checkApiKey = () => {
      const savedKey = localStorage.getItem('gemini_api_key');
      setHasGeminiApiKey(!!savedKey);
    };
    
    checkApiKey();
    
    // Listen for storage changes to update the state when API key is saved
    const handleStorageChange = () => {
      checkApiKey();
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Fetch assessments on component mount (wait for auth to complete)
  useEffect(() => {
    const fetchAssessments = async () => {
      // Don't fetch if auth is still loading
      if (authLoading) {
        
        return;
      }

      // Don't fetch if no user email
      if (!user?.email) {
        
        setLoadingAssessments(false);
        return;
      }

      try {
        setError(null);
        
        
        const fetchedAssessments = await S3Service.getAssessments();
        const dashboardAssessments: DashboardAssessment[] = [];
        
        // Process each assessment to determine completed and unlocked status
        for (const assessment of fetchedAssessments) {
          // Skip Sales AI assessment from API since we hardcode it
          if (assessment.type === 'SalesAI') continue;
          
          const completed = S3Service.isAssessmentCompleted(user.email, assessment.assessment_id);
          const unlocked = await S3Service.isAssessmentUnlocked(user.email, assessment.assessment_id);
          
          
          
          dashboardAssessments.push({
            ...assessment,
            completed,
            unlocked,
          });
        }
        
        // Sort assessments by order
        const finalAssessments = dashboardAssessments.sort((a, b) => a.order - b.order);
        
        setAssessments(finalAssessments);
        
      } catch (error) {
        console.error('❌ Failed to fetch assessments:', error);
        setError('Failed to load assessments. Please try again later.');
        
        // On error, show empty array
        setAssessments([]);
        
        toast({
          title: "Error",
          description: "Failed to load assessments. Please refresh the page.",
          variant: "destructive",
        });
      } finally {
        setLoadingAssessments(false);
      }
    };

    fetchAssessments();
  }, [toast, user?.email, authLoading]);

  // Function to refresh assessment states (completion and unlock status)
  const refreshAssessmentStates = async () => {
    if (!user?.email) return;
    
    try {
      
      const fetchedAssessments = await S3Service.getAssessments();
      const dashboardAssessments: DashboardAssessment[] = [];
      
      // Process each assessment to determine completed and unlocked status
      for (const assessment of fetchedAssessments) {
        // Skip Sales AI assessment from API since we hardcode it
        if (assessment.type === 'SalesAI') continue;
        
        const completed = S3Service.isAssessmentCompleted(user.email, assessment.assessment_id);
        const unlocked = await S3Service.isAssessmentUnlocked(user.email, assessment.assessment_id);
        
        dashboardAssessments.push({
          ...assessment,
          completed,
          unlocked,
        });
      }
      
      // Sort assessments by order
      const finalAssessments = dashboardAssessments.sort((a, b) => a.order - b.order);
      
      setAssessments(finalAssessments);
      
    } catch (error) {
      console.error('❌ Error refreshing assessment states:', error);
    }
  };



  const handleStartAssessment = async (assessmentId: string) => {
    if (!user?.email) {
      toast({
        title: "Authentication Required", 
        description: "Please ensure you are logged in to start the assessment.",
        variant: "destructive",
      });
      return;
    }

    // Check assessment type to determine routing
    const assessment = assessments.find(a => a.assessment_id === assessmentId);
    
    // Check if assessment is unlocked before proceeding (except for special types)
    if (assessment?.type !== 'Games-arena' && assessment?.type !== 'Conductor') {
      const isUnlocked = await S3Service.isAssessmentUnlocked(user.email, assessmentId);
      if (!isUnlocked) {
        toast({
          title: "Assessment Locked",
          description: "Please complete the previous assessments in order to unlock this one.",
          variant: "destructive",
        });
        return;
      }
    }
    if (assessment?.type === "Conductor") {
      // Route directly to conductor assessment (no need to fetch questions or S3 config)
      console.log('🎯 Starting conductor assessment (skipping questions fetch):', assessmentId);
      setLocation(`/conductor/${assessmentId}`);
      return;
    }
    if (assessment?.type === "triple-step" || assessment?.type === "Games-arena" || assessmentId === "sales-002") {
      // Route directly to triple-step assessment (no need to fetch questions or S3 config)
      console.log('🎯 Starting triple-step assessment (skipping questions fetch):', assessmentId);
      setLocation(`/triple-step/${assessmentId}`);
      return;
    }
    if (assessment?.type === "Games-arena") {
      // Check if Gemini API key is configured for Games-arena assessment
      if (!hasGeminiApiKey) {
        toast({
          title: "Configuration Required",
          description: "Please configure your Gemini API key in Settings before starting this assessment.",
          variant: "destructive",
        });
        setLocation('/settings');
        return;
      }
      // Games-arena follows standard workflow: fetch questions → initiate → rules page
      console.log('🎯 Starting Games-arena assessment (standard workflow):', assessmentId);
      // Continue to standard workflow below (no return here)
    }

    setLoadingAssessment(assessmentId);
    
    try {
      // Always show "Starting..." first
      
      
      // Step 1: Fetch questions first (this will check completion status)
      // Pass the actual assessment type (QA, triple-step, etc.) - NOT "Games-arena"
      console.log('📋 Fetching questions for assessment type:', assessment?.type);
      const questions = await fetchQuestions(assessmentId, assessment?.type);
      
      
      // Step 2: Then initiate assessment for S3 configuration (don't check completion here)
      
      const response = await initiateAssessment(assessmentId, 3600);
      
      if (response?.audio && response?.images_upload) {
        // Both API calls successful - proceed to rules page
        
        
        
        
        setLocation(`/rules/${assessmentId}`);
      } else {
        throw new Error('Invalid response from initiate assessment');
      }
    } catch (error) {
      console.error('❌ Error in assessment flow:', error);
      
      // Handle completion status from fetch-questions
      if (error instanceof Error && error.message.startsWith('ASSESSMENT_COMPLETED:')) {
        const completionDataStr = error.message.replace('ASSESSMENT_COMPLETED:', '');
        const completionData = JSON.parse(completionDataStr);
        
        
        
        // CRITICAL: Mark assessment as completed in S3Service cache
        if (user?.email) {
          S3Service.markAssessmentCompleted(user.email, assessmentId);
          
        }
        
        // Refresh all assessments to update unlock status
        await refreshAssessmentStates();
        
        toast({
          title: "Assessment Completed",
          description: completionData.message || "You have already completed this assessment.",
        });
        return;
      }
      
      // Handle other errors
      let errorMessage = "Failed to start assessment. Please try again.";
      if (error instanceof Error) {
        if (error.message.includes('fetch questions')) {
          errorMessage = "Failed to load assessment questions. Please try again.";
        } else if (error.message.includes('initiate assessment')) {
          errorMessage = "Failed to configure assessment. Please try again.";
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoadingAssessment(null);
    }
  };

  if (loadingAssessments) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-300">Loading assessments...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Alert className="mb-8 border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-red-800">
            {error}
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* Permissions Test Button */}
        <div className="flex justify-end">
          <PermissionsTest />
        </div>
        
        <div className="text-center">
          
           <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">




             Choose an assessment to begin your evaluation. 

          </p>
        </div>
        <br></br>
        <br></br>

        {/* Horizontal scrollable container with navigation */}
        <div className="relative">
          <div className="overflow-x-auto pb-4" id="assessments-container">
            <div className="flex gap-6 min-w-max px-1">
               {assessments.map((assessment) => (
              <Card 
                 key={assessment.assessment_id}
                 className={`flex-shrink-0 w-72 h-[480px] shadow-sm transition-all duration-200 overflow-hidden relative ${
                   assessment.completed 
                     ? 'border-green-200 bg-green-50 dark:bg-green-900/20' 
                     : assessment.unlocked
                     ? 'border-gray-200 dark:border-gray-700 hover:border-teal-300 hover:shadow-md cursor-pointer'
                     : 'border-gray-300 bg-gray-50 dark:bg-gray-800'
                }`}
                onClick={() => assessment.unlocked && !assessment.completed && handleStartAssessment(assessment.assessment_id)}
              >
                <CardContent className="p-8 h-full flex flex-col justify-between relative">
                   {/* Locked State Overlay */}
                   {!assessment.unlocked && (
                     <div className="absolute inset-0 bg-white/90 dark:bg-gray-700/90 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center z-10">
                       <div className="w-16 h-16 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center mb-4">
                         <Lock className="w-8 h-8 text-gray-600 dark:text-gray-300" />
                       </div>
                       <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2">Unlock this</h3>
                       <p className="text-sm text-gray-600 dark:text-gray-300 text-center px-4">
                         by completing the previous assessment
                       </p>
                     </div>
                   )}

                   {/* Status overlay */}
                   {assessment.completed && (
                     <div className="absolute top-4 right-4 z-20">
                       <CheckCircle className="w-6 h-6 text-green-500" />
                     </div>
                   )}
                  
                  <div className={assessment.unlocked ? '' : 'blur-sm'}>
                    {/* Icon Section */}
                    <div className="bg-gray-100 dark:bg-custom-dark-2 rounded-lg p-6 mb-6 flex items-center justify-center">
                       <SparrowLogo />
                    </div>
                    
                    {/* Content Section */}
                     <h3 className={`text-xl font-semibold mb-4 ${
                       assessment.unlocked 
                         ? 'text-gray-900 dark:text-white' 
                         : 'text-gray-500 dark:text-gray-400'
                     }`}>
                       {assessment.assessment_name}
                    </h3>
                     <p className={`text-sm leading-relaxed mb-4 ${
                       assessment.unlocked 
                         ? 'text-gray-600 dark:text-gray-300' 
                         : 'text-gray-400 dark:text-gray-500'
                     }`}>
                      {assessment.description}
                    </p>
                    
                    {/* Configuration status for Sales AI */}
                    {assessment.type === 'SalesAI' && (
                      <div className={`flex items-center gap-2 mb-4 p-2 rounded-md ${
                        hasGeminiApiKey 
                          ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' 
                          : 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300'
                      }`}>
                        {hasGeminiApiKey ? (
                          <>
                            <CheckCircle className="h-3 w-3" />
                            <span className="text-xs">API key configured</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-3 w-3" />
                            <span className="text-xs">Requires API key setup</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Button Section */}
                  <div className={assessment.unlocked ? '' : 'blur-sm'}>
                    {assessment.completed ? (
                      <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                        <CheckCircle className="h-4 w-4" />
                        Assessment Completed
                      </div>
                    ) : assessment.unlocked ? (
                      <Button
                        onClick={() => handleStartAssessment(assessment.assessment_id)}
                        disabled={loadingAssessment === assessment.assessment_id}
                        className="group relative overflow-hidden w-full" 
                        size="lg"
                      >
                        {loadingAssessment === assessment.assessment_id ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Starting...
                          </>
                        ) : (
                          <>
                            <span className="mr-8 transition-opacity duration-500 group-hover:opacity-0">
                              Start Now
                            </span>
                            <i className="absolute right-1 top-1 bottom-1 rounded-sm z-10 grid w-1/4 place-items-center transition-all duration-500 bg-primary-foreground/15 group-hover:w-[calc(100%-0.5rem)] group-active:scale-95">
                              <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
                            </i>
                          </>
                        )}
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-sm">
                        <Lock className="h-4 w-4" />
                        Complete previous assessments to unlock
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {/* Right arrow indicator */}
          {assessments.length > 2 && (
            <div className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10">
              <Button
                variant="outline"
                size="sm"
                className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-lg border-gray-200 dark:border-gray-600 hover:bg-white/95 dark:hover:bg-gray-700/95 text-gray-700 dark:text-gray-200"
                onClick={() => {
                  const container = document.getElementById('assessments-container');
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
      </div>

        {assessments.length === 0 && !loadingAssessments && (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-300">No assessments available at the moment.</p>
          </div>
        )}
      </div>
    </main>
  );
}
