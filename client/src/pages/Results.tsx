import { useEffect, useState } from 'react';
import { useRoute, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowRight, Home, Volume2, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { S3Service, Assessment } from '@/lib/s3Service';
import { useAuth } from '@/hooks/useAuth';
import { useS3Upload } from '@/hooks/useS3Upload';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export default function Results() {
  const [, params] = useRoute('/results/:assessmentId');
  const [nextAssessment, setNextAssessment] = useState<Assessment | null>(null);
  const [loadingNext, setLoadingNext] = useState(true);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(true);
  const [audioError, setAudioError] = useState(false);
  const [activeTabId, setActiveTabId] = useState<number | null>(1);
  const { toast } = useToast();
  const { user } = useAuth();
  const { getAudioDownloadUrl } = useS3Upload();

  useEffect(() => {
    const initializeResults = async () => {
      // Mark assessment as completed in cache
      if (params?.assessmentId && user?.email) {
        console.log('📝 Marking assessment as completed:', params.assessmentId);
        S3Service.markAssessmentCompleted(user.email, params.assessmentId);
      }
      
      // Check for next unlocked assessment
      if (params?.assessmentId && user?.email) {
        try {
          setLoadingNext(true);
          const next = await S3Service.getNextUnlockedAssessment(user.email);
          setNextAssessment(next);
          
          if (next) {
            console.log('➡️ Next unlocked assessment available:', next.assessment_name);
          } else {
            console.log('✅ No more unlocked assessments available');
        }
      } catch (error) {
          console.error('❌ Error getting next unlocked assessment:', error);
          setNextAssessment(null);
        } finally {
          setLoadingNext(false);
      }
      }

      // Fetch audio download URL
      if (params?.assessmentId && user?.email) {
        try {
          setLoadingAudio(true);
          setAudioError(false);
          console.log('🎵 Fetching audio download URL for:', params.assessmentId);
          
          const audioDownloadUrl = await getAudioDownloadUrl(params.assessmentId);
          if (audioDownloadUrl) {
            setAudioUrl(audioDownloadUrl);
            console.log('✅ Audio download URL fetched successfully');
          } else {
            console.warn('⚠️ No audio download URL received');
            setAudioError(true);
          }
      } catch (error) {
          console.error('❌ Error fetching audio download URL:', error);
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
                      {loadingNext ? (
                        <div className="flex items-center py-4">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600"></div>
                          <span className="ml-3 text-muted-foreground">Checking for next assessment...</span>
                        </div>
                      ) : nextAssessment ? (
                        <div>
                          <h4 className="text-lg font-semibold text-foreground mb-3">
                            Ready for the Next Challenge?
                          </h4>
                          <p className="text-muted-foreground mb-4">
                            Great job! Your next assessment "{nextAssessment.assessment_name}" is now available.
                          </p>
                          <div className="flex items-center gap-3">
                            <Link to={`/rules/${nextAssessment.assessment_id}`}>
                              <Button className="bg-teal-600 hover:bg-teal-700 text-white">
                                Next Assessment
                                <ArrowRight className="ml-2 h-4 w-4" />
                              </Button>
                            </Link>
                            <Link to="/">
                              <Button variant="outline">
                                <Home className="mr-2 h-4 w-4" />
                                Home
                              </Button>
                            </Link>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <h4 className="text-lg font-semibold text-foreground mb-3">
                            🎉 Congratulations!
                          </h4>
                          <p className="text-muted-foreground mb-4">
                            You have completed all available assessments. Well done!
                          </p>
                          <Link to="/">
                            <Button className="bg-teal-600 hover:bg-teal-700 text-white">
                              <Home className="mr-2 h-4 w-4" />
                              Return to Dashboard
                            </Button>
                          </Link>
                        </div>
                      )}
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
                          <p className="text-red-600 dark:text-red-400 text-sm">
                            Audio recording is being processed and will be available shortly.
                          </p>
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
                    <p className="text-red-600 dark:text-red-400 text-sm">
                      Audio recording is being processed and will be available shortly.
                    </p>
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
