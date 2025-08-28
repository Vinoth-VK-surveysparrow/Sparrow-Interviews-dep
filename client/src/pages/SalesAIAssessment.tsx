import React, { useState, useEffect, useRef } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Home, Mic, MicOff, Square, Settings as SettingsIcon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { LiveAPIProvider, useLiveAPIContext } from '@/contexts/LiveAPIContext';
import { LiveConfig } from '@/multimodal-live-types';
import { AudioRecorder } from '@/lib/audio-recorder';
import AudioPulse from '@/components/AudioPulse';
import { S3Service, DynamoPrompt } from '@/lib/s3Service';
// import useRecording from '../hooks/useRecording';
import { DualAudioRecorder } from '@/utils/dualAudioRecording';
import { createAudioStorageApi } from '@/services/audioStorageApi';
import { AudioUploadService } from '@/lib/audioUploadService';
import { useCameraCapture } from '@/hooks/useCameraCapture';
import { useAssessmentLogger } from '@/hooks/useAssessmentLogger';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useBehaviorMonitoring } from '@/hooks/useBehaviorMonitoring';
import { WarningBadge } from '@/components/WarningBadge';
import { motion } from 'framer-motion';
import { useClarity } from '@/hooks/useClarity';


// Hardcoded base system configuration
const HARDCODED_BASE_CONFIG = {
  model: "models/gemini-2.0-flash-exp",
  generationConfig: {
    responseModalities: "audio" as const,
    speechConfig: {
      voiceConfig: { 
        prebuiltVoiceConfig: { 
          voiceName: "Puck" 
        } 
      },
    },
    // Add audio quality and completion settings
    candidateCount: 1,
    maxOutputTokens: 4096, // Increased for longer responses
    temperature: 0.5, // Slightly more natural variation
    topP: 0.95,
    topK: 40
  },
  systemInstruction: {
    parts: [] // Will be populated dynamically with cue card + video prompt
  }
};

// Default conversation starter prompt
const HARDCODED_CONVERSATION_STARTER = {
  text: "CONVERSATION INITIATION: When this conversation begins, act as a prospect who has just received a cold call. Start by reacting naturally as any prospect would - perhaps with a brief greeting, asking who's calling, or showing initial skepticism. Wait for the salesperson to introduce themselves and their company before fully engaging. Your initial response should be realistic and set the tone for a natural sales conversation.(only in english)"
};

// Hardcoded video enhancement prompt - for visual awareness only
const HARDCODED_VIDEO_PROMPT = {
  text: "VISUAL AWARENESS: I can see you through the video feed. I'll pay attention to your facial expressions, body language, and visual cues while we talk to make this interaction more natural and engaging. As a prospect evaluating your solution, I'll notice your professionalism, confidence, and how well you present yourself during our conversation."
};

// Helper function to convert DynamoDB prompt format to LiveConfig format
const convertDynamoPromptToLiveConfig = (dynamoPrompt: DynamoPrompt): LiveConfig => {
  const parts: Array<{ text: string }> = [];

  // Add conversation starter first
  parts.push(HARDCODED_CONVERSATION_STARTER);

  // Add dynamic prospect persona parts from backend (main character and behavior)
  if (dynamoPrompt.parts?.L) {
    dynamoPrompt.parts.L.forEach(part => {
      if (part.M?.text?.S) {
        parts.push({ text: part.M.text.S });
      }
    });
  }

  // Add video awareness prompt last
  parts.push(HARDCODED_VIDEO_PROMPT);

  return {
    ...HARDCODED_BASE_CONFIG,
    systemInstruction: {
      parts
    }
  };
};

interface SalesAIAssessmentContentProps {
  assessmentId: string;
}

