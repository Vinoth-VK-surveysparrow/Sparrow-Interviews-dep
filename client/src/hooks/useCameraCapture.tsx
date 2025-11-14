import { useState, useRef, useCallback, useEffect } from 'react';
import { useAssessment } from '@/contexts/AssessmentContext';

interface UseCameraCaptureProps {
  videoRef?: React.RefObject<HTMLVideoElement>;
}

interface UseCameraCaptureReturn {
  hasPermission: boolean;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  captureImage: () => string | null;
  capturedImages: string[];
  startAutoCapture: () => void;
  stopAutoCapture: () => void;
}

export function useCameraCapture({ videoRef }: UseCameraCaptureProps = {}): UseCameraCaptureReturn {
  const [hasPermission, setHasPermission] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { uploadImageToS3, isS3Ready } = useAssessment();

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 } 
      });
      streamRef.current = stream;
      
      if (videoRef && videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      setHasPermission(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
      setHasPermission(false);
    }
  }, [videoRef]);

  const stopCamera = useCallback(() => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          try {
            track.stop();
          } catch (error) {
            console.warn('Error stopping track:', error);
          }
        });
        streamRef.current = null;
      }
      if (videoRef && videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setHasPermission(false);
    } catch (error) {
      console.error('Error stopping camera:', error);
    }
  }, [videoRef]);

  const captureImage = useCallback((): string | null => {
    console.log('📸 captureImage called');

    if (!videoRef || !videoRef.current) {
      console.log('📸 No video ref available');
      return null;
    }

    if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
      console.log('📸 Video dimensions invalid:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
      return null;
    }

    console.log('📸 Creating canvas for image capture');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      console.error('📸 Failed to get canvas context');
      return null;
    }

    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    console.log('📸 Drawing image to canvas:', canvas.width, 'x', canvas.height);
    context.drawImage(videoRef.current, 0, 0);
    const imageUrl = canvas.toDataURL('image/jpeg', 0.8);

    // Add to local state for UI display
    setCapturedImages(prev => [...prev, imageUrl]);
    console.log('📸 Image added to local state');

    // Upload to S3 immediately if ready
    if (isS3Ready) {
      console.log('📸 S3 ready, uploading image...');

      // Convert canvas to blob synchronously and upload immediately
      canvas.toBlob((blob) => {
        if (blob) {
          console.log('📸 Canvas blob created, size:', blob.size, 'bytes');

          // Upload immediately - don't just catch errors, log success too
          uploadImageToS3(blob)
            .then(() => {
              console.log('✅ Image uploaded to S3 successfully');
            })
            .catch(error => {
              console.error('❌ Failed to upload image to S3:', error);
            });
        } else {
          console.error('❌ Failed to create blob from canvas');
        }
      }, 'image/jpeg', 0.8);
    } else {
      console.warn('⚠️ S3 not ready - image not uploaded');
    }

    return imageUrl;
  }, [uploadImageToS3, isS3Ready]);

  const startAutoCapture = useCallback(() => {
    if (intervalRef.current) {
      console.log('📸 Auto-capture already running');
      return;
    }

    console.log('📸 Starting auto-capture every 20 seconds');
    intervalRef.current = setInterval(() => {
      console.log('📸 Auto-capture interval triggered');
      captureImage();
    }, 20000); // Capture every 20 seconds
  }, [captureImage]);

  const stopAutoCapture = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log('📸 Auto-capture stopped');
    } else {
      console.log('📸 Auto-capture was not running');
    }
  }, []);

  // Removed duplicate functions

  useEffect(() => {
    return () => {
      stopAutoCapture();
      stopCamera();
    };
  }, [stopAutoCapture, stopCamera]);

  return {
    hasPermission,
    startCamera,
    stopCamera,
    captureImage,
    capturedImages,
    startAutoCapture,
    stopAutoCapture,
  };
}
