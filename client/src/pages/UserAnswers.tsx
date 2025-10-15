import React, { useState, useEffect, useRef } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from "@sparrowengg/twigs-react";
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ArrowLeft, ChevronLeft, ChevronRight, Play, Pause, Volume2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

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
    expires_in: number;
  };
}

// Custom Audio Player Components
const formatTime = (seconds: number = 0) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

const CustomSlider = ({
  value,
  onChange,
  className,
  disabled = false,
}: {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  disabled?: boolean;
}) => {
  return (
    <motion.div
      className={cn(
        "relative w-full h-1 bg-white/20 rounded-full",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
        className
      )}
      onClick={(e) => {
        if (disabled) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = (x / rect.width) * 100;
        onChange(Math.min(Math.max(percentage, 0), 100));
      }}
    >
      <motion.div
        className="absolute top-0 left-0 h-full bg-white rounded-full"
        style={{ width: `${value}%` }}
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      />
    </motion.div>
  );
};

const CustomAudioPlayer = ({
  src,
}: {
  src: string;
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [localAudioUrl, setLocalAudioUrl] = useState<string | null>(null);

  const downloadAudio = async () => {
    if (isDownloaded || !src) return;

    try {
      setIsDownloading(true);
      setDownloadProgress(0);

      const response = await fetch(src);
      const contentLength = response.headers.get('content-length');
      const total = parseInt(contentLength || '0', 10);

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        chunks.push(value);
        received += value.length;

        if (total > 0) {
          setDownloadProgress((received / total) * 100);
        }
      }

      const blob = new Blob(chunks as BlobPart[], { type: 'audio/webm' });
      const localUrl = URL.createObjectURL(blob);

      setLocalAudioUrl(localUrl);

      // Set the audio source to the local blob and wait for it to load
      if (audioRef.current) {
        audioRef.current.src = localUrl;
        audioRef.current.load(); // Force reload with new source
      }

    } catch (error) {
      console.error('Error downloading audio:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const togglePlay = async () => {
    if (!isDownloaded) {
      await downloadAudio();
      // Wait a bit for the audio to be ready after download
      setTimeout(() => {
        if (audioRef.current && isDownloaded && isAudioReady) {
          audioRef.current.play().catch(console.error);
          setIsPlaying(true);
        }
      }, 100);
      return;
    }

    if (audioRef.current && isAudioReady) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().catch(console.error);
        setIsPlaying(true);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const progress =
        (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(isFinite(progress) ? progress : 0);
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (value: number) => {
    if (audioRef.current && audioRef.current.duration && isAudioReady) {
      const time = (value / 100) * audioRef.current.duration;
      if (isFinite(time) && time >= 0 && time <= audioRef.current.duration) {
        audioRef.current.currentTime = time;
        setProgress(value);
        setCurrentTime(time);
      }
    }
  };


  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (localAudioUrl) {
        URL.revokeObjectURL(localAudioUrl);
      }
    };
  }, [localAudioUrl]);

  if (!src) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="relative flex flex-col w-full rounded-xl overflow-hidden bg-[#11111198] shadow-[0_0_20px_rgba(0,0,0,0.2)] backdrop-blur-sm p-1 h-auto"
        initial={{ opacity: 0, filter: "blur(10px)" }}
        animate={{ opacity: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, filter: "blur(10px)" }}
        transition={{
          duration: 0.3,
          ease: "easeInOut",
          delay: 0.1,
          type: "spring",
        }}
        layout
      >
        <audio
          ref={audioRef}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={() => {
            console.log('Audio metadata loaded, duration:', audioRef.current?.duration);
            if (audioRef.current && audioRef.current.duration && !isNaN(audioRef.current.duration)) {
              setDuration(audioRef.current.duration);
              setIsDownloaded(true);
              setIsAudioReady(true);
            }
          }}
          onCanPlay={() => {
            console.log('Audio can play');
            setIsAudioReady(true);
          }}
          onCanPlayThrough={() => {
            console.log('Audio can play through completely');
            setIsAudioReady(true);
          }}
          onLoadStart={() => {
            console.log('Audio load started');
            setIsAudioReady(false);
          }}
          onError={(e) => {
            console.error('Audio error:', e);
            setIsAudioReady(false);
          }}
          src={localAudioUrl || (isDownloaded ? '' : src)}
          preload="metadata"
          className="hidden"
        />

        <motion.div
          className="flex flex-col relative"
          layout
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >

          <motion.div className="flex flex-col w-full gap-y-0">
            {/* Slider */}
            <motion.div className="flex flex-col gap-y-0.5">
              <CustomSlider
                value={progress}
                onChange={handleSeek}
                disabled={!isAudioReady}
                className={cn("w-full", !isAudioReady && "opacity-50")}
              />
              <div className="flex items-center justify-between">
                <span className="text-white text-xs">
                  {formatTime(currentTime)}
                </span>
                <div className="flex items-center gap-2">
                  {!isAudioReady && (
                    <motion.div
                      className="h-3 w-3 border border-white border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                  )}
                  <span className="text-white text-xs">
                    {formatTime(duration)}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Controls */}
            <motion.div className="flex items-center justify-center w-full">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    togglePlay();
                  }}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20 hover:text-white h-8 w-8 p-0 rounded-full bg-white/10"
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <motion.div
                      className="h-4 w-4 border-2 border-white border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                  ) : isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
              </motion.div>

              {/* Download Progress Indicator */}
              {isDownloading && (
                <motion.div
                  className="ml-2 text-xs text-white/70"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {Math.round(downloadProgress)}%
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default function UserAnswers() {
  const [, params] = useRoute('/admin/user-answers/:userEmail/:assessmentId');
  const [, setLocation] = useLocation();

  const [answers, setAnswers] = useState<AnswerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    if (!params?.userEmail || !params?.assessmentId) {
      setError('Invalid parameters');
      setLoading(false);
      return;
    }

    fetchUserAnswers();
  }, [params?.userEmail, params?.assessmentId]);

  const fetchUserAnswers = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔍 UserAnswers: Fetching user answers with Firebase auth');
      
      // Import authenticated API service
      const { AuthenticatedApiService } = await import('@/lib/authenticatedApiService');
      const data: AnswerResponse = await AuthenticatedApiService.getUserAnswers({
        user_email: decodeURIComponent(params?.userEmail || ''),
        assessment_id: decodeURIComponent(params?.assessmentId || ''),
      });
      setAnswers(data);

    } catch (err) {
      console.error('Error fetching user answers:', err);
      setError(err instanceof Error ? err.message : 'Failed to load user answers');
    } finally {
      setLoading(false);
    }
  };

  const nextImage = () => {
    if (answers?.data?.images) {
      setCurrentImageIndex((prev) =>
        prev === answers.data.images.length - 1 ? 0 : prev + 1
      );
    }
  };

  const prevImage = () => {
    if (answers?.data?.images) {
      setCurrentImageIndex((prev) =>
        prev === 0 ? answers.data.images.length - 1 : prev - 1
      );
    }
  };


  const getQuestionDuration = (questionId: string): number | null => {
    if (!answers?.data?.logs?.logs?.interactions) return null;

    const interaction = answers.data.logs.logs.interactions.find(
      (interaction: Interaction) => interaction.question_id === questionId
    );

    return interaction ? interaction.duration_seconds : null;
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
            <span className="text-gray-600 dark:text-gray-300">Loading user answers...</span>
          </div>
        </div>
      </main>
    );
  }

  if (error || !answers || !answers.data) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <Button
            onClick={() => window.history.back()}
            variant="outline"
            size="sm"
            leftIcon={<ArrowLeft className="h-4 w-4" />}
          >
            Back
          </Button>

          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Error Loading Answers
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                {error || 'Failed to load user answers'}
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            onClick={() => window.history.back()}
            variant="outline"
            size="sm"
            leftIcon={<ArrowLeft className="h-4 w-4" />}
          >
            Back to Users
          </Button>

          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              User Answers
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {decodeURIComponent(params?.userEmail || '')} - {decodeURIComponent(params?.assessmentId || '')}
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Questions Section - Left Side */}
          <div className="lg:col-span-1 space-y-4">
            <div className="w-full">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Questions ({answers.data.questions?.questions?.length || 0})
              </h3>
              <Accordion type="single" collapsible className="w-full">
                {answers.data.questions?.questions ? answers.data.questions.questions.map((question, index) => {
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
                }) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No questions found.
                  </div>
                )}
              </Accordion>
            </div>
          </div>

          {/* Images and Audio Section - Right Side */}
          <div className="lg:col-span-1 space-y-6">
            {/* Images Section */}
            {answers?.data?.images && answers.data.images.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Images ({answers.data.image_count || answers.data.images.length})
                  </h4>
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {currentImageIndex + 1} / {answers.data.images.length}
                  </span>
                </div>

                <div className="relative inline-block ml-8">
                  {/* Left Navigation Button */}
                  {answers.data.images.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={prevImage}
                      leftIcon={<ChevronLeft className="h-4 w-4" />}
                      className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-800 border-gray-300 dark:border-gray-600 shadow-md"
                    ></Button>
                  )}

                  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden inline-block relative">
                    <img
                      src={answers.data.images[currentImageIndex]?.url}
                      alt={answers.data.images[currentImageIndex]?.filename}
                      className="max-w-full h-auto object-contain rounded-lg"
                      style={{ maxHeight: '500px', minHeight: '400px' }}
                    />

                    {/* Custom Audio Player Overlay */}
                    {answers.data.audio_url && (
                      <div className="absolute bottom-2 left-0 right-0 px-4">
                        <CustomAudioPlayer
                          src={answers.data.audio_url}
                        />
                      </div>
                    )}
                  </div>

                  {/* Right Navigation Button */}
                  {answers.data.images.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={nextImage}
                      rightIcon={<ChevronRight className="h-4 w-4" />}
                      className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-800 border-gray-300 dark:border-gray-600 shadow-md"
                    ></Button>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </main>
  );
}
