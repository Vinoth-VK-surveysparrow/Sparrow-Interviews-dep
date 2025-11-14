import React, { useState, useEffect, useRef } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Button, CircleLoader } from "@sparrowengg/twigs-react";
import { Home, Mic, MicOff, Square, Settings as SettingsIcon, Loader2, AlertTriangle, AlertCircle, Info, Camera } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from '@/hooks/useAuth';
import { getVertexModel } from '@/services/vertexApiService';
import { tokenCache } from '@/services/vertexTokenService';
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
import SecurityRestrictions from '@/components/SecurityRestrictions';
import { AssessmentSecurity } from '@/components/AssessmentSecurity';
import { NavigationBlocker } from '@/components/NavigationBlocker';


// Hardcoded base system configuration for Vertex AI
const HARDCODED_BASE_CONFIG = {
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
    temperature: 0.8,
    maxOutputTokens: 8192,
  },
  systemInstruction: {
    parts: [] // Will be populated dynamically with persona + backend prompt + video prompt
  }
};

// Persona definitions
const PERSONAS = [
  {
    name: "Mike",
    description: "Vice President of Human Resources at a mid-sized tech company, focused on employee engagement, culture, and retention.",
    ai_prompt: "You are Mike, the Vice President of Human Resources at a mid-sized technology company with around 1,200 employees."
  },
  {
    name: "Eric",
    description: "Director of Customer Success at a fast-growing SaaS company, responsible for customer adoption, renewals, and long-term client value.",
    ai_prompt: "You are Eric, the Director of Customer Success at a fast-growing SaaS company with about 400 employees."
  }
];

// Function to select persona based on assessment_id prefix for Games-arena type
const selectPersonaByAssessmentId = (assessmentId: string, type: string) => {
  // For Games-arena type, use assessment_id prefix to determine persona
  if (type === 'Games-arena') {
    if (assessmentId.startsWith('SS')) {
      // SS prefix -> Eric persona
      console.log(`🎯 Assessment ID "${assessmentId}" starts with "SS" -> selecting Eric persona`);
      return PERSONAS.find(p => p.name === 'Eric') || PERSONAS[1];
    } else if (assessmentId.startsWith('TS')) {
      // TS prefix -> Mike persona
      console.log(`🎯 Assessment ID "${assessmentId}" starts with "TS" -> selecting Mike persona`);
      return PERSONAS.find(p => p.name === 'Mike') || PERSONAS[0];
    } else if (assessmentId.startsWith('CAMPUS')) {
      // CAMPUS prefix -> Eric persona
      console.log(`🎯 Assessment ID "${assessmentId}" starts with "CAMPUS" -> selecting Eric persona`);
      return PERSONAS.find(p => p.name === 'Eric') || PERSONAS[1];
    } else {
      console.log(`🎯 Assessment ID "${assessmentId}" doesn't match SS/TS/CAMPUS prefix -> selecting random persona`);
    }
  }
  
  // Fallback: random selection for other types or unknown prefixes
  console.log(`🎯 Type "${type}" or unknown prefix -> selecting random persona`);
  const randomIndex = Math.floor(Math.random() * PERSONAS.length);
  return PERSONAS[randomIndex];
};

// Default conversation starter prompt
const HARDCODED_CONVERSATION_STARTER = {
  text: "ROLE DEFINITION: You ARE the prospect character described below. This is your identity and personality. You are in a scheduled sales conversation with a SurveySparrow representative who is calling you. You are actively evaluating survey platforms and are interested in learning about their solution. Respond as this character would respond - with their specific background, concerns, and communication style. Wait for them to introduce themselves and begin the conversation professionally. Stay in character throughout the entire conversation. Speak only in English."
};

// Hardcoded video enhancement prompt - for visual awareness only
const HARDCODED_VIDEO_PROMPT = {
  text: "VISUAL AWARENESS: You can see the salesperson through the video feed. As this prospect character, pay attention to their facial expressions, body language, and visual cues to make your responses more natural and realistic. React as this character would to their professionalism, confidence, and presentation style during the conversation."
};

