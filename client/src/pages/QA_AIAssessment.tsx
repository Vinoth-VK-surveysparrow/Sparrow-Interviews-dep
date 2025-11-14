import React, { useState, useEffect, useRef } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Button, CircleLoader } from "@sparrowengg/twigs-react";
import { Home, Mic, MicOff, Square, Settings as SettingsIcon, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getVertexModel } from '@/services/vertexApiService';
import { tokenCache } from '@/services/vertexTokenService';
import { useToast } from '@/hooks/use-toast';
import { LiveAPIProvider, useLiveAPIContext } from '@/contexts/LiveAPIContext';
import { LiveConfig } from '@/multimodal-live-types';
import { AudioRecorder } from '@/lib/audio-recorder';
import { S3Service, Question } from '@/lib/s3Service';
import { DualAudioRecorder } from '@/utils/dualAudioRecording';
import { useCameraCapture } from '@/hooks/useCameraCapture';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useBehaviorMonitoring } from '@/hooks/useBehaviorMonitoring';
import { WarningBadge } from '@/components/WarningBadge';
import { motion } from 'framer-motion';
import { useClarity } from '@/hooks/useClarity';
import SecurityRestrictions from '@/components/SecurityRestrictions';
import { AssessmentSecurity } from '@/components/AssessmentSecurity';
import { NavigationBlocker } from '@/components/NavigationBlocker';

// Base configuration for QA-AI Interview
const createQAAIConfig = (questions: Question[], timeLimitSeconds: number): LiveConfig => {
  const questionsList = questions.map((q, idx) => `${idx + 1}. ${q.question_text}`).join('\n');
  const questionCount = questions.length;
  const totalMinutes = Math.floor(timeLimitSeconds / 60);
  
  const systemPrompt = `You are NOVA, an experienced AI interviewer conducting a professional interview with ${questionCount} questions.

YOUR QUESTION LIST (ask these in order, using exact wording):
${questionsList}
=== OPENING ===
Start the interview with:
"Hi, I'm Nova, and I'll be your interviewer today. I have ${questionCount} questions for you. Take your time with each one—we'll have a natural conversation. Let's begin."

Then ask the first question.

=== YOUR ROLE AS INTERVIEWER ===

You are a skilled professional interviewer. Your goal is to create a smooth, comfortable interview experience while gathering responses to all ${questionCount} questions.

You have the judgment and autonomy to:

Determine when a candidate has adequately answered a question

Provide brief, natural acknowledgments that maintain conversation flow

Transition smoothly between questions

Allow the candidate space to think and elaborate

=== CONVERSATION FLOW ===

ASK A QUESTION
Present each question naturally:

"Question [number]: [exact question text from list]"

Use a professional, warm tone

LISTEN ACTIVELY
As the candidate answers:

Give them space to think and formulate responses

Allow them to answer in multiple messages if needed

Recognize that pauses are normal—they may be thinking

ASSESS COMPLETION
Use your judgment to determine when an answer is complete. An answer is typically complete when:

The candidate has provided substantive content addressing the question

There's a natural pause after they've finished their thought

They signal completion (e.g., "I think that covers it", "Does that answer it?", "That's my experience")

Their response has reached a logical conclusion

Be patient—don't rush. But also don't wait indefinitely if they've clearly finished.

ACKNOWLEDGE BRIEFLY
When you judge the answer is complete, provide a brief, professional acknowledgment:

"Thank you."

"Got it, thank you."

"Understood."

"Thanks for that."

Keep acknowledgments SHORT (1-4 words). Do not elaborate or provide feedback.

TRANSITION SMOOTHLY
Move to the next question naturally:

"Let's move to the next question."

"Next question:"

"Moving on."

Simply state the next question number

REPEAT
Continue this pattern through all ${questionCount} questions.

=== CLOSING ===
After the final question is answered, say:
"Thank you! That completes our interview. You can now click 'End Interview' to submit your responses. Best of luck!"

=== CRITICAL BOUNDARIES ===

NEVER do the following (these are hallucination risks):

❌ Create, add, or modify questions beyond the ${questionsList} provided
❌ Ask follow-up questions that aren't in your list
❌ Provide feedback on answer quality ("That's a great answer!", "Excellent point!")
❌ Evaluate, critique, or correct the candidate's responses
❌ Share your opinions or engage in debate
❌ Provide hints, tips, or guidance on how to answer
❌ Say things like "You're doing great" or "Don't worry"
❌ Make up information about the role, company, or interview process
❌ Engage in casual conversation outside of the interview questions
❌ Probe deeper with additional questions not in your list
❌ Summarize or repeat back what they said
❌ Express agreement or disagreement with their views

ALWAYS maintain these standards:

✓ Ask questions exactly as written in ${questionsList}
✓ Use your judgment to determine answer completion
✓ Keep acknowledgments brief and neutral
✓ Maintain professional, warm tone
✓ Allow natural conversation flow
✓ Stay focused on progressing through your question list
✓ Be patient but efficient

=== EDGE CASES ===

If candidate asks to repeat the question:

"Of course. [Restate the current question]"

If candidate asks for clarification on a question:

"Please interpret it as you understand it and share your thoughts."

If candidate explicitly says "skip this" or "I don't know":

"Understood." → Move to next question

If candidate asks about interview details (timing, format, etc.):

"I'm here to ask the questions—please focus on providing your responses."

If candidate seems to be rambling or going off-topic:

Still wait for a natural pause, then acknowledge and move forward

Don't interrupt or redirect them

=== YOUR JUDGMENT FRAMEWORK ===

Good judgment means:

Recognizing when someone has finished their thought vs. still thinking

Balancing patience with efficiency

Reading natural conversation signals

Not being overly rigid or robotic

Creating a professional but human experience

Poor judgment means:

Cutting people off mid-thought

Waiting 5+ minutes when they've clearly finished

Being mechanical or abrupt

Adding questions or content beyond your scope

Trust your ability to read conversation flow. You're an experienced interviewer—act like one.

=== VALIDATION CHECKLIST ===

Before transitioning to a new question, verify:

Have they provided substantive content addressing the current question?

Is there a natural pause or completion signal?

Am I using a question from ${questionsList} exactly as written?

Am I keeping my acknowledgment brief and neutral?

=== EXECUTION ===
Begin now with your opening and first question.
`


  return {
    model: getVertexModel(),
    generationConfig: {
      responseModalities: "audio" as const,
      speechConfig: {
        voiceConfig: { 
          prebuiltVoiceConfig: { 
            voiceName: "Puck" 
          } 
        },
      },
    },
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    }
  };
};