// AI Robot SVG Component
const AIRobotIcon = () => (
  <svg width="80" height="80" viewBox="0 0 149 149" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M148.66 74.5009C148.66 115.493 115.429 148.724 74.4364 148.724C33.4439 148.724 0.212891 115.493 0.212891 74.5009C0.212891 33.5084 33.4439 0.277344 74.4364 0.277344C115.429 0.277344 148.66 33.5084 148.66 74.5009Z" fill="#7400F9"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M89.9216 75.9134C86.0908 77.4625 81.9558 78.4179 77.6309 78.6654C76.885 78.7081 76.1335 78.7298 75.377 78.7298C74.6204 78.7298 73.8689 78.7081 73.123 78.6654C68.7971 78.4178 64.6611 77.462 60.8296 75.9123C52.7888 72.6602 46.0887 66.7925 41.7871 59.3659C48.4919 47.7901 61.0238 40.002 75.377 40.002C89.7301 40.002 102.262 47.7901 108.967 59.3659C104.665 66.7934 97.9636 72.6615 89.9216 75.9134Z" fill="white"/>
    <path d="M60.8292 78.9257C59.9029 78.5511 58.9944 78.1417 58.1052 77.6992C55.2157 79.7321 52.773 82.2641 50.9336 85.1527C54.06 90.0627 58.9297 93.942 64.7737 96.0921C67.5585 97.1166 70.5645 97.7485 73.7085 97.9123H76.9849C80.1283 97.7486 85.6531 100.859 77.6305 108.707C83.4754 106.557 96.6331 90.0633 99.7599 85.1527C97.9257 82.2723 95.4917 79.7466 92.6129 77.7166C91.7341 78.1528 90.8363 78.5568 89.9212 78.9268C86.0905 80.4759 81.9554 81.4313 77.6305 81.6788C76.8847 81.7215 76.1331 81.7431 75.3766 81.7431C74.62 81.7431 73.8685 81.7215 73.1226 81.6788C68.7967 81.4312 64.6607 80.4754 60.8292 78.9257Z" fill="white"/>
    <rect x="59.1797" y="54.4121" width="32.465" height="11.5797" rx="5.78987" fill="#162550"/>
    <ellipse cx="84.364" cy="60.1386" rx="2.12568" ry="2.12295" fill="#04FED1"/>
    <ellipse cx="75.3464" cy="88.7011" rx="2.12568" ry="2.12295" fill="#162550"/>
    <ellipse cx="66.8444" cy="60.1386" rx="2.12568" ry="2.12295" fill="#04FED1"/>
    <ellipse cx="66.8444" cy="88.7011" rx="2.12568" ry="2.12295" fill="#162550"/>
    <ellipse cx="83.8503" cy="88.7011" rx="2.12568" ry="2.12295" fill="#162550"/>
  </svg>
);