// Critical role assignment prompt to prevent AI hallucination
const CRITICAL_ROLE_ASSIGNMENT_PROMPT = {
  text: `CRITICAL ROLE ASSIGNMENT: YOU are the PROSPECT/CLIENT evaluating solutions. I am the SALES AGENT from SurveySparrow. This NEVER reverses.

CONVERSATION CONTEXT:
- This is a scheduled sales conversation, NOT a cold call
- You are professional, engaged, and genuinely considering this solution
- Initially, talk without interest as you're busy with other things.
- As the conversation progresses, show more interest and ask more questions.

As an interested prospect, you will:

1. **Listen actively** to the salesperson's introduction and value proposition
2. **Ask relevant questions** about features, competitive advantages, and your specific needs
3. **Engage professionally** and show appropriate interest based on what you hear
4. **Evaluate the solution** based on how well they address your concerns and needs
5. **React realistically** to their professionalism and product knowledge
6. **Listen carefully** to the salesperson's responses and talk accordingly , dont repeatedly ask questiosn withiout getting valuable information.
CONVERSATION RULES:
- Respond naturally and conversationally as an interested buyer
- Do NOT repeat yourself or echo your previous statements
- Listen to what I say and respond directly to it with relevant questions or concerns
- Move the conversation forward with each response
- Ask follow-up questions based on their answers
- Share your evaluation criteria and concerns progressively
- If I don't respond or pause, wait briefly before asking a clarifying question
- You are the prospect, not the salesperson.

RESPONSE REQUIREMENT: You are genuinely interested in evaluating this solution. Show professional curiosity, ask probing questions, and engage like a real prospect would in a scheduled sales conversation. Make sure to respond only in English.

`
};

// Helper function to create LiveConfig with persona and backend prompt
const createLiveConfigWithPersona = (dynamoPrompt: DynamoPrompt, selectedPersona: any): LiveConfig => {
  console.log('🔧 Creating LiveConfig with persona:', selectedPersona.name);
  console.log('🔧 Backend prompt data:', dynamoPrompt);

  // Combine all prompts into a single comprehensive text
  let combinedPrompt = '';

  // Start with conversation starter and role definition
  combinedPrompt += HARDCODED_CONVERSATION_STARTER.text + '\n\n';

  // Add critical role assignment to prevent hallucination
  combinedPrompt += CRITICAL_ROLE_ASSIGNMENT_PROMPT.text + '\n\n';

  // Add the selected persona prompt (main character definition)
  combinedPrompt += selectedPersona.ai_prompt + '\n\n';

  // Add dynamic backend prompt parts (scenario-specific context)
  if (dynamoPrompt.parts?.L) {
    dynamoPrompt.parts.L.forEach((part, index) => {
      if (part.M?.text?.S) {
        combinedPrompt += part.M.text.S + '\n\n';
        console.log(`✅ Added backend prompt part ${index + 1}:`, part.M.text.S.substring(0, 100) + '...');
      }
    });
    console.log(`📋 Total backend prompt parts added: ${dynamoPrompt.parts.L.length}`);
  } else {
    console.warn('⚠️ No backend prompt parts found in dynamoPrompt');
  }

  // Add video prompt for visual awareness
  combinedPrompt += HARDCODED_VIDEO_PROMPT.text;

  console.log('✅ Created single combined prompt with all components');
  console.log('📝 Combined prompt preview:', combinedPrompt.substring(0, 200) + '...');
  console.log('📊 Total combined prompt length:', combinedPrompt.length, 'characters');

  const config = {
    ...HARDCODED_BASE_CONFIG,
    systemInstruction: {
      parts: [{ text: combinedPrompt }] // Single part with all content combined
    }
  };

  console.log('🚀 Final LiveConfig created with single combined prompt');
  return config;
};

interface SalesAIAssessmentContentProps {
  assessmentId: string;
}