interface QAAIAssessmentContentProps {
  assessmentId: string;
}

// Siri Orb Component (same as Sales AI)
interface SiriOrbProps {
  size?: string;
  isSpeaking?: boolean;
  className?: string;
  blurAmount?: number;
  contrastAmount?: number;
}

const SiriOrb: React.FC<SiriOrbProps> = ({ 
  size = '200px', 
  isSpeaking = false,
  className = '',
  blurAmount = 60,
  contrastAmount = 1.5
}) => {
  return (
    <div
      className={`siri-orb ${isSpeaking ? 'speaking' : 'idle'} ${className || ''}`}
      style={
        {
          width: size,
          height: size,
          '--blur-amount': `${blurAmount}px`,
          '--contrast-amount': contrastAmount,
        } as React.CSSProperties
      }
    />
  )
}

const QAAIAssessmentContent: React.FC<QAAIAssessmentContentProps> = ({ assessmentId }) => {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const { trackAssessmentEvent, setUserId } = useClarity(true, 'QA AI Interview');
  const { connected, connect, disconnect, client, setConfig } = useLiveAPIContext();
  const [audioRecorder] = useState(() => new AudioRecorder());
  const [inVolume, setInVolume] = useState(0);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const renderCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [timeLeft, setTimeLeft] = useState(300);
  const [assessmentTimeLimit, setAssessmentTimeLimit] = useState(300);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingPrompt, setLoadingPrompt] = useState(true);
  const [conversationComplete, setConversationComplete] = useState(false);
  const dualRecorderRef = useRef<DualAudioRecorder | null>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [stopButtonClicked, setStopButtonClicked] = useState(false);
  const [startButtonClicked, setStartButtonClicked] = useState(false);

  const assessmentStartTimeRef = useRef<Date | null>(null);
  const { 
    startSession, 
    isS3Ready,
    uploadAudioToS3,
    startQuestionLog,
    endQuestionLog,
    finishAssessment
  } = useAssessment();

  const { startCamera, startAutoCapture, stopAutoCapture } = useCameraCapture({ videoRef });
  const { stopMonitoring, showWarning, warningMessage } = useBehaviorMonitoring({
    enabled: true,
    delayBeforeStart: 25000,
    pollingInterval: 20000,
  });

  const progressPercentage = (timeLeft / assessmentTimeLimit) * 100;

  // Set userId for Clarity tracking
  useEffect(() => {
    if (user?.email) {
      setUserId(user?.email);
    }
  }, [user?.email, setUserId]);

  // Fetch questions and prepare config
  useEffect(() => {
    const fetchQuestionsData = async () => {
      if (!user?.email) return;

      try {
        setLoadingPrompt(true);
        
        const selectedTestId = localStorage.getItem('selectedTestId');
        if (!selectedTestId) {
          setLocation('/test-selection');
          return;
        }

        const { AuthenticatedApiService } = await import('@/lib/authenticatedApiService');
        const testData = await AuthenticatedApiService.getTestAssessments(selectedTestId);
        const testAssessments = testData.assessments || [];
        const assessmentInTest = testAssessments.find((a: any) => a.assessment_id === assessmentId);
        
        if (!assessmentInTest || assessmentInTest.type !== 'QA-AI') {
          toast({
            title: "Invalid Assessment",
            description: "This assessment is not available.",
            variant: "destructive",
          });
          setLocation('/');
          return;
        }
        
        const timeLimitFromBackend = assessmentInTest.time_limit || 300;
        setAssessmentTimeLimit(timeLimitFromBackend);
        setTimeLeft(timeLimitFromBackend);
        
        const questionsData = await S3Service.fetchQuestions({
          user_email: user.email,
          assessment_id: assessmentId,
          type: 'QA-AI'
        });
        
        if (Array.isArray(questionsData) && questionsData.length > 0) {
          setQuestions(questionsData);
          const aiConfig = createQAAIConfig(questionsData, timeLimitFromBackend);
          setConfig(aiConfig);
        } else {
          throw new Error('No questions found');
        }
        
      } catch (error) {
        console.error('Failed to load questions:', error);
        toast({
          title: "Error",
          description: "Failed to load assessment questions.",
          variant: "destructive",
        });
        setLocation('/test-selection');
      } finally {
        setLoadingPrompt(false);
      }
    };

    fetchQuestionsData();
  }, [assessmentId, user?.email, setConfig, setLocation, toast]);

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
      console.log('🎤 Starting audio recorder and attaching event listeners');
      // Remove any existing listeners first to prevent duplicates
      audioRecorder.off("data", onData).off("volume", setInVolume);
      // Now attach fresh listeners and start
      audioRecorder.on("data", onData).on("volume", setInVolume).start();
    } else {
      console.log('🎤 Stopping audio recorder');
      audioRecorder.stop();
    }

    return () => {
      console.log('🧹 Cleaning up audio recorder listeners');
      audioRecorder.off("data", onData).off("volume", setInVolume);
    };
  }, [connected, client, audioRecorder]);

  // Listen for AI audio
  useEffect(() => {
    if (!client) return;

    const handleAudio = (arrayBuffer: ArrayBuffer) => {
      setIsModelSpeaking(true);
      setTimeout(() => setIsModelSpeaking(false), 100);
      
      if (dualRecorderRef.current) {
        dualRecorderRef.current.connectAIAudioFromArrayBuffer(arrayBuffer);
      }
    };

    client.on("audio", handleAudio);
    
    return () => {
      client.off("audio", handleAudio);
    };
  }, [client]);

  // Start auto-capture when S3 is ready
  useEffect(() => {
    if (isS3Ready && hasStarted) {
      console.log('📸 S3 ready, starting auto-capture for screenshots');
      startAutoCapture();
    }
  }, [isS3Ready, hasStarted, startAutoCapture]);

  // Timer countdown
  useEffect(() => {
    if (hasStarted && !conversationComplete) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [hasStarted, conversationComplete]);

  // Auto-end interview when time runs out
  useEffect(() => {
    if (timeLeft === 0 && hasStarted && !conversationComplete) {
      console.log('⏰ Time is up! Auto-ending interview...');
      handleStopInterview();
    }
  }, [timeLeft, hasStarted, conversationComplete]);

  // Pre-connect to AI when questions are loaded (before starting)
  useEffect(() => {
    const preConnectAI = async () => {
      if (!hasStarted && !loadingPrompt && questions.length > 0 && !connected) {
        console.log('🔌 Pre-connecting to AI...');
        try {
          await connect();
          console.log('✅ AI pre-connected successfully');
        } catch (error) {
          console.error('❌ AI pre-connection failed:', error);
        }
      }
    };
    
    preConnectAI();
  }, [questions.length, loadingPrompt, hasStarted, connected, connect]);

  // Auto-start when ready - start immediately when AI is connected
  useEffect(() => {
    if (!hasStarted && !startButtonClicked && questions.length > 0 && !loadingPrompt && connected) {
      console.log('✅ AI connected, auto-starting interview...');
      // Small delay to ensure all state is ready
      const timer = setTimeout(() => {
        handleStartClick();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [questions.length, loadingPrompt, connected, hasStarted, startButtonClicked]);

  // Send initial "hello" to trigger AI to start speaking
  useEffect(() => {
    if (connected && hasStarted && client) {
      console.log('👋 Sending initial greeting to trigger AI...');
      // Small delay to ensure connection is stable
      const timer = setTimeout(() => {
        if (client && client.isConnected && client.isConnected()) {
          try {
            // Send a text message to trigger the AI to start
            client.send({
              text: "hello",
            });
            console.log('✅ Initial greeting sent to AI');
          } catch (error) {
            console.error('❌ Failed to send initial greeting:', error);
          }
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [connected, hasStarted, client]);

  const startDualRecording = async () => {
    try {
      const userStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1
        } as MediaTrackConstraints
      });
      
      dualRecorderRef.current = new DualAudioRecorder();
      await dualRecorderRef.current.startDualRecording(userStream, new AudioContext());
      console.log('✅ Dual recording started successfully');
    } catch (error) {
      console.error('Failed to start dual recording:', error);
    }
  };

  const handleStartClick = async () => {
    if (!hasStarted && !startButtonClicked) {
      setStartButtonClicked(true);
      
      try {
        console.log('🚀 Starting interview setup...');
        
        if (user?.email && assessmentId) {
          await startSession(assessmentId);
          assessmentStartTimeRef.current = new Date();
          startQuestionLog('QA-AI Interview', assessmentId, 1);
        }

        // Start camera for screenshots
        console.log('📸 Starting camera for screenshots...');
        await startCamera();
        
        // Get camera stream for display
        console.log('📹 Getting video stream...');
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          }, 
          audio: false
        });
        
        console.log('📹 Video stream obtained, active:', stream.active);
        setVideoStream(stream);
        
        // Wait a bit for video stream to be ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (videoRef.current) {
          console.log('📹 Setting video srcObject...');
          videoRef.current.srcObject = stream;
          
          // Wait for video to be ready and play
          await new Promise<void>((resolve) => {
            if (videoRef.current) {
              videoRef.current.onloadedmetadata = () => {
                console.log('📹 Video metadata loaded');
                videoRef.current?.play()
                  .then(() => {
                    console.log('📹 Video playing');
                    resolve();
                  })
                  .catch(e => {
                    console.warn('Video autoplay prevented:', e);
                    resolve();
                  });
              };
            }
          });
        }
        
        // AI is already connected from pre-connect, just start dual recording
        console.log('🎙️ Starting dual recording...');
        await startDualRecording();
        
        console.log('✅ All systems ready, starting interview');
        // Now show the UI with everything ready
        setHasStarted(true);
        setTimeLeft(assessmentTimeLimit);
        
        trackAssessmentEvent('qa_ai_interview_started', {
          assessment_id: assessmentId,
          questions_count: questions.length
        });
        
      } catch (error) {
        console.error('❌ Error starting interview:', error);
        toast({
          title: "Error",
          description: "Failed to start interview.",
          variant: "destructive",
        });
        setStartButtonClicked(false);
        setHasStarted(false);
        
        // Clean up on error
        if (videoStream) {
          videoStream.getTracks().forEach(track => track.stop());
          setVideoStream(null);
        }
      }
    } else if (hasStarted && !stopButtonClicked && !isUploading) {
      await handleStopInterview();
    }
  };

  const handleStopInterview = async () => {
    // Prevent multiple clicks
    if (stopButtonClicked || isUploading) {
      console.log('🛑 Stop already in progress, ignoring click...');
      return;
    }
    
    setStopButtonClicked(true);
    setConversationComplete(true);

    try {
      console.log('🛑 Stopping QA-AI interview...');
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      stopAutoCapture();
      await disconnect();
      
      if (dualRecorderRef.current) {
        const audioBlobs = await dualRecorderRef.current.stopDualRecording();
        
        // Upload conversation using standard S3 workflow
        if (user?.email && isS3Ready) {
          try {
            setIsUploading(true);
            console.log('📤 Uploading interview audio to S3...');
            
            // Upload the mixed conversation audio
            if (audioBlobs.mixedBlob) {
              await uploadAudioToS3(audioBlobs.mixedBlob);
            }
            
            // Verify audio was actually uploaded before proceeding
            const audioVerified = await verifyAudioWithRetry();
            
            if (audioVerified) {
              console.log('✅ Audio verified successfully');
            } else {
              console.warn('⚠️ Audio verification failed - continuing anyway');
            }
            
          } catch (uploadError) {
            console.error('❌ Audio upload failed:', uploadError);
            toast({
              variant: "destructive",
              title: "Upload Failed",
              description: "Failed to save recording. Assessment will still be marked complete.",
            });
          } finally {
            setIsUploading(false);
          }
        } else if (!isS3Ready) {
          console.warn('⚠️ S3 not ready, finishing assessment without upload');
        }
        
        dualRecorderRef.current.cleanup();
        dualRecorderRef.current = null;
      }

      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
      }

      endQuestionLog();
      stopMonitoring();

      // Finish assessment using standard workflow
      await finishAssessment();
      console.log('✅ QA-AI assessment completed successfully');
      
      trackAssessmentEvent('qa_ai_interview_completed', {
        assessment_id: assessmentId,
        duration: assessmentTimeLimit - timeLeft
      });

      toast({
        title: "Interview Complete",
        description: "Your responses have been recorded.",
      });

      // Navigate to results page like other assessments
      setTimeout(() => {
        setLocation(`/results/${assessmentId}`);
      }, 1000);
      
    } catch (error) {
      console.error('🚨 Error stopping interview:', error);
      toast({
        title: "Error",
        description: "There was an issue completing the interview.",
        variant: "destructive",
      });
      // Still try to navigate to results even on error
      setTimeout(() => {
        setLocation(`/results/${assessmentId}`);
      }, 2000);
    } finally {
      // Reset stop button state after completion
      setStopButtonClicked(false);
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Loading state - show until AI is connected
  if (!hasStarted && (loadingPrompt || !connected)) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-background)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-teal-500 mx-auto mb-4"></div>
          <p className="text-foreground text-xl">Preparing your interview...</p>
        </div>
      </div>
    );
  }

  // Active interview page (same layout as Sales AI)
  return (
    <div className="video-assessment-area">
      <SecurityRestrictions enableWindowBlurRestriction={true} />
      <AssessmentSecurity />
      <NavigationBlocker />
      
      <canvas style={{ display: "none" }} ref={renderCanvasRef} />

      {/* Warning Badge */}
      <div style={{ 
        position: 'absolute', 
        top: '150px', 
        left: '50%', 
        transform: 'translateX(-50%)', 
        zIndex: 20,
        width: '100%',
        maxWidth: '600px'
      }}>
        <WarningBadge
          isVisible={showWarning}
          message={warningMessage}
          duration={5000}
        />
      </div>

      {/* AI Connection Status - Just a dot */}
      <div className="connection-status">
        {connected ? (
          <div className="w-3 h-3 bg-green-500 rounded-full shadow-lg"></div>
        ) : (
          <div className="w-3 h-3 bg-red-500 rounded-full shadow-lg"></div>
        )}
      </div>

      {/* Main Content Container */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {/* Video Section - AI Robot Left, User Camera Right */}
        <div className="video-containers">
        {/* AI Interviewer Container - Left */}
        <div className="video-participant">
          <div className="video-circle ai-circle">
            <SiriOrb size="380px" isSpeaking={isModelSpeaking} />
          </div>
          <span className="participant-label">NOVA (AI Interviewer)</span>
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
                />
              ) : null}
            </div>
            <span className="participant-label">You</span>
          </div>
        </div>

        {/* Timer as End Button - Bottom Center */}
        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={handleStartClick}
            disabled={stopButtonClicked || isUploading}
            className="timer-end-button"
          >
            <div className="circular-progress">
              <svg className="progress-ring" width="140" height="140">
                <circle
                  className="progress-ring-circle-bg"
                  stroke="#e5e7eb"
                  strokeWidth="8"
                  fill="transparent"
                  r="62"
                  cx="70"
                  cy="70"
                />
                <circle
                  className="progress-ring-circle"
                  stroke="#4A9CA6"
                  strokeWidth="8"
                  fill="transparent"
                  r="62"
                  cx="70"
                  cy="70"
                  style={{
                    strokeDasharray: `${2 * Math.PI * 62}`,
                    strokeDashoffset: `${2 * Math.PI * 62 * (1 - progressPercentage / 100)}`,
                    transform: 'rotate(-90deg)',
                    transformOrigin: '50% 50%',
                  }}
                />
              </svg>
              <div className="timer-text">
                {isUploading ? (
                  <>
                    <div className="w-6 h-6 animate-spin rounded-full border-b-2 border-teal-500 mx-auto mb-1"></div>
                    <div className="uploading-text">Uploading...</div>
                  </>
                ) : stopButtonClicked ? (
                  <>
                    <div className="w-6 h-6 animate-spin rounded-full border-b-2 border-teal-500 mx-auto mb-1"></div>
                    <div className="processing-text">Processing...</div>
                  </>
                ) : (
                  <>
                    <div className="time-remaining">{formatTime(timeLeft)}</div>
                    <div className="timer-label">End Interview</div>
                  </>
                )}
              </div>
            </div>
          </button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          .video-assessment-area {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            width: 100vw;
            height: 100vh;
            background: #1C1C1C;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 1rem;
            overflow: hidden;
            z-index: 9999;
            margin: 0;
          }

          .connection-status {
            position: absolute;
            top: 2rem;
            right: 2rem;
            z-index: 10;
          }

          .timer-end-button {
            background: transparent;
            border: none;
            cursor: pointer;
            transition: all 0.3s ease;
            padding: 0;
            position: relative;
          }

          .timer-end-button:hover:not(:disabled) {
            transform: scale(1.05);
          }

          .timer-end-button:hover:not(:disabled) .progress-ring-circle {
            stroke: #ef4444;
          }

          .timer-end-button:hover:not(:disabled) .time-remaining {
            color: #ef4444;
          }

          .timer-end-button:hover:not(:disabled) .timer-label {
            color: #ef4444;
          }

          .timer-end-button:disabled {
            cursor: not-allowed;
            opacity: 0.7;
          }

          .circular-progress {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .progress-ring {
            filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15));
          }

          .progress-ring-circle {
            transition: stroke-dashoffset 0.3s ease, stroke 0.3s ease;
          }

          .timer-text {
            position: absolute;
            text-align: center;
            color: #1f2937;
          }

          .time-remaining {
            font-size: 1.75rem;
            font-weight: 700;
            line-height: 1;
            color: #4A9CA6;
            transition: color 0.3s ease;
          }

          .timer-label {
            font-size: 0.875rem;
            color: #6b7280;
            margin-top: 0.5rem;
            font-weight: 500;
            transition: color 0.3s ease;
          }

          .uploading-text,
          .processing-text {
            font-size: 0.875rem;
            color: #4A9CA6;
            font-weight: 500;
            margin-top: 0.25rem;
          }

          .video-containers {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10rem;
            max-width: 1400px;
            width: 100%;
            margin: 0;
          }

          .video-participant {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.75rem;
          }

          .video-circle {
            width: 380px;
            height: 380px;
            border-radius: 50%;
            background: transparent;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
          }

          .ai-circle {
            background: transparent;
          }

          .video-box {
            width: 420px;
            height: 420px;
            border-radius: 1rem;
            overflow: hidden;
            background: #000;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            position: relative;
          }

          .user-video {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .camera-placeholder {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: #1f2937;
            color: white;
          }

          .camera-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
          }

          .participant-label {
            font-size: 1.125rem;
            font-weight: 600;
            color: white;
            text-align: center;
          }

          .siri-orb {
            position: absolute;
            inset: 0;
            border-radius: 50%;
            --angle: 0deg;
            background:
              conic-gradient(
                from calc(var(--angle, 0deg) * 1.2) at 30% 65%,
                oklch(75% 0.15 350) 0deg,
                transparent 45deg 315deg,
                oklch(75% 0.15 350) 360deg
              ),
              conic-gradient(
                from calc(var(--angle, 0deg) * 0.8) at 70% 35%,
                oklch(80% 0.12 200) 0deg,
                transparent 60deg 300deg,
                oklch(80% 0.12 200) 360deg
              ),
              conic-gradient(
                from calc(var(--angle, 0deg) * -1.5) at 65% 75%,
                oklch(78% 0.14 280) 0deg,
                transparent 90deg 270deg,
                oklch(78% 0.14 280) 360deg
              ),
              conic-gradient(
                from calc(var(--angle, 0deg) * 2.1) at 25% 25%,
                oklch(80% 0.12 200) 0deg,
                transparent 30deg 330deg,
                oklch(80% 0.12 200) 360deg
              ),
              conic-gradient(
                from calc(var(--angle, 0deg) * -0.7) at 80% 80%,
                oklch(78% 0.14 280) 0deg,
                transparent 45deg 315deg,
                oklch(78% 0.14 280) 360deg
              ),
              radial-gradient(
                ellipse 120% 80% at 40% 60%,
                oklch(75% 0.15 350) 0%,
                transparent 50%
              );
            filter: blur(var(--blur-amount, 8px)) contrast(var(--contrast-amount, 1.8)) saturate(1.2);
            transform: translateZ(0);
            will-change: transform;
            pointer-events: none;
            z-index: 1;
          }

          .siri-orb.idle {
            animation: rotate-idle 30s linear infinite;
            opacity: 0.6;
          }

          .siri-orb.speaking {
            animation: rotate-speaking 8s linear infinite, pulse 1.5s ease-in-out infinite;
            opacity: 1;
          }

          .siri-orb::after {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border-radius: 50%;
            background: radial-gradient(
              circle at 45% 55%,
              rgba(255, 255, 255, 0.1) 0%,
              rgba(255, 255, 255, 0.05) 30%,
              transparent 60%
            );
            mix-blend-mode: overlay;
          }

          @keyframes rotate-idle {
            from {
              --angle: 0deg;
            }
            to {
              --angle: 360deg;
            }
          }

          @keyframes rotate-speaking {
            0% {
              --angle: 0deg;
              transform: scale(1);
            }
            50% {
              --angle: 180deg;
              transform: scale(1.05);
            }
            100% {
              --angle: 360deg;
              transform: scale(1);
            }
          }

          @keyframes pulse {
            0%, 100% {
              opacity: 0.8;
            }
            50% {
              opacity: 1;
            }
          }

          @media (max-width: 768px) {
            .video-containers {
              grid-template-columns: 1fr;
              gap: 2rem;
              margin-top: 6rem;
            }

            .video-circle,
            .video-box {
              width: 300px;
              height: 300px;
            }

            .ai-robot-svg {
              width: 80px;
              height: 80px;
            }
          }
        `
      }} />
    </div>
  );
};

export default function QAAIAssessment() {
  const [, params] = useRoute('/qa-ai/:assessmentId');

  if (!params?.assessmentId) {
    return null;
  }

  return (
    <LiveAPIProvider>
      <QAAIAssessmentContent assessmentId={params.assessmentId} />
    </LiveAPIProvider>
  );
}