const SalesAIAssessmentContent: React.FC<SalesAIAssessmentContentProps> = ({ assessmentId }) => {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Microsoft Clarity tracking
  const { trackAssessmentEvent, trackUserAction, setUserId, setTag } = useClarity(true, 'Sales AI Assessment');
  const { connected, connect, disconnect, volume, client, setConfig, showApiKeyError, audioStreamer } = useLiveAPIContext();
  const [audioRecorder] = useState(() => new AudioRecorder());
  const [inVolume, setInVolume] = useState(0);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const renderCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);
  const [promptConfig, setPromptConfig] = useState<LiveConfig | null>(null);
  const [loadingPrompt, setLoadingPrompt] = useState(true);
  const [conversationComplete, setConversationComplete] = useState(false);
  const dualRecorderRef = useRef<DualAudioRecorder | null>(null);
  const [recordedAudio, setRecordedAudio] = useState<{
    userAudio: Blob;
    aiAudio: Blob;
    mergedAudio?: Blob;
    stereoMerged?: Blob;
  } | null>(null);

  // Recording system (simplified for now)
  const [isRecordingActive, setIsRecordingActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Standard assessment workflow integration
  const { 
    session, 
    finishAssessment, 
    addTranscript, 
    startSession, 
    isS3Ready, 
    uploadAudioToS3,
    startQuestionLog,
    endQuestionLog,
    handleQuestionTransition
  } = useAssessment();
  
  const { 
    videoRef: cameraRef, 
    startCamera, 
    startAutoCapture, 
    stopAutoCapture, 
    capturedImages 
  } = useCameraCapture();
  
  const { isMonitoring, stopMonitoring, flagCount, showWarning, warningMessage } = useBehaviorMonitoring({
    enabled: true,
    delayBeforeStart: 25000, // Start monitoring after 15 seconds (when first image is captured)
    pollingInterval: 20000, // Check every 10 seconds
  });

  // Assessment timing
  const assessmentStartTimeRef = useRef<Date | null>(null);

  // Handle audio recording and streaming
  useEffect(() => {
    const onData = (base64: string) => {
      if (client && client.isConnected && client.isConnected()) {
        client.sendRealtimeInput([
          {
            mimeType: "audio/pcm;rate=16000",
            data: base64,
          },
        ]);
      }
      
      // Capture high-quality user PCM16 data for dual recorder
      if (dualRecorderRef.current) {
        try {
          // Convert base64 to ArrayBuffer for high-quality capture
          const binaryString = window.atob(base64);
          const arrayBuffer = new ArrayBuffer(binaryString.length);
          const uint8Array = new Uint8Array(arrayBuffer);
          for (let i = 0; i < binaryString.length; i++) {
            uint8Array[i] = binaryString.charCodeAt(i);
          }
          dualRecorderRef.current.captureUserPCM16(arrayBuffer);
        } catch (error) {
          console.warn('Failed to capture user PCM16 data:', error);
        }
      }
    };

    if (connected && audioRecorder) {
      audioRecorder.on("data", onData).on("volume", setInVolume).start();
    } else {
      audioRecorder.stop();
    }

    return () => {
      audioRecorder.off("data", onData).off("volume", setInVolume);
    };
  }, [connected, client, audioRecorder]);

  // Listen for model's audio output and save to recording
  useEffect(() => {
    if (!client) return;

    const handleAudio = (arrayBuffer: ArrayBuffer) => {
      setIsModelSpeaking(true);
      setTimeout(() => setIsModelSpeaking(false), 100);
      
      // Connect AI audio to dual recorder if available
      if (dualRecorderRef.current) {
        dualRecorderRef.current.connectAIAudioFromArrayBuffer(arrayBuffer);
      }
    };

    client.on("audio", handleAudio);
    return () => {
      client.off("audio", handleAudio);
    };
  }, [client]);

  // Start auto-capture when S3 is ready (like other assessments)
  useEffect(() => {
    if (isS3Ready && hasStarted) {
      console.log('📸 S3 ready, starting auto-capture for screenshots');
      startAutoCapture();
    }
  }, [isS3Ready, hasStarted]);

  // Handle video streaming (send frames to Gemini)
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = videoStream;
    }

    let timeoutId = -1;

    function sendVideoFrame() {
      const video = videoRef.current;
      const canvas = renderCanvasRef.current;

      if (!video || !canvas) return;

      const ctx = canvas.getContext("2d")!;
      canvas.width = video.videoWidth * 0.25;
      canvas.height = video.videoHeight * 0.25;
      
      if (canvas.width + canvas.height > 0) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL("image/jpeg", 1.0);
        const data = base64.slice(base64.indexOf(",") + 1);
        
        // Check if client is properly connected before sending video data
        if (client && client.isConnected && client.isConnected()) {
          client.sendRealtimeInput([{ mimeType: "image/jpeg", data }]);
        }
      }
      
      if (connected && hasStarted) {
        timeoutId = window.setTimeout(sendVideoFrame, 1000 / 0.5);
      }
    }

    if (connected && videoStream && hasStarted) {
      sendVideoFrame();
    }

    return () => {
      if (timeoutId !== -1) {
        clearTimeout(timeoutId);
      }
    };
  }, [connected, videoStream, client, hasStarted]);

  // Fetch dynamic prompt on component mount
  useEffect(() => {
    const fetchPrompt = async () => {
      if (!user?.email) return;
      
      try {
        setLoadingPrompt(true);
        
        // CRITICAL: Validate that this is a Games-arena assessment in the current test
        const selectedTestId = localStorage.getItem('selectedTestId');
        if (!selectedTestId) {
          console.error('❌ No test selected for Sales AI assessment');
          toast({
            title: "No Test Selected",
            description: "Please select a test first.",
            variant: "destructive",
          });
          setLocation('/test-selection');
          return;
        }

        // Validate assessment exists in current test and is Games-arena type
        const testResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/assessments/test/${selectedTestId}`);
        
        if (!testResponse.ok) {
          throw new Error(`Failed to fetch test assessments: ${testResponse.status} ${testResponse.statusText}`);
        }
        
        const testData = await testResponse.json();
        const testAssessments = testData.assessments || [];
        const assessmentInTest = testAssessments.find((a: any) => a.assessment_id === assessmentId);
        
        if (!assessmentInTest) {
          console.error(`❌ Assessment ${assessmentId} not found in test ${selectedTestId}`);
          toast({
            title: "Assessment Not Found",
            description: "This assessment is not available in the current test.",
            variant: "destructive",
          });
          setLocation('/');
          return;
        }

        if (assessmentInTest.type !== 'Games-arena') {
          console.error(`❌ Assessment ${assessmentId} is type ${assessmentInTest.type}, not Games-arena`);
          toast({
            title: "Invalid Assessment Type",
            description: "This page is only for Games-arena assessments.",
            variant: "destructive",
          });
          setLocation('/');
          return;
        }

        console.log(`✅ Games-arena assessment ${assessmentId} validated in test ${selectedTestId}`);
        
        // For Games-arena type, we need to handle the response differently
        // since it returns prompt data instead of questions
        const fetchResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/fetch-questions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_email: user.email,
            assessment_id: assessmentId,
            type: 'Games-arena'
          }),
        });

        if (!fetchResponse.ok) {
          throw new Error(`Failed to fetch prompt: ${fetchResponse.status} ${fetchResponse.statusText}`);
        }

        const data = await fetchResponse.json();
        console.log('Raw fetch response:', data);
        
        // Extract prompt from the content or questions field (for Games-arena type)
        const promptData = data?.content || data?.questions;
        if (promptData && promptData.parts?.L) {
          const dynamicConfig = convertDynamoPromptToLiveConfig(promptData);
          setPromptConfig(dynamicConfig);
          setConfig(dynamicConfig);
          console.log('Successfully configured dynamic prompt with', promptData.parts.L.length, 'parts');
        } else {
          // Fallback to base config with conversation starter and video prompt
          console.warn('No prompt found in response, using base config with conversation starter and video awareness');
          const fallbackConfig = {
            ...HARDCODED_BASE_CONFIG,
            systemInstruction: {
              parts: [HARDCODED_CONVERSATION_STARTER, HARDCODED_VIDEO_PROMPT]
            }
          };
          setPromptConfig(fallbackConfig);
          setConfig(fallbackConfig);
        }
      } catch (error) {
        console.error('Error fetching prompt:', error);
        toast({
          variant: 'destructive',
          title: 'Configuration Error',
          description: 'Failed to load assessment configuration. Using default settings.',
        });
        
        // Fallback to base config with conversation starter and video prompt
        const fallbackConfig = {
          ...HARDCODED_BASE_CONFIG,
          systemInstruction: {
            parts: [HARDCODED_CONVERSATION_STARTER, HARDCODED_VIDEO_PROMPT]
          }
        };
        setPromptConfig(fallbackConfig);
        setConfig(fallbackConfig);
      } finally {
        setLoadingPrompt(false);
      }
    };

    fetchPrompt();
  }, [assessmentId, user?.email, setConfig, toast]);

  // Timer effect
  useEffect(() => {
    if (hasStarted && timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && hasStarted) {
      // Auto-stop when time is up
      stopDualRecording();
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [hasStarted, timeLeft]);



  // Format time for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Start dual recording function
  const startDualRecording = async () => {
    try {
      console.log('🎙️ Starting dual recording system...');
      
      // Get user audio stream
      const userStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
        video: false 
      });

      // Initialize dual recorder
      if (!dualRecorderRef.current) {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        dualRecorderRef.current = new DualAudioRecorder();
      }

      // Start dual recording
      await dualRecorderRef.current.startDualRecording(userStream, new AudioContext());
      
      // Start recording session
      setIsRecordingActive(true);
      
      console.log('✅ Dual recording started successfully');
    } catch (error) {
      console.error('🚨 Error starting dual recording:', error);
      toast({
        variant: 'destructive',
        title: 'Recording Error',
        description: 'Failed to start recording. Please check your microphone permissions.',
      });
    }
  };

  // Stop dual recording function
  const stopDualRecording = async () => {
    try {
      console.log('🛑 Stopping dual recording...');
      
      if (dualRecorderRef.current) {
        const audioResult = await dualRecorderRef.current.stopDualRecording();
        
        // audioResult now contains: { userBlob, aiBlob, mixedBlob }
        // mixedBlob is the real-time conversation with proper timing
        
        // Also create a post-processed stereo merge for comparison
        const stereoMerged = await dualRecorderRef.current.mergeToStereo(
          audioResult.userBlob, 
          audioResult.aiBlob
        );
        
        setRecordedAudio({
          userAudio: audioResult.userBlob,
          aiAudio: audioResult.aiBlob,
          mergedAudio: audioResult.mixedBlob,  // Use real-time mixed conversation
          stereoMerged: stereoMerged           // Post-processed stereo version
        });
        
        // Upload conversation using standard S3 workflow
        if (user?.email && isS3Ready) {
          try {
            setIsUploading(true);
            console.log('📤 Uploading conversation audio to S3...');
            
            // Upload only the mixed conversation audio (as requested)
            await uploadAudioToS3(audioResult.mixedBlob);
            
            // Verify audio was actually uploaded before proceeding
            const audioVerified = await verifyAudioWithRetry();
            
            if (audioVerified) {
              console.log('✅ Audio verified successfully');
              // Finish assessment using standard workflow
              await finishAssessment();
              console.log('✅ Assessment completed successfully');
              
              // Navigate to results page like other assessments
              setTimeout(() => {
                setLocation(`/results/${assessmentId}`);
              }, 1000);
            } else {
              console.error('❌ Audio verification failed - audio may be lost');
              // Continue with finish even if verification fails
              await finishAssessment();
              
              // Navigate to results page
              setTimeout(() => {
                setLocation(`/results/${assessmentId}`);
              }, 1000);
            }
            
          } catch (uploadError) {
            console.error('❌ Audio upload failed:', uploadError);
            toast({
              variant: "destructive",
              title: "Upload Failed",
              description: "Failed to save recording. Assessment will still be marked complete.",
            });
            // Continue with finish even if upload fails
            await finishAssessment();
            
            // Navigate to results page
            setTimeout(() => {
              setLocation(`/results/${assessmentId}`);
            }, 1000);
          } finally {
            setIsUploading(false);
          }
        } else if (!isS3Ready) {
          console.warn('⚠️ S3 not ready, finishing assessment without upload');
          await finishAssessment();
          
          // Navigate to results page
          setTimeout(() => {
            setLocation(`/results/${assessmentId}`);
          }, 1000);
        }
        
        dualRecorderRef.current.cleanup();
        dualRecorderRef.current = null;
      }
      
      // End question logging (standard workflow)
      if (user?.email) {
        endQuestionLog(); // End the current question
        
        // Calculate assessment duration
        const duration = assessmentStartTimeRef.current 
          ? Math.round((Date.now() - assessmentStartTimeRef.current.getTime()) / 1000)
          : 300 - timeLeft;
          
        console.log('📝 Games-arena conversation completed, Duration:', duration, 'seconds');
      }

      // Stop screenshot capture
      stopAutoCapture();
      
      // End recording session
      setIsRecordingActive(false);
      setConversationComplete(true);
      
      console.log('✅ Dual recording stopped successfully');
    } catch (error) {
      console.error('🚨 Error stopping dual recording:', error);
      // Still set as complete even if there's an error
      setConversationComplete(true);
      setIsRecordingActive(false);
    }
  };

  // Audio verification with retry mechanism (like other assessments)
  const verifyAudioWithRetry = async (maxRetries = 3): Promise<boolean> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔍 Audio verification attempt ${attempt}/${maxRetries}`);
        
        const verificationResult = await S3Service.verifyAudio({
          user_email: user?.email || '',
          assessment_id: assessmentId
        });
        
        if (verificationResult?.data?.presence) {
          console.log('✅ Audio verification successful');
          return true;
        } else {
          console.warn(`⚠️ Audio verification attempt ${attempt} failed - no audio found`);
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s before retry
          }
        }
      } catch (error) {
        console.error(`❌ Audio verification attempt ${attempt} error:`, error);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s before retry
        }
      }
    }
    
    console.error('❌ Audio verification failed after all retries');
    return false;
  };

  // Calculate progress percentage
  const progressPercentage = ((300 - timeLeft) / 300) * 100;

  const handleStartClick = async () => {
    if (!hasStarted) {
      try {
        // Start standard assessment session
        if (user?.email && assessmentId) {
          await startSession(assessmentId);
          assessmentStartTimeRef.current = new Date();
          
          // Get prompt title from config for logging
          const promptTitle = promptConfig?.systemInstruction?.parts?.[1]?.text?.split('\n')[0] || 'Games Arena Assessment';
          startQuestionLog(promptTitle, assessmentId, 1);
        }

        // Get camera access for screenshots (standard workflow)
        await startCamera();

        // Get camera access for video streaming
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: false // Audio is handled separately by AudioRecorder
        });
        setVideoStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          console.log('📹 Video stream set up successfully:', {
            streamActive: stream.active,
            tracks: stream.getVideoTracks().length,
            videoElement: !!videoRef.current
          });
        }
        
        await connect();
        
        // Start dual recording
        await startDualRecording();
        
        setHasStarted(true);
        setTimeLeft(300); // Reset timer to 5 minutes
        
        toast({
          title: "Assessment Started",
          description: "You have 5 minutes to complete this conversation.",
        });
      } catch (error) {
        console.error('Error starting assessment:', error);
        if (error instanceof Error) {
          if (error.message === 'ASSESSMENT_ALREADY_COMPLETED') {
            console.log('🔄 Assessment already completed, redirecting to results...');
            toast({
              title: "Assessment Already Completed",
              description: "Redirecting to results page...",
            });
            setTimeout(() => {
              setLocation(`/results/${assessmentId}`);
            }, 1000);
            return;
          } else if (error.name === 'NotAllowedError') {
            toast({
              variant: 'destructive',
              title: 'Camera Access Denied',
              description: 'Please allow camera access in your browser settings and try again.',
            });
          } else if (error.name === 'NotFoundError') {
            toast({
              variant: 'destructive',
              title: 'No Camera Found',
              description: 'Please connect a camera to your device and try again.',
            });
          } else {
            toast({
              variant: 'destructive',
              title: 'Error',
              description: error.message,
            });
          }
        }
      }
    } else {
      // Stop the assessment and dual recording
      await disconnect();
      await stopDualRecording();
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        setVideoStream(null);
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      
      // Stop behavior monitoring
      stopMonitoring();
      
      setHasStarted(false);
      setTimeLeft(300); // Reset timer
      
      toast({
        title: "Assessment Ended",
        description: "Your session has been completed.",
      });
    }
  };

  const goHome = () => {
    setLocation('/dashboard');
  };



  // Show results page when conversation is complete - redirect to standard results page
  if (conversationComplete) {
    return null; // Component will navigate to results page after upload
  }

  // Show start interface before beginning assessment
  if (!hasStarted) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Home Button */}
          <div className="flex justify-start">
            <Button
              onClick={goHome}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              Back
            </Button>
          </div>

          <div className="text-center">
            <h2 className="text-3xl font-semibold text-gray-900 dark:text-white mb-2">
              Sales AI Assessment
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              {loadingPrompt ? "Loading assessment configuration..." : "Ready to start your conversation with the AI prospect?"}
            </p>
          </div>

          {/* Assessment Info Card */}
          <div className="max-w-2xl mx-auto">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-6">
              {loadingPrompt ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-600 dark:text-gray-300">Loading configuration...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <span className="text-purple-600 text-sm">🤖</span>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">AI Prospect Challenge</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Interactive conversation with an analytical prospect</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 text-sm">⏱️</span>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">Duration</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">5 minutes maximum</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-600 text-sm">🎯</span>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">Objective</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Handle competitive pressure and build trust</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Warning Badge */}
            <WarningBadge 
              show={showWarning} 
              message={warningMessage}
              className="mt-4"
            />
          </div>

          {/* Start Button */}
          <div className="text-center">
            <Button 
              onClick={handleStartClick}
              disabled={loadingPrompt}
              className="bg-blue-600 hover:bg-blue-700 text-white py-3 px-8 rounded-lg font-semibold text-lg disabled:bg-gray-400"
            >
              <Mic className="w-5 h-5 mr-2" />
              {loadingPrompt ? "Loading..." : "Start Assessment"}
            </Button>
          </div>
        </div>
      </main>
    );
  }

  // Stream page - shows when assessment is active
  return (
    <div className="video-assessment-area">
      {/* Hidden canvas for video processing */}
              <canvas style={{ display: "none" }} ref={renderCanvasRef} />
        
        {/* Hidden camera element for screenshot capture */}
        <video 
          ref={cameraRef} 
          autoPlay 
          playsInline 
          muted 
          style={{ display: "none" }}
          width={640}
          height={480}
        />
      
      {/* Timer - Top Center */}
      <div className="timer-container">
        <div className="circular-progress">
          <svg className="progress-ring" width="120" height="120">
            <circle
              className="progress-ring-circle-bg"
              stroke="#e5e7eb"
              strokeWidth="8"
              fill="transparent"
              r="52"
              cx="60"
              cy="60"
            />
            <circle
              className="progress-ring-circle"
              stroke="#6366f1"
              strokeWidth="8"
              fill="transparent"
              r="52"
              cx="60"
              cy="60"
              style={{
                strokeDasharray: `${2 * Math.PI * 52}`,
                strokeDashoffset: `${2 * Math.PI * 52 * (1 - progressPercentage / 100)}`,
                transform: 'rotate(-90deg)',
                transformOrigin: '50% 50%',
              }}
            />
          </svg>
          <div className="timer-text">
            <div className="time-remaining">{formatTime(timeLeft)}</div>
            <div className="timer-label">remaining</div>
          </div>
        </div>
      </div>

      {/* Video Section - AI Robot Left, User Camera Right */}
      <div className="video-containers">
        {/* AI Robot Container - Left */}
        <div className="video-participant">
          <div className="video-circle ai-circle">
            <div className="ai-robot-container">
              <AIRobotIcon />
              <div className="audio-pulse-container">
                <AudioPulse 
                  volume={volume} 
                  speaking={isModelSpeaking}
                />
              </div>
            </div>
          </div>
        </div>

        {/* User Camera Container - Right */}
        <div className="video-participant">
          <div className="video-box user-box">
            {videoStream ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="user-video"
                onLoadedMetadata={() => {
                  console.log('📹 Video metadata loaded');
                  if (videoRef.current) {
                    console.log('📹 Video dimensions:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
                  }
                }}
                onCanPlay={() => {
                  console.log('📹 Video can play');
                  // Ensure video plays even if autoplay fails
                  if (videoRef.current) {
                    videoRef.current.play().catch(e => console.warn('Video autoplay prevented:', e));
                  }
                }}
                onPlaying={() => {
                  console.log('📹 Video is playing');
                }}
                onError={(e) => {
                  console.error('📹 Video error:', e);
                }}
                style={{ backgroundColor: '#000' }} // Fallback background
              />
            ) : (
              <div className="camera-placeholder">
                <div className="camera-icon">📷</div>
                <span>Camera Off</span>
              </div>
            )}
          </div>
          <span className="participant-label">You</span>
        </div>
      </div>

      {/* Stop Button */}
      <button
        onClick={handleStartClick}
        className="stop-conversation-btn"
      >
        <Square className="w-4 h-4" />
        Stop the Convo
      </button>

      <style dangerouslySetInnerHTML={{
        __html: `
          .video-assessment-area {
            min-height: 100vh;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 2rem;
            position: relative;
          }

          .timer-container {
            position: absolute;
            top: 2rem;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10;
          }

          .circular-progress {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .progress-ring {
            filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1));
          }

          .progress-ring-circle {
            transition: stroke-dashoffset 0.3s ease;
          }

          .timer-text {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
          }

          .time-remaining {
            font-size: 1.25rem;
            font-weight: 700;
            color: #1f2937;
            line-height: 1;
          }

          .timer-label {
            font-size: 0.75rem;
            color: #6b7280;
            margin-top: 2px;
          }

          .video-containers {
            display: flex;
            gap: 4rem;
            align-items: center;
            justify-content: center;
            margin-bottom: 3rem;
            margin-top: 6rem;
          }

          .video-participant {
            display: flex;
            flex-direction: column;
            align-items: center;
          }

          .video-circle {
            width: 320px;
            height: 320px;
            border-radius: 50%;
            overflow: hidden;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .ai-circle {
            background: rgba(116, 75, 162, 0.8);
            backdrop-filter: blur(10px);
            border: 3px solid rgba(255, 255, 255, 0.3);
          }

          .video-box {
            width: 420px;
            height: 420px;
            border-radius: 16px;
            overflow: hidden;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .user-box {
            background: transparent;
            border: 3px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          }

          .ai-robot-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 1rem;
          }

          .audio-pulse-container {
            width: 100px;
            height: 40px;
          }

          .user-video {
            width: 100%;
            height: 100%;
            object-fit: cover;
            background: #000;
            border-radius: 16px;
            z-index: 1;
          }

          .camera-placeholder {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #fff;
            opacity: 0.7;
          }

          .camera-icon {
            font-size: 3rem;
            margin-bottom: 1rem;
          }

          .participant-label {
            margin-top: 1rem;
            font-weight: 500;
            color: #333;
            font-size: 1.1rem;
          }

          .stop-conversation-btn {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem 1.5rem;
            background: #2d2d2d;
            color: white;
            border: none;
            border-radius: 25px;
            font-weight: 500;
            font-size: 0.95rem;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
          }

          .stop-conversation-btn:hover {
            background: #1a1a1a;
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
          }

          .start-conversation-btn {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 1rem 2rem;
            background: #6366f1;
            color: white;
            border: none;
            border-radius: 30px;
            font-weight: 600;
            font-size: 1.1rem;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
          }

          .start-conversation-btn:hover {
            background: #4f46e5;
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
          }

          @media (max-width: 768px) {
            .video-containers {
              flex-direction: column;
              gap: 2rem;
            }

            .video-circle {
              width: 280px;
              height: 280px;
            }

            .video-box {
              width: 320px;
              height: 320px;
            }

            .video-assessment-area {
              padding: 1rem;
            }

            .timer-container {
              position: relative;
              top: auto;
              left: auto;
              transform: none;
              margin-bottom: 2rem;
            }
          }
        `
      }} />
    </div>
  );
};

export default function SalesAIAssessment() {
  const [, params] = useRoute('/sales-ai/:assessmentId');
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [apiKey, setApiKey] = useState<string>('');

  // Load API key from localStorage on component mount
  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
      setApiKey(savedKey);
    }
  }, []);

  if (!params?.assessmentId) {
    return <div>Invalid assessment ID</div>;
  }

  if (!apiKey) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              API Key Required
            </h2>
            <p className="text-gray-600 mb-6">
              A Gemini API key is required to use this assessment. 
              Please configure your API key in the settings.
            </p>
            <div className="flex justify-center gap-3">
              <Button 
                onClick={() => setLocation('/settings')}
                className="flex items-center gap-2"
              >
                <SettingsIcon className="w-4 h-4" />
                Go to Settings
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setLocation('/dashboard')}
                className="flex items-center gap-2"
              >
                <Home className="w-4 h-4" />
                Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <LiveAPIProvider apiKey={apiKey}>
      <SalesAIAssessmentContent assessmentId={params.assessmentId} />
    </LiveAPIProvider>
  );
}