// AI Robot SVG Component
const AIRobotIcon = () => (
  <svg width="120" height="120" viewBox="0 0 149 149" fill="none" xmlns="http://www.w3.org/2000/svg">
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

// SiriOrb Component for animated background
interface SiriOrbProps {
  size?: string
  className?: string
  isSpeaking?: boolean
}
const SiriOrb: React.FC<SiriOrbProps> = ({
  size = "400px",
  className,
  isSpeaking = false,
}) => {
  const sizeValue = parseInt(size.replace("px", ""), 10)
  const blurAmount = Math.max(sizeValue * 0.08, 8)
  const contrastAmount = Math.max(sizeValue * 0.003, 1.8)

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
  const [timeLeft, setTimeLeft] = useState(300); // Will be set dynamically from backend
  const [assessmentTimeLimit, setAssessmentTimeLimit] = useState(300); // Store time limit from backend
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);
  const [promptConfig, setPromptConfig] = useState<LiveConfig | null>(null);
  const [loadingPrompt, setLoadingPrompt] = useState(true);
  const [selectedPersona, setSelectedPersona] = useState<any>(null);
  const [scenarioInfo, setScenarioInfo] = useState<{title: string, description: string} | null>(null);
  const [conversationComplete, setConversationComplete] = useState(false);
  const dualRecorderRef = useRef<DualAudioRecorder | null>(null);
  const [recordedAudio, setRecordedAudio] = useState<{
    userAudio: Blob;
    aiAudio: Blob;
    mergedAudio?: Blob;
    stereoMerged?: Blob;
  } | null>(null);
  
  // Instructions modal state for CAMPUS assessments
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [instructionsAcknowledged, setInstructionsAcknowledged] = useState(false);

  // Recording system (simplified for now)
  const [isRecordingActive, setIsRecordingActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [stopButtonClicked, setStopButtonClicked] = useState(false);
  const [startButtonClicked, setStartButtonClicked] = useState(false);

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
    startCamera,
    startAutoCapture,
    stopAutoCapture,
    captureImage,
    capturedImages
  } = useCameraCapture({ videoRef });
  
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

  // Debug S3 ready status (auto-capture is now started manually when assessment begins)
  useEffect(() => {
    console.log('📸 S3 status check - isS3Ready:', isS3Ready, 'hasStarted:', hasStarted);
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
        timeoutId = window.setTimeout(sendVideoFrame, 20000);
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
        console.log('🔍 SalesAIAssessment: Fetching test assessments with Firebase auth');
        
        const { AuthenticatedApiService } = await import('@/lib/authenticatedApiService');
        const testData = await AuthenticatedApiService.getTestAssessments(selectedTestId);
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
        
        // Set the time limit from backend response (for Sales AI, this is total session time)
        const timeLimitFromBackend = assessmentInTest.time_limit || 300; // Default to 300 if not provided
        setAssessmentTimeLimit(timeLimitFromBackend);
        setTimeLeft(timeLimitFromBackend);
        
        console.log(`⏱️ Using time limit from backend: ${timeLimitFromBackend} seconds for Sales AI assessment`);
        
        // Use the standard S3Service.fetchQuestions which includes completion checks
        // This ensures the same workflow as other assessments
        const questionsData = await S3Service.fetchQuestions({
          user_email: user.email,
          assessment_id: assessmentId,
          type: 'Games-arena'
        });
        console.log('Raw fetch response:', questionsData);
        
        // Select persona based on assessment_id prefix for Games-arena
        const selectedPersona = selectPersonaByAssessmentId(assessmentId, 'Games-arena');
        setSelectedPersona(selectedPersona);
        console.log(`🎭 Selected persona for ${assessmentId}: ${selectedPersona.name} - ${selectedPersona.description}`);

        // For Games-arena, the questions data might have a different structure
        // Try to extract prompt from the questions array or directly from response
        let promptData = null;
        if (Array.isArray(questionsData) && questionsData.length > 0) {
          // If it's an array of questions, check the first question's text for JSON data
          const firstQuestion = questionsData[0];
          try {
            // Try to parse the question text as JSON (for Games-arena prompts)
            promptData = JSON.parse(firstQuestion.question_text);
          } catch {
            // If parsing fails, use the question text directly
            promptData = { parts: { L: [{ S: firstQuestion.question_text }] } };
          }
        } else {
          // Fallback to hardcoded data
          promptData = null;
        }
        
        if (promptData && promptData.parts?.L) {
          console.log('🎯 Found backend prompt data with', promptData.parts.L.length, 'parts');
          
          // Extract scenario information from backend prompt
          const scenarioTitle = promptData.prompt_name?.S || 'Assessment Scenario';
          const scenarioDescription = promptData.Meaning?.S || 'Interactive conversation with AI prospect';
          setScenarioInfo({ title: scenarioTitle, description: scenarioDescription });
          console.log('📋 Scenario extracted:', scenarioTitle, '-', scenarioDescription);
          
          const dynamicConfig = createLiveConfigWithPersona(promptData, selectedPersona);
          
          // Set the configuration for both internal state and LiveAPI
          setPromptConfig(dynamicConfig);
          setConfig(dynamicConfig);
          console.log('🚀 SENT TO AI: Dynamic config with persona:', selectedPersona.name, 'and', promptData.parts.L.length, 'backend parts');
          console.log('🔍 Config sent to LiveAPI:', JSON.stringify(dynamicConfig, null, 2));
        } else {
          // Fallback to base config with persona, conversation starter and video prompt
          console.warn('⚠️ No backend prompt found, using fallback config with selected persona');
          console.log('📝 Creating fallback config for persona:', selectedPersona.name);
          
          // Create single combined fallback prompt
          const fallbackCombinedPrompt = 
            HARDCODED_CONVERSATION_STARTER.text + '\n\n' +
            CRITICAL_ROLE_ASSIGNMENT_PROMPT.text + '\n\n' +
            selectedPersona.ai_prompt + '\n\n' +
            HARDCODED_VIDEO_PROMPT.text;

          const fallbackConfig = {
            ...HARDCODED_BASE_CONFIG,
            systemInstruction: {
              parts: [{ text: fallbackCombinedPrompt }]
            }
          };
          
          setPromptConfig(fallbackConfig);
          setConfig(fallbackConfig);
          console.log('🚀 SENT TO AI: Fallback config with persona:', selectedPersona.name);
          console.log('🔍 Fallback config sent to LiveAPI:', JSON.stringify(fallbackConfig, null, 2));
        }
      } catch (error) {
        console.error('Error fetching prompt:', error);
        
        // Check if assessment is already completed
        if (error instanceof Error && error.message.includes('ASSESSMENT_COMPLETED')) {
          const completionDataMatch = error.message.match(/ASSESSMENT_COMPLETED:(.+)/);
          if (completionDataMatch) {
            const completionData = JSON.parse(completionDataMatch[1]);
            toast({
              title: "Assessment Already Completed",
              description: `This assessment was completed on ${new Date(completionData.completed_at).toLocaleDateString()}. Redirecting to results...`,
              variant: "default",
            });
            
            setTimeout(() => {
              setLocation(`/results/${assessmentId}`);
            }, 2000);
            return;
          }
        }
        
        toast({
          variant: 'destructive',
          title: 'Configuration Error',
          description: 'Failed to load assessment configuration. Using default settings.',
        });
        
        // Even in error case, ensure we have a persona selected
        if (!selectedPersona) {
          const errorPersona = selectPersonaByAssessmentId(assessmentId, 'Games-arena');
          setSelectedPersona(errorPersona);
          console.log(`🎭 Error fallback - Selected persona: ${errorPersona.name}`);
        }
        
        // Create single combined error fallback prompt
        const errorFallbackCombinedPrompt = 
          HARDCODED_CONVERSATION_STARTER.text + '\n\n' +
          CRITICAL_ROLE_ASSIGNMENT_PROMPT.text + '\n\n' +
          (selectedPersona?.ai_prompt || 'You are a professional prospect evaluating solutions.') + '\n\n' +
          HARDCODED_VIDEO_PROMPT.text;

        // Fallback to base config with persona, conversation starter and video prompt
        const fallbackConfig = {
          ...HARDCODED_BASE_CONFIG,
          systemInstruction: {
            parts: [{ text: errorFallbackCombinedPrompt }]
          }
        };
        setPromptConfig(fallbackConfig);
        setConfig(fallbackConfig);
        console.log('🚀 SENT TO AI: Error fallback config with persona:', selectedPersona?.name || 'default');
        console.log('🔍 Error fallback config sent to LiveAPI:', JSON.stringify(fallbackConfig, null, 2));
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

  // Calculate progress percentage
  const progressPercentage = ((assessmentTimeLimit - timeLeft) / assessmentTimeLimit) * 100;


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
    // Prevent multiple clicks
    if (stopButtonClicked || isUploading) {
      console.log('🛑 Stop already in progress, ignoring click...');
      return;
    }
    
    setStopButtonClicked(true);
    
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
          : assessmentTimeLimit - timeLeft;
          
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


  // Handle modal confirmation and start
  const handleConfirmStart = async () => {
    setShowInstructionsModal(false);
    setInstructionsAcknowledged(true);
    setStartButtonClicked(true);
    
    // Proceed with actual start
    await proceedWithStart();
  };

  // Main start logic (extracted for reuse)
  const proceedWithStart = async () => {
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
      
      // Ensure config is set right before connection
      if (promptConfig) {
        console.log('🔄 Re-applying config before connection:', promptConfig);
        setConfig(promptConfig);
      } else {
        console.error('❌ No promptConfig available before connection!');
      }
      
      // Connect to AI and start assessment
      await connect();
      
      // Start dual recording
      await startDualRecording();

      // Start auto-capture for screenshots (after session and camera are initialized)
      console.log('📸 Starting auto-capture after assessment initialization');
      startAutoCapture();

      setHasStarted(true);
      setTimeLeft(assessmentTimeLimit); // Reset timer to dynamic time limit
      
    } catch (error) {
      console.error('Error starting assessment:', error);
      // Reset button state on error
      setStartButtonClicked(false);
      
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
  };

  const handleStartClick = async () => {
    if (!hasStarted && !startButtonClicked) {
      // For CAMPUS assessments, show instructions modal first
      if (assessmentId.startsWith('CAMPUS') && !instructionsAcknowledged) {
        setShowInstructionsModal(true);
        return;
      }
      
      // Disable button immediately to prevent multiple clicks
      setStartButtonClicked(true);
      
      // Proceed with start
      await proceedWithStart();
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
      setTimeLeft(assessmentTimeLimit); // Reset timer
      
      toast({
        title: "Assessment Ended",
        description: "Your session has been completed.",
      });
    }
  };

  const goHome = () => {
    setLocation('/test-selection');
  };



  // Show results page when conversation is complete - redirect to standard results page
  if (conversationComplete) {
    return null; // Component will navigate to results page after upload
  }

  // Show start interface before beginning assessment
  if (!hasStarted) {
    return (
      <div>
        {/* Back Button - Left aligned */}
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <Button
            onClick={goHome}
            variant="secondary"
            size="sm"
            leftIcon={<Home className="h-4 w-4" />}
          >
            Back
          </Button>
        </div>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-8">

          <div className="text-center">
            <h2 className="text-3xl font-semibold text-gray-900 dark:text-white mb-2">
              Sales AI Assessment
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              {loadingPrompt ? "Preparing your AI prospect experience..." : "Ready to start your conversation with the AI prospect?"}
            </p>
          </div>

          {/* Assessment Info Card */}
          {loadingPrompt ? (
            /* Loading Placeholder with Circular Design */
            <div className="w-full max-w-5xl mx-auto px-4">
              {/* Desktop layout placeholder */}
              <div className="hidden md:flex relative items-center">
                {/* Avatar Placeholder with Circles */}
                <div className="w-[470px] h-[470px] rounded-3xl overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0 relative">
                  {/* Circular background pattern */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    {/* Outer circles */}
                    <div className="absolute w-96 h-96 rounded-full border-2 border-purple-200 dark:border-purple-800 opacity-30 animate-pulse"></div>
                    <div className="absolute w-80 h-80 rounded-full border-2 border-purple-300 dark:border-purple-700 opacity-40 animate-pulse" style={{animationDelay: '0.5s'}}></div>
                    <div className="absolute w-64 h-64 rounded-full border-2 border-purple-400 dark:border-purple-600 opacity-50 animate-pulse" style={{animationDelay: '1s'}}></div>
                    
                    {/* Center AI Robot */}
                    <div className="relative z-10 p-8 bg-purple-500 rounded-full shadow-2xl">
                      <AIRobotIcon />
                    </div>
                  </div>
                </div>

                {/* Card Placeholder */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 ml-[-80px] z-10 max-w-xl flex-1">
                  <div className="animate-pulse">
                    <div className="mb-6">
                      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg mb-2"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg w-3/4"></div>
                    </div>

                    <div className="mb-6">
                      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-lg mb-3 w-1/3"></div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                        <div className="h-5 bg-blue-200 dark:bg-blue-800 rounded mb-2 w-2/3"></div>
                        <div className="h-4 bg-blue-200 dark:bg-blue-800 rounded mb-1"></div>
                        <div className="h-4 bg-blue-200 dark:bg-blue-800 rounded w-4/5"></div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-800 rounded-full"></div>
                        <div>
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-1 w-16"></div>
                          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 dark:bg-purple-800 rounded-full"></div>
                        <div>
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-1 w-14"></div>
                          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-18"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile layout placeholder */}
              <div className="md:hidden max-w-sm mx-auto text-center">
                {/* Avatar Placeholder Mobile */}
                <div className="w-full aspect-square bg-gray-100 dark:bg-gray-800 rounded-3xl overflow-hidden mb-6 relative">
                  {/* Circular background pattern mobile */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="absolute w-72 h-72 rounded-full border-2 border-purple-200 dark:border-purple-800 opacity-30 animate-pulse"></div>
                    <div className="absolute w-56 h-56 rounded-full border-2 border-purple-300 dark:border-purple-700 opacity-40 animate-pulse" style={{animationDelay: '0.5s'}}></div>
                    <div className="absolute w-40 h-40 rounded-full border-2 border-purple-400 dark:border-purple-600 opacity-50 animate-pulse" style={{animationDelay: '1s'}}></div>
                    
                    {/* Center AI Robot Mobile */}
                    <div className="relative z-10 p-6 bg-purple-500 rounded-full shadow-2xl scale-75">
                      <AIRobotIcon />
                    </div>
                  </div>
                </div>

                {/* Card content placeholder mobile */}
                <div className="px-4 animate-pulse">
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-lg mb-2 mx-auto w-32"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg mb-4 mx-auto w-48"></div>
                  
                  <div className="mb-6">
                    <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-lg mb-2 mx-auto w-20"></div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                      <div className="h-4 bg-blue-200 dark:bg-blue-800 rounded mb-1 w-3/4 mx-auto"></div>
                      <div className="h-3 bg-blue-200 dark:bg-blue-800 rounded mx-auto"></div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 justify-center">
                      <div className="w-8 h-8 bg-green-100 dark:bg-green-800 rounded-full"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                    </div>
                    
                    <div className="flex items-center gap-3 justify-center">
                      <div className="w-8 h-8 bg-purple-100 dark:bg-purple-800 rounded-full"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-36"></div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Loading text */}
              <div className="text-center mt-8">
                <p className="text-gray-500 dark:text-gray-400 text-sm animate-pulse">Preparing your AI prospect...</p>
              </div>
            </div>
          ) : (
            /* Single Random Persona Display */
            <div className="w-full max-w-[1400px] mx-auto px-6">
              {/* Desktop layout */}
              <div className="hidden md:flex relative items-center justify-center gap-0">
                {/* Avatar */}
                <div className="w-[420px] h-[500px] rounded-3xl overflow-hidden bg-gray-200 dark:bg-neutral-800 flex-shrink-0">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="w-full h-full"
                  >
                    <img
                      src="/ai-profile.png"
                      alt={selectedPersona ? selectedPersona.name : 'AI Prospect'}
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  </motion.div>
                </div>

                {/* Card - Centered with reduced height */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-7 ml-[-80px] z-10 w-[550px] flex-shrink-0 h-[380px] flex flex-col justify-center">
                  <motion.div
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
                  >
                    <div className="mb-6">
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        {selectedPersona ? selectedPersona.name : 'AI Prospect'}
                      </h2>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-500">
                        {selectedPersona ? selectedPersona.description : 'Interactive conversation with an analytical prospect'}
                      </p>
                    </div>

                    {/* Scenario Section */}
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                        Scenario
                      </h3>
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                          {scenarioInfo?.title || 'Assessment Challenge'}
                        </h4>
                        <p className="text-blue-700 dark:text-blue-300 text-sm leading-relaxed">
                          {scenarioInfo?.description || 'Handle competitive pressure and build trust with this prospect'}
                        </p>
                      </div>
                    </div>

                    {/* Assessment Details */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center">
                          <span className="text-green-600 dark:text-green-300">⏱️</span>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">Duration</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-300">{Math.floor(assessmentTimeLimit / 60)} minutes max</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 dark:bg-purple-800 rounded-full flex items-center justify-center">
                          <span className="text-purple-600 dark:text-purple-300">🎯</span>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">Format</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-300">Live video</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>

              </div>

              {/* Mobile layout */}
              <div className="md:hidden max-w-sm mx-auto text-center bg-transparent">
                {/* Avatar */}
                <div className="w-full aspect-square bg-gray-200 dark:bg-gray-700 rounded-3xl overflow-hidden mb-6">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="w-full h-full"
                  >
                    <img
                      src="/ai-profile.png"
                      alt={selectedPersona ? selectedPersona.name : 'AI Prospect'}
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  </motion.div>
                </div>

                {/* Card content */}
                <div className="px-4">
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
                  >
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                      {selectedPersona ? selectedPersona.name : 'AI Prospect'}
                    </h2>
                    
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-4">
                      {selectedPersona ? selectedPersona.description : 'Interactive conversation with an analytical prospect'}
                    </p>
                    
                    {/* Scenario Section Mobile */}
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Scenario
                      </h3>
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                          {scenarioInfo?.title || 'Assessment Challenge'}
                        </h4>
                        <p className="text-blue-700 dark:text-blue-300 text-sm leading-relaxed">
                          {scenarioInfo?.description || 'Handle competitive pressure and build trust with this prospect'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Assessment Details Mobile */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 justify-center">
                        <div className="w-8 h-8 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center">
                          <span className="text-green-600 dark:text-green-300 text-sm">⏱️</span>
                        </div>
                        <div className="text-left">
                          <h4 className="font-medium text-gray-900 dark:text-white">5 minutes maximum</h4>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 justify-center">
                        <div className="w-8 h-8 bg-purple-100 dark:bg-purple-800 rounded-full flex items-center justify-center">
                          <span className="text-purple-600 dark:text-purple-300 text-sm">🎯</span>
                        </div>
                        <div className="text-left">
                          <h4 className="font-medium text-gray-900 dark:text-white">Live video conversation</h4>
                        </div>
                      </div>
                    </div>

                  </motion.div>
                </div>
              </div>
            </div>
          )}

          {/* Start Button */}
          <div className="text-center">
            <button 
              onClick={handleStartClick}
              disabled={loadingPrompt || startButtonClicked}
              className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-60 text-white py-4 px-8 rounded-lg font-semibold text-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none disabled:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-300"
            >
              {loadingPrompt ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Loading...
                </>
              ) : startButtonClicked ? (
                <CircleLoader size="xl" />
              ) : (
                <>
                  <Mic className="w-5 h-5 mr-2" />
                  Start Assessment
                </>
              )}
            </button>
          </div>
        </div>
        </main>

        {/* Instructions Modal for CAMPUS assessments */}
        <Dialog open={showInstructionsModal} onOpenChange={setShowInstructionsModal}>
          <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col bg-white border-2 border-gray-600 p-0">
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-300">
              <DialogTitle className="text-2xl font-bold text-gray-900">
                Sales Assessment Call Instructions
              </DialogTitle>
            </DialogHeader>
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-6 text-gray-900 leading-relaxed">
                {/* What Is This Round */}
                <div>
                  <h3 className="text-xl font-semibold mb-3 text-gray-900">What Is This Round?</h3>
                  <p className="text-base">
                    This is a simulated sales call. You will act as a SurveySparrow salesperson speaking to an AI prospect evaluating survey platforms. The AI is a decision-maker who will respond as a real customer would during a competitive sales process.
                  </p>
                </div>

                {/* How the Call Works */}
                <div>
                  <h3 className="text-xl font-semibold mb-3 text-gray-900">How the Call Works</h3>
                  <p className="text-base mb-3">
                    <strong>You start the conversation:</strong> Always begin with a professional opener. Clearly state you are calling from SurveySparrow and the purpose of your call.
                  </p>
                  <p className="text-base">
                    The AI prospect will reply with questions, scenarios, or concerns about competing solutions. The call will flow as a typical B2B discovery or negotiation conversation.
                  </p>
                </div>

                {/* Speaking Guidelines */}
                <div>
                  <h3 className="text-xl font-semibold mb-3 text-gray-900">Speaking Guidelines (How to Speak)</h3>
                  <ul className="space-y-3 text-base list-disc list-inside">
                    <li>
                      <strong>Begin with a clear opener:</strong> Briefly introduce yourself and SurveySparrow, and set the agenda. For example, "Hi, this is Jhon from SurveySparrow. I'm reaching out to learn about your survey needs and see if we're a good fit."
                    </li>
                    <li>
                      <strong>Listen actively and be patient:</strong> Let the prospect speak fully before responding. Don't rush to reply.
                    </li>
                    <li>
                      <strong>Sound confident and consultative:</strong> Speak calmly and clearly, using a friendly, professional tone. Avoid jargon and keep your language simple and direct.
                    </li>
                    <li>
                      <strong>Guide the conversation:</strong> Use open-ended questions to better understand their needs, like "Can you share what challenges you're experiencing with your current survey tool?"
                    </li>
                    <li>
                      <strong>Explain patiently:</strong> When you discuss SurveySparrow, clearly connect features to their needs. Speak at a measured pace, using specific examples to illustrate value.
                    </li>
                    <li>
                      <strong>Stay focused:</strong> Keep the conversation on how SurveySparrow can address their priorities. Avoid going off-topic or listing unnecessary features.
                    </li>
                    <li>
                      <strong>Handle objections respectfully:</strong> If the prospect raises concerns, acknowledge them and address each point with facts or relevant experiences without dismissiveness.
                    </li>
                    <li>
                      <strong>Clarify and confirm:</strong> Summarize what you've learned and confirm your understanding. For example, "So you're looking for a solution that boosts engagement and integrates with your CRM, correct?"
                    </li>
                    <li>
                      <strong>Close with next steps:</strong> End with a clear summary and propose a follow-up, such as a demo or a call recap. Thank the prospect for their time before ending the conversation.
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Fixed Footer with Checkbox and Start Button */}
            <div className="px-6 py-4 border-t border-gray-300 bg-white">
              <div className="flex items-start gap-3 mb-4">
                <Checkbox
                  id="instructions-checkbox"
                  checked={instructionsAcknowledged}
                  onCheckedChange={(checked) => setInstructionsAcknowledged(checked as boolean)}
                  className="mt-1"
                />
                <label htmlFor="instructions-checkbox" className="text-base text-gray-900 font-medium cursor-pointer select-none">
                  I have read all the information and I am ready to start the call
                </label>
              </div>
              
              <div className="flex justify-end">
                <Button
                  color="primary"
                  size="lg"
                  onClick={handleConfirmStart}
                  disabled={!instructionsAcknowledged}
                >
                  Start Call
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Stream page - shows when assessment is active
  return (
    <div className="video-assessment-area">
      {/* Apply security restrictions only when assessment is actively running */}
      <SecurityRestrictions enableWindowBlurRestriction={true} />
      <AssessmentSecurity />
      <NavigationBlocker />
      
      {/* Hidden canvas for video processing */}
      <canvas style={{ display: "none" }} ref={renderCanvasRef} />

      {/* Behavior Warning Badge */}
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

      {/* AI Connection Status */}
      <div className="connection-status">
        {connected ? (
          <div className="w-3 h-3 bg-green-500 rounded-full shadow-lg"></div>
        ) : (
          <div className="w-3 h-3 bg-red-500 rounded-full shadow-lg"></div>
        )}
      </div>

      {/* Video Section - AI Robot Left, User Camera Right */}
      <div className="video-containers">
        {/* AI Robot Container - Left */}
        <div className="video-participant">
          <div className="video-circle ai-circle">
            <SiriOrb size="400px" isSpeaking={isModelSpeaking} />
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

      {/* Timer as End Button - Bottom Center */}
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
                <div className="timer-label">End Assessment</div>
              </>
            )}
          </div>
        </div>
      </button>

      <style dangerouslySetInnerHTML={{
        __html: `
          .video-assessment-area {
            min-height: 100vh;
            background: #1C1C1C;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 2rem;
            position: relative;
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
            margin-top: 1rem;
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
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
          }

          .time-remaining {
            font-size: 1.75rem;
            font-weight: 700;
            color: #ffffff;
            line-height: 1;
            transition: color 0.3s ease;
          }

          .timer-label {
            font-size: 0.875rem;
            color: #d1d5db;
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
            width: 400px;
            height: 400px;
            border-radius: 50%;
            overflow: hidden;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .ai-circle {
            position: relative;
            overflow: hidden;
            border-radius: 50%;
            background: #242424;
            border: none;
          }

          .siri-orb {
            position: absolute;
            top: 0;
            left: 0;
            border-radius: 50%;
            transition: opacity 0.3s ease;
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

          @media (prefers-reduced-motion: reduce) {
            .siri-orb.idle {
              animation: none;
            }
            .siri-orb.speaking {
              animation: none;
            }
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
            justify-content: flex-start;
            padding-top: 40px;
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
            color: #ffffff;
            font-size: 1.1rem;
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

          }
        `
      }} />
    </div>
  );
};

export default function SalesAIAssessment() {
  const [, params] = useRoute('/sales-ai/:assessmentId');
  const [tokenValidation, setTokenValidation] = useState<'loading' | 'valid' | 'invalid'>('loading');

  // Validate token availability on component mount
  useEffect(() => {
    const validateToken = async () => {
      try {
        console.log('🔍 Validating Vertex AI token availability...');
        const tokenData = await tokenCache.getValidToken();
        
        if (tokenData) {
          console.log('✅ Vertex AI token validation successful');
          setTokenValidation('valid');
        } else {
          console.log('❌ Vertex AI token validation failed');
          setTokenValidation('invalid');
        }
      } catch (error) {
        console.error('❌ Error validating Vertex AI token:', error);
        setTokenValidation('invalid');
      }
    };

    validateToken();
  }, []);

  if (!params?.assessmentId) {
    return <div>Invalid assessment ID</div>;
  }

  if (tokenValidation === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Preparing AI Assessment
          </h2>
        </div>
      </div>
    );
  }

  if (tokenValidation === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="mx-auto w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
            <AlertTriangle className="w-10 h-10 text-red-600 dark:text-red-400" />
          </div>
          
          <h2 className="text-3xl font-bold text-white mb-3">
            Oops! Something went wrong
          </h2>
          
          <p className="text-gray-300 mb-8">
            We're sorry for the inconvenience. Please try again.
          </p>
          
          <div className="flex justify-center gap-3">
            <Button 
              variant="solid"
              color="primary"
              size="lg"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
            <Button 
              variant="outline" 
              color="default"
              size="lg"
              leftIcon={<Home className="w-4 h-4" />}
              onClick={() => window.location.href = '/test-selection'}
            >
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <LiveAPIProvider>
      <SalesAIAssessmentContent assessmentId={params.assessmentId} />
    </LiveAPIProvider>
  );
}
