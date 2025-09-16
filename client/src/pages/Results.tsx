import { useEffect, useState } from 'react';
import { useRoute, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowRight, Home, Volume2, ChevronDown, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { S3Service, Assessment } from '@/lib/s3Service';
import { useAuth } from '@/hooks/useAuth';
import { useS3Upload } from '@/hooks/useS3Upload';
import { useClarity } from '@/hooks/useClarity';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export default function Results() {
  const [, params] = useRoute('/results/:assessmentId');
  const [nextAssessmentData, setNextAssessmentData] = useState<any>(null);
  const [loadingNext, setLoadingNext] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(true);
  const [audioError, setAudioError] = useState(false);
  const [audioRetryCount, setAudioRetryCount] = useState(0);
  const [activeTabId, setActiveTabId] = useState<number | null>(1);
  const [audioUploaded, setAudioUploaded] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { getAudioDownloadUrl } = useS3Upload();
  
  // Microsoft Clarity tracking
  const { trackPageView, trackUserAction, setUserId, setTag } = useClarity(true, 'Results');

  useEffect(() => {
    const initializeResults = async () => {
      // Only proceed if we have a user - this ensures auth is complete
      if (!user?.email) {
        console.log('⏳ Waiting for user authentication...');
        return;
      }

      // Mark assessment as completed in cache (this will automatically trigger the event)
      if (params?.assessmentId) {
        
        S3Service.markAssessmentCompleted(user.email, params.assessmentId);
      }
      
      // Audio will be marked as uploaded when successfully loaded

      // Fetch audio download URL
      if (params?.assessmentId) {
        try {
          setLoadingAudio(true);
          setAudioError(false);
          
          console.log('📥 Fetching audio download URL for assessment:', params.assessmentId);
          const audioDownloadUrl = await getAudioDownloadUrl(params.assessmentId);
          
          if (audioDownloadUrl) {
            console.log('✅ Audio download URL received:', audioDownloadUrl);
            setAudioUrl(audioDownloadUrl);
            setAudioUploaded(true); // Mark audio as uploaded when URL is successfully received
          } else {
            console.warn('⚠️ No audio download URL received - audio may still be processing');
            setAudioError(true);
            setAudioUploaded(false);
          }
        } catch (error) {
          console.error('❌ Error fetching audio download URL:', error);
          
          // Check if this is a 404 or other specific error that means audio doesn't exist yet
          if (error instanceof Error) {
            if (error.message.includes('404') || error.message.includes('Not Found')) {
              console.log('📝 Audio not found - may still be processing');
            } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
              console.log('🔒 Audio access forbidden - may be expired');
            }
          }
          
          setAudioError(true);
        } finally {
          setLoadingAudio(false);
        }
      }
      
      toast({
        title: "Assessment Complete",
        description: "Your assessment has been submitted successfully.",
      });
    };

    initializeResults();
  }, [toast, params?.assessmentId, user?.email, getAudioDownloadUrl]);

  // Function to fetch next assessment from API
  const fetchNextAssessment = async () => {
    if (!user?.email) {
      console.error('❌ fetchNextAssessment: No user email available');
      return null;
    }

    const selectedTestId = localStorage.getItem('selectedTestId');
    if (!selectedTestId) {
      console.error('❌ fetchNextAssessment: No test ID available');
      return null;
    }

    try {
      setLoadingNext(true);
      console.log('🚀 fetchNextAssessment: Calling API with:', {
        user_email: user.email,
        test_id: selectedTestId
      });

      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
      const response = await fetch(`${API_BASE_URL}/next-assessment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_email: user.email,
          test_id: selectedTestId
        })
      });

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        console.error('❌ Failed to fetch next assessment - Status:', response.status);
        const errorText = await response.text();
        console.error('❌ Error response:', errorText);
        return null;
      }

      const data = await response.json();
      console.log('✅ Next assessment response:', data);

      setNextAssessmentData(data);
      return data;
    } catch (error) {
      console.error('❌ Error fetching next assessment:', error);
      console.error('❌ Error details:', error instanceof Error ? error.message : String(error));
      return null;
    } finally {
      setLoadingNext(false);
    }
  };

  // Handle next assessment button click
  const handleNextAssessment = async () => {
    const data = await fetchNextAssessment();
    if (data?.next_assessment) {
      console.log('🎯 Routing to next assessment:', data.next_assessment.assessment_id);
      window.location.href = `/rules/${data.next_assessment.assessment_id}`;
    } else {
      console.log('✅ All assessments completed');
      toast({
        title: "All Assessments Completed! 🎉",
        description: "Congratulations! You've completed all assessments in this test.",
      });
    }
  };

  // Retry audio download if it failed and we haven't exceeded retry limit
  useEffect(() => {
    if (audioError && audioRetryCount < 3 && params?.assessmentId && user?.email) {
      const retryTimer = setTimeout(async () => {
        console.log(`🔄 Retrying audio download (attempt ${audioRetryCount + 1}/3)`);
        
        try {
          setLoadingAudio(true);
          setAudioError(false);
          
          const audioDownloadUrl = await getAudioDownloadUrl(params.assessmentId);
          
          if (audioDownloadUrl) {
            console.log('✅ Audio download URL received on retry:', audioDownloadUrl);
            setAudioUrl(audioDownloadUrl);
            setAudioUploaded(true); // Mark audio as uploaded on retry success
            setAudioRetryCount(0); // Reset retry count on success
          } else {
            setAudioRetryCount(prev => prev + 1);
            setAudioError(true);
            setAudioUploaded(false);
          }
        } catch (error) {
          console.error(`❌ Audio retry ${audioRetryCount + 1} failed:`, error);
          setAudioRetryCount(prev => prev + 1);
          setAudioError(true);
        } finally {
          setLoadingAudio(false);
        }
      }, 5000 * (audioRetryCount + 1)); // Exponential backoff: 5s, 10s, 15s

      return () => clearTimeout(retryTimer);
    }
  }, [audioError, audioRetryCount, params?.assessmentId, user?.email, getAudioDownloadUrl]);

  return (
    <section className="py-32">
      <div className="container mx-auto px-8">
        <div className="mb-12 flex w-full items-start justify-between gap-12 px-6">
          <div className="w-full md:w-1/2">
            <Accordion type="single" className="w-full" defaultValue="item-1">
              <AccordionItem value="item-1">
                <AccordionTrigger 
                  className="cursor-pointer py-5 !no-underline transition"
                  onClick={() => setActiveTabId(1)}
                >
                  <h6 className="text-2xl font-semibold text-foreground flex items-center gap-3">
                    <CheckCircle className="h-8 w-8 text-green-500" />
                    Assessment Complete
                  </h6>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="mt-6 space-y-6">
                    <p className="text-lg text-muted-foreground">
                      Thank you for completing the assessment. Your responses have been recorded and submitted successfully.
                    </p>
                    <p className="text-muted-foreground">
                      Our team will review your submission and get back to you soon. You can listen to your recorded responses using the audio player on the right.
                    </p>
                    
                    {/* Navigation Section */}
                    <div className="pt-6 border-t border-gray-200 dark:border-gray-600">
                      {/* Show Next Assessment button only when audio is uploaded and ready */}
                      {audioUploaded && !loadingAudio && !audioError && (
                        <div className="mb-4">
                          <div className="flex items-center gap-3">
                            <Button
                              onClick={handleNextAssessment}
                              disabled={loadingNext}
                              className="bg-teal-600 hover:bg-teal-700 text-white"
                            >
                              {loadingNext ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              ) : (
                                <>
                                  Next Assessment
                                  <ArrowRight className="ml-2 h-4 w-4" />
                                </>
                              )}
                            </Button>
                          </div>

                          {/* Show API response message */}
                          {nextAssessmentData && (
                            <div className="mt-3">
                              <p className="text-sm text-gray-600 dark:text-gray-300">
                                {nextAssessmentData.message}
                              </p>
                              {nextAssessmentData.next_assessment && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  Next: {nextAssessmentData.next_assessment.assessment_name}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Home and Dashboard buttons */}
                      <div className="flex gap-2">
                        <Link to="/">
                          <Button variant="outline">
                            <Home className="mr-2 h-4 w-4" />
                            Home
                          </Button>
                        </Link>
                        <Link to="/dashboard">
                          <Button variant="outline">
                            <Target className="mr-2 h-4 w-4" />
                            Rounds
                          </Button>
                        </Link>
                      </div>
                    </div>

                    {/* Mobile Audio Player */}
                    <div className="md:hidden pt-6 border-t border-gray-200 dark:border-gray-600">
                      <h4 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                        <Volume2 className="h-5 w-5" />
                        Your Assessment Recording
                      </h4>
                      
                      {loadingAudio ? (
                        <div className="flex items-center py-4">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600"></div>
                          <span className="ml-3 text-muted-foreground">Loading audio...</span>
                        </div>
                      ) : audioError ? (
                        <div className="py-4">
                          <p className="text-orange-600 dark:text-orange-400 text-sm">
                            {audioRetryCount < 3 
                              ? "Audio recording is being processed and will be available shortly..."
                              : "Audio recording is still being processed. Please refresh the page in a few minutes."
                            }
                          </p>
                          {audioRetryCount > 0 && audioRetryCount < 3 && (
                            <p className="text-xs text-gray-500 mt-1">
                              Retry {audioRetryCount}/3
                            </p>
                          )}
                        </div>
                                      ) : audioUrl ? (
                  <div className="w-full">
                    <audio 
                      controls 
                      className="w-full"
                      preload="metadata"
                    >
                      <source src={audioUrl} type="audio/webm" />
                      <source src={audioUrl} type="audio/mp4" />
                      Your browser does not support audio playback.
                    </audio>
                  </div>
                      ) : (
                        <div className="py-4">
                          <p className="text-muted-foreground text-sm">No audio recording available</p>
                        </div>
                      )}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
          
          {/* Audio Player Section - Right Side (Desktop) */}
          <div className="relative m-auto hidden w-1/2 overflow-hidden rounded-xl bg-muted md:block">
            <div className="aspect-[4/3] rounded-md p-6 flex flex-col items-center justify-center">
              <div className="w-full max-w-sm">
                <h4 className="text-lg font-semibold text-foreground mb-6 flex items-center justify-center gap-2">
                  <Volume2 className="h-5 w-5" />
                  Your Assessment Recording
                </h4>
                
                {loadingAudio ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                    <span className="ml-3 text-muted-foreground">Loading audio...</span>
                  </div>
                ) : audioError ? (
                  <div className="py-8 text-center">
                    <p className="text-orange-600 dark:text-orange-400 text-sm">
                      {audioRetryCount < 3 
                        ? "Audio recording is being processed and will be available shortly..."
                        : "Audio recording is still being processed. Please refresh the page in a few minutes."
                      }
                    </p>
                    {audioRetryCount > 0 && audioRetryCount < 3 && (
                      <p className="text-xs text-gray-500 mt-2">
                        Retry {audioRetryCount}/3
                      </p>
                    )}
                  </div>
                                       ) : audioUrl ? (
                         <div className="w-full">
                           <audio 
                             controls 
                             className="w-full"
                             preload="metadata"
                           >
                             <source src={audioUrl} type="audio/webm" />
                             <source src={audioUrl} type="audio/mp4" />
                             Your browser does not support audio playback.
                           </audio>
                         </div>
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-muted-foreground text-sm">No audio recording available</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
