import { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCameraCapture } from '@/hooks/useCameraCapture';
import { useAudioRecording } from '@/hooks/useAudioRecording';
import { useAssessment } from '@/contexts/AssessmentContext';
import { S3Service, Assessment } from '@/lib/s3Service';
import { Home, Loader2 } from 'lucide-react';
import { useClarity } from '@/hooks/useClarity';
import { fetchGeminiApiKey, validateGeminiApiKey } from '@/services/geminiApiService';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export default function Rules() {
  const [, params] = useRoute('/rules/:assessmentId');
  const [, setLocation] = useLocation();
  const [cameraPermission, setCameraPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [microphonePermission, setMicrophonePermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [validatingApiKey, setValidatingApiKey] = useState(false);
  
  // Microsoft Clarity tracking
  const { trackUserAction, setUserId, setTag } = useClarity(true, 'Rules');
  
  const { startCamera, hasPermission: hasCameraPermission } = useCameraCapture();
  const { startRecording } = useAudioRecording();
  const { startSession } = useAssessment();
  const { user } = useAuth();
  const { toast } = useToast();

  const requestPermissions = async () => {
    try {
      // Request camera permission
      await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraPermission('granted');
    } catch {
      setCameraPermission('denied');
    }

    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicrophonePermission('granted');
    } catch {
      setMicrophonePermission('denied');
    }
  };

  const startAssessment = async () => {
    if (cameraPermission !== 'granted' || microphonePermission !== 'granted') {
      return;
    }

    // SPECIAL VALIDATION: Check API key for Games-arena assessments
    if (assessment?.type === "Games-arena") {
      console.log('🎯 Rules page - Games-arena assessment detected - validating API key...');
      setValidatingApiKey(true);

      try {
        // Fetch the actual API key from backend
        const apiKey = await fetchGeminiApiKey(user?.email || '');
        if (!apiKey) {
          console.log('🚫 Rules page - Games-arena API key not found');

          toast({
            title: "API Key Required",
            description: "Please configure your Gemini API key in Settings to access Games-arena assessments.",
            variant: "destructive",
          });

          // Open settings modal instead of starting assessment
          window.dispatchEvent(new Event('open-settings-modal'));
          setValidatingApiKey(false);
          return;
        }

        // Validate that the API key actually works by making a test call
        console.log('🔗 Rules page - Testing Games-arena API key validity...');
        const isValid = await validateGeminiApiKey(apiKey);

        if (!isValid) {
          console.log('🚫 Rules page - Games-arena API key validation failed');

          toast({
            title: "Invalid API Key",
            description: "Your Gemini API key is not working. Please check your API key in Settings and try again.",
            variant: "destructive",
          });

          // Open settings modal instead of starting assessment
          window.dispatchEvent(new Event('open-settings-modal'));
          setValidatingApiKey(false);
          return;
        }

        console.log('✅ Rules page - Games-arena API key validation successful - proceeding to assessment');
        setValidatingApiKey(false);

      } catch (error) {
        console.error('❌ Rules page - Error validating Games-arena API key:', error);

        toast({
          title: "Validation Error",
          description: "Unable to validate your Gemini API key. Please try again or check your settings.",
          variant: "destructive",
        });

        // Open settings modal instead of starting assessment
        window.dispatchEvent(new Event('open-settings-modal'));
        setValidatingApiKey(false);
        return;
      }
    }

    if (params?.assessmentId) {
      startSession(params.assessmentId);

      // Route based on assessment type
      if (assessment?.type === 'Games-arena') {
        // For Games-arena, go to the AI conversation page
        setLocation(`/sales-ai/${params.assessmentId}`);
      } else if (assessment?.type === 'Triple-Step') {
        // For Triple-Step, go to the triple-step assessment page
        setLocation(`/triple-step/${params.assessmentId}`);
      } else {
        // For all other types, use standard assessment flow
        setLocation(`/assessment/${params.assessmentId}`);
      }
    }
  };

  useEffect(() => {
    requestPermissions();
    
    // Fetch assessment data from test-specific endpoint
    const fetchAssessmentData = async () => {
      if (!params?.assessmentId) return;
      
      try {
        setLoading(true);
        
        // Get the current test_id from localStorage (set by Dashboard)
        const selectedTestId = localStorage.getItem('selectedTestId');
        if (!selectedTestId) {
          console.error('❌ No test selected - cannot fetch assessment data');
          return;
        }
        
        // Fetch test-specific assessments
        console.log('🔍 Rules: Fetching test assessments with Firebase auth');
        
        const { AuthenticatedApiService } = await import('@/lib/authenticatedApiService');
        const data = await AuthenticatedApiService.getTestAssessments(selectedTestId);
        console.log('📋 Rules page fetched test assessments:', data);
        
        // Find the current assessment within this test
        const currentAssessment = data.assessments?.find((a: any) => a.assessment_id === params.assessmentId);
        
        if (currentAssessment) {
          // Convert TestAssessment to Assessment format
          const assessmentData = {
            assessment_id: currentAssessment.assessment_id,
            assessment_name: currentAssessment.assessment_name,
            description: currentAssessment.description,
            type: currentAssessment.type,
            order: currentAssessment.order,
          };
          setAssessment(assessmentData);
          console.log('✅ Found assessment in test:', assessmentData);
        } else {
          console.error(`❌ Assessment ${params.assessmentId} not found in test ${selectedTestId}`);
          setAssessment(null);
        }
      } catch (error) {
        console.error('❌ Error fetching assessment data:', error);
        setAssessment(null);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAssessmentData();
  }, [params?.assessmentId]);

  const getPermissionStatus = (permission: string) => {
    switch (permission) {
      case 'granted':
        return { color: 'bg-green-500', text: 'Granted', textColor: 'text-green-600 dark:text-green-400' };
      case 'denied':
        return { color: 'bg-red-500', text: 'Denied', textColor: 'text-red-600 dark:text-red-400' };
      default:
        return { color: 'bg-yellow-500', text: 'Pending', textColor: 'text-yellow-600 dark:text-yellow-400' };
    }
  };

  const cameraStatus = getPermissionStatus(cameraPermission);
  const microphoneStatus = getPermissionStatus(microphonePermission);

  // Get rules based on assessment type
  const getRulesContent = () => {
    if (assessment?.type === 'Games-arena') {
      return [
        'This is a live conversation with an AI prospect for 5 minutes maximum',
        'Your camera and microphone will be recorded throughout the conversation',
        'The AI will act as a prospect evaluating competitive solutions',
        'Focus on highlighting unique selling points and handling objections',
        'Do not close the browser window during the assessment',
        'Your conversation will be analyzed for competitive handling skills'
      ];
    } else {
      return [
        'Answer questions clearly and concisely',
        'Your camera and microphone will be recorded throughout the assessment',
        'You have a time limit for each question',
        'Speak clearly and maintain good eye contact with the camera',
        'Do not close the browser window during the assessment',
        'Your responses will be analyzed for assessment scoring'
      ];
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* Home Button */}
        <div className="flex justify-start">
          <Button
            onClick={() => setLocation('/test-selection')}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            Home
          </Button>
        </div>

        <div className="text-center">
          <h2 className="text-3xl font-semibold text-gray-900 dark:text-white mb-2">
            {loading ? 'Loading...' : assessment?.assessment_name || 'Assessment'}
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            {loading ? '' : assessment?.description || 'Assessment description'}
          </p>
        </div>

        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="border border-gray-200 dark:border-elevated">
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Required Permissions
              </h3>
              
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-custom-dark-2 rounded-lg mb-3">
                <div className="flex items-center">
                  <div className={`w-3 h-3 ${cameraStatus.color} rounded-full mr-3`}></div>
                  <span className="text-gray-900 dark:text-white">Camera Access</span>
                </div>
                <span className={`text-sm ${cameraStatus.textColor}`}>
                  {cameraStatus.text}
                </span>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-custom-dark-2 rounded-lg mb-4">
                <div className="flex items-center">
                  <div className={`w-3 h-3 ${microphoneStatus.color} rounded-full mr-3`}></div>
                  <span className="text-gray-900 dark:text-white">Microphone Access</span>
                </div>
                <span className={`text-sm ${microphoneStatus.textColor}`}>
                  {microphoneStatus.text}
                </span>
              </div>

              <Button 
                onClick={requestPermissions}
                className="w-full bg-gray-200 dark:bg-custom-dark-2 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-custom-dark-3"
              >
                Test Permissions
              </Button>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 dark:border-elevated">
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Assessment Rules
              </h3>
              <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                {getRulesContent().map((rule, index) => (
                  <div key={index} className="flex items-start">
                    <span className="w-2 h-2 bg-teal-primary rounded-full mt-2 mr-3 flex-shrink-0"></span>
                    <span>{rule}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <Button
            onClick={startAssessment}
            disabled={cameraPermission !== 'granted' || microphonePermission !== 'granted' || validatingApiKey}
            className="bg-teal-primary text-white py-4 px-8 rounded-lg font-semibold text-lg hover:bg-teal-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-dark-primary disabled:bg-gray-400"
          >
            {validatingApiKey ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Validating API Key...
              </>
            ) : (
              'Start Assessment'
            )}
          </Button>
        </div>
      </div>
    </main>
  );
}
