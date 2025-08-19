import { useEffect, useState } from 'react';
import { useRoute, Link } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowRight, Home } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { S3Service, Assessment } from '@/lib/s3Service';
import { useAuth } from '@/hooks/useAuth';

export default function Results() {
  const [, params] = useRoute('/results/:assessmentId');
  const [nextAssessment, setNextAssessment] = useState<Assessment | null>(null);
  const [loadingNext, setLoadingNext] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

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
      
      toast({
        title: "Assessment Complete",
        description: "Your assessment has been submitted successfully.",
      });
    };

    initializeResults();
  }, [toast, params?.assessmentId, user?.email]);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-semibold text-gray-900 dark:text-white mb-2">
            Assessment Complete
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Thank you for completing the assessment. Your responses have been submitted successfully.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <Card className="bg-white dark:bg-dark-secondary border border-gray-200 dark:border-gray-700">
            <CardContent className="p-8 text-center">
              <div className="flex justify-center mb-6">
                <CheckCircle className="h-16 w-16 text-green-500" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                Assessment Submitted Successfully
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Your responses have been recorded and submitted. 
                Our team will review your submission and get back to you soon.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="text-center space-y-4">
          {loadingNext ? (
            <Button disabled className="bg-gray-400 text-white py-3 px-6 rounded-lg font-medium">
              Loading...
            </Button>
          ) : nextAssessment ? (
            <div className="space-y-4">
              <p className="text-gray-600 dark:text-gray-300">
                Ready for the next challenge?
              </p>
              <Link href={`/rules/${nextAssessment.assessment_id}`}>
                <Button className="bg-teal-primary text-white py-3 px-6 rounded-lg font-medium hover:bg-teal-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-dark-primary">
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Next Assessment: {nextAssessment.assessment_name}
                </Button>
              </Link>
              <div>
                <Link href="/">
                  <Button variant="outline" className="mt-2">
                    <Home className="mr-2 h-4 w-4" />
                    Return to Dashboard
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-green-600 dark:text-green-300 font-medium">
                🎉 Congratulations! You've completed all assessments!
              </p>
              <Link href="/">
                <Button className="bg-teal-primary text-white py-3 px-6 rounded-lg font-medium hover:bg-teal-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-dark-primary">
                  <Home className="mr-2 h-4 w-4" />
                  Return to Dashboard
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
