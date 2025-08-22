import { useState, useRef, useCallback, useEffect } from 'react';
import { useAssessment } from '@/contexts/AssessmentContext';

interface UseCameraCaptureReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  hasPermission: boolean;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  captureImage: () => string | null;
  capturedImages: string[];
  startAutoCapture: () => void;
  stopAutoCapture: () => void;
}

export function useCameraCapture(): UseCameraCaptureReturn {
  const [hasPermission, setHasPermission] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { uploadImageToS3, isS3Ready } = useAssessment();

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 } 
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      setHasPermission(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
      setHasPermission(false);
    }
  }, []);

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
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setHasPermission(false);
    } catch (error) {
      console.error('Error stopping camera:', error);
    }
  }, []);

  const captureImage = useCallback((): string | null => {
    if (!videoRef.current) {
      console.log('Cannot capture image - no video element');
      return null;
    }

    if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
      console.log('Cannot capture image - video not ready', {
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight,
        readyState: videoRef.current.readyState
      });
      return null;
    }

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;

    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    
    context.drawImage(videoRef.current, 0, 0);
    const imageUrl = canvas.toDataURL('image/jpeg', 0.8);
    
    console.log('Image captured successfully', { 
      width: canvas.width, 
      height: canvas.height,
      imageSize: imageUrl.length
    });
    
    // Add to local state for UI display
    setCapturedImages(prev => [...prev, imageUrl]);
    
    // Upload to S3 immediately if ready
    if (isS3Ready) {
      console.log('Uploading captured image to S3 immediately...');
      
      // Convert canvas to blob synchronously and upload immediately
      canvas.toBlob((blob) => {
        if (blob) {
          console.log('Image blob created, uploading to S3:', {
            size: blob.size,
            type: blob.type
          });
          
          // Upload immediately - don't just catch errors, log success too
          uploadImageToS3(blob)
            .then(() => {
              console.log('✅ Image uploaded successfully to S3');
            })
            .catch(error => {
              console.error('❌ Failed to upload image to S3:', error);
            });
        } else {
          console.error('Failed to create blob from canvas');
        }
      }, 'image/jpeg', 0.8);
    } else {
      console.warn('S3 not ready - image not uploaded');
    }
    
    return imageUrl;
  }, [uploadImageToS3, isS3Ready]);

  const startAutoCapture = useCallback(() => {
    if (intervalRef.current) {
      console.log('📷 Auto capture already running');
      return;
    }
    
    console.log('📷 Starting auto capture every 5 seconds');
    intervalRef.current = setInterval(() => {
      console.log('📷 Auto capture interval triggered - capturing and uploading image...');
      captureImage();
    }, 20000); // Capture every 20 seconds
  }, [captureImage]);

  const stopAutoCapture = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log('📷 Auto capture stopped');
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
    videoRef,
    hasPermission,
    startCamera,
    stopCamera,
    captureImage,
    capturedImages,
    startAutoCapture,
    stopAutoCapture,
  };
}
