import { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCameraCapture } from '@/hooks/useCameraCapture';
import { useAudioRecording } from '@/hooks/useAudioRecording';
import { useAssessment } from '@/contexts/AssessmentContext';
import { Home } from 'lucide-react';

export default function Rules() {
  const [, params] = useRoute('/rules/:assessmentId');
  const [, setLocation] = useLocation();
  const [cameraPermission, setCameraPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [microphonePermission, setMicrophonePermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  
  const { startCamera, hasPermission: hasCameraPermission } = useCameraCapture();
  const { startRecording } = useAudioRecording();
  const { startSession } = useAssessment();

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

    if (params?.assessmentId) {
      startSession(params.assessmentId);
    }
    // Navigate to the new single-page assessment
    setLocation(`/assessment/${params?.assessmentId}`);
  };

  useEffect(() => {
    requestPermissions();
  }, []);

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

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* Home Button */}
        <div className="flex justify-start">
          <Button
            onClick={() => setLocation('/')}
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
            Assessment Permissions & Rules
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Please review the following requirements before starting
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
                <div className="flex items-start">
                  <span className="w-2 h-2 bg-teal-primary rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span>Each question has a 60-second time limit</span>
                </div>
                <div className="flex items-start">
                  <span className="w-2 h-2 bg-teal-primary rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span>Your camera and microphone will be recorded throughout the assessment</span>
                </div>
                <div className="flex items-start">
                  <span className="w-2 h-2 bg-teal-primary rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span>Do not close the browser window or navigate away from the page during the assessment</span>
                </div>
                <div className="flex items-start">
                  <span className="w-2 h-2 bg-teal-primary rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span>Once you start the assessment, you should not stop or refresh the page until the assessment is complete</span>
                </div>
                <div className="flex items-start">
                  <span className="w-2 h-2 bg-teal-primary rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span>You can proceed to the next question manually or wait for auto-advance</span>
                </div>
                <div className="flex items-start">
                  <span className="w-2 h-2 bg-teal-primary rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span>Live transcript of your responses will be displayed</span>
                </div>
                <div className="flex items-start">
                  <span className="w-2 h-2 bg-teal-primary rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span>Each assessment contains questions ranging from 3 to 15</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <Button 
            onClick={startAssessment}
            disabled={cameraPermission !== 'granted' || microphonePermission !== 'granted'}
            className="bg-teal-primary text-white py-4 px-8 rounded-lg font-semibold text-lg hover:bg-teal-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-dark-primary disabled:bg-gray-400"
          >
            Start Assessment
          </Button>
        </div>
      </div>
    </main>
  );
}
