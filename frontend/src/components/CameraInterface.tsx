import React, { useRef, useState, useCallback } from 'react';
import { useCameraState } from '../hooks/useAppState';
import { backendService } from '../services/backendService';
import { useDeviceDetection, getCameraConstraints, getButtonSizeClasses } from '../utils/deviceDetection';

export interface CameraInterfaceProps {
  onPhotoCapture?: (imageData: Blob) => void;
  onUploadComplete?: (analysisId: string) => void;
  className?: string;
}

export function CameraInterface({
  onPhotoCapture,
  onUploadComplete,
  className = ''
}: CameraInterfaceProps) {
  const cameraState = useCameraState();
  const deviceInfo = useDeviceDetection();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);

  // Handle both touch and click events consistently
  const handleButtonInteraction = (callback: () => void) => {
    return (event: React.MouseEvent | React.TouchEvent) => {
      event.preventDefault();
      callback();
    };
  };

  // Get responsive button classes
  const buttonSizeClasses = getButtonSizeClasses(deviceInfo);
  const primaryButtonClasses = `
    ${buttonSizeClasses} bg-blue-600 text-white rounded-lg font-medium
    hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500
    disabled:opacity-50 disabled:cursor-not-allowed
    transition-colors duration-200
    ${deviceInfo.hasTouch ? 'active:bg-blue-800' : ''}
  `;

  // Activate camera and request permissions
  const handleActivateCamera = useCallback(async () => {
    setError(null);
    
    try {
      cameraState.activate();
      
      // Get device-optimized camera constraints
      const constraints = getCameraConstraints(deviceInfo);
      
      // Request camera permissions
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      setStream(mediaStream);
      cameraState.setPermission(true);
      
      // Attach stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to access camera';
      setError(errorMessage);
      cameraState.setPermission(false);
      cameraState.deactivate();
      
      // Provide user-friendly error messages with device-specific guidance
      if (errorMessage.includes('Permission denied') || errorMessage.includes('NotAllowedError')) {
        setError(deviceInfo.isMobile 
          ? 'Camera permission denied. Please allow camera access in your browser settings and try again.'
          : 'Camera permission denied. Please allow camera access in your browser settings.'
        );
      } else if (errorMessage.includes('NotFoundError')) {
        setError(deviceInfo.isMobile 
          ? 'No camera found. You can still upload photos using the "Choose File" option.'
          : 'No camera found on this device. Please use the file upload option instead.'
        );
      } else {
        setError('Unable to access camera. Please check your device settings or use the file upload option.');
      }
    }
  }, [cameraState, deviceInfo]);

  // Deactivate camera and stop stream
  const handleDeactivateCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    cameraState.deactivate();
    setError(null);
  }, [stream, cameraState]);

  // Capture photo from video stream
  const handleCapturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (!context) return;
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert canvas to blob
    canvas.toBlob((blob) => {
      if (blob) {
        setCapturedBlob(blob);
        const imageUrl = URL.createObjectURL(blob);
        cameraState.setPreview(imageUrl);
        
        // Stop camera stream after capture
        handleDeactivateCamera();
        
        // Notify parent component
        if (onPhotoCapture) {
          onPhotoCapture(blob);
        }
      }
    }, 'image/jpeg', 0.9);
  }, [cameraState, handleDeactivateCamera, onPhotoCapture]);

  // Handle file input for devices without camera or as fallback
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file.');
      return;
    }
    
    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Image size exceeds 10MB limit. Please select a smaller image.');
      return;
    }
    
    setCapturedBlob(file);
    const imageUrl = URL.createObjectURL(file);
    cameraState.setPreview(imageUrl);
    
    if (onPhotoCapture) {
      onPhotoCapture(file);
    }
  }, [cameraState, onPhotoCapture]);

  // Upload photo to backend - now just passes the image to parent
  const handleUploadPhoto = useCallback(async () => {
    if (!capturedBlob) return;
    
    setError(null);
    cameraState.startUpload();
    
    try {
      // Instead of uploading directly, pass the image to parent component
      // The parent will handle sending it with the next voice message
      if (onUploadComplete) {
        // Generate a temporary ID for the image
        const tempId = `temp-${Date.now()}`;
        onUploadComplete(tempId);
      }
      
      cameraState.completeUpload('temp-upload-id');
      
      // Keep the image for later use with voice messages
      // Don't clean up the blob yet - it will be used when sending to /chat
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      cameraState.resetUpload();
    }
  }, [capturedBlob, cameraState, onUploadComplete]);

  // Retry upload after failure
  const handleRetryUpload = useCallback(() => {
    setError(null);
    handleUploadPhoto();
  }, [handleUploadPhoto]);

  // Cancel and retake photo
  const handleRetakePhoto = useCallback(() => {
    if (cameraState.previewImage) {
      URL.revokeObjectURL(cameraState.previewImage);
    }
    cameraState.setPreview(null);
    setCapturedBlob(null);
    setError(null);
  }, [cameraState]);

  // Get status text for user feedback
  const getStatusText = (): string => {
    if (cameraState.isUploading) {
      return `Uploading... ${cameraState.uploadProgress}%`;
    }
    if (cameraState.previewImage) {
      return 'Photo captured - Review and upload';
    }
    if (cameraState.isActive) {
      return 'Camera active - Position and capture';
    }
    return 'Ready to capture photo';
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
      {/* Header */}
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Photo Capture
        </h2>
        <p className="text-sm text-gray-600">
          {getStatusText()}
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
          {cameraState.isUploading && (
            <button
              onClick={handleRetryUpload}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Retry Upload
            </button>
          )}
        </div>
      )}

      {/* Camera View or Preview */}
      <div className="mb-4 relative bg-gray-900 rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
        {cameraState.previewImage ? (
          // Preview captured photo
          <img
            src={cameraState.previewImage}
            alt="Captured preview"
            className="w-full h-full object-contain"
          />
        ) : cameraState.isActive ? (
          // Live camera feed
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain"
          />
        ) : (
          // Placeholder when camera is inactive
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center text-gray-400">
              <svg
                className="w-16 h-16 mx-auto mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <p className="text-sm">Camera inactive</p>
            </div>
          </div>
        )}
        
        {/* Upload Progress Overlay */}
        {cameraState.isUploading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="text-center text-white">
              <div className="mb-2">
                <svg
                  className="animate-spin h-12 w-12 mx-auto"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
              <p className="text-sm font-medium">Uploading {cameraState.uploadProgress}%</p>
            </div>
          </div>
        )}
      </div>

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Hidden file input for fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Control Buttons */}
      <div className="space-y-2">
        {!cameraState.previewImage && !cameraState.isActive && (
          <div className="flex space-x-2">
            <button
              onClick={handleActivateCamera}
              disabled={cameraState.isUploading}
              className="
                flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium
                hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors duration-200
              "
            >
              Open Camera
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={cameraState.isUploading}
              className="
                flex-1 px-4 py-3 bg-gray-600 text-white rounded-lg font-medium
                hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors duration-200
              "
            >
              Choose File
            </button>
          </div>
        )}

        {cameraState.isActive && !cameraState.previewImage && (
          <div className="flex space-x-2">
            <button
              onClick={handleCapturePhoto}
              className="
                flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-medium
                hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500
                transition-colors duration-200
              "
            >
              Capture Photo
            </button>
            <button
              onClick={handleDeactivateCamera}
              className="
                px-4 py-3 bg-red-600 text-white rounded-lg font-medium
                hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500
                transition-colors duration-200
              "
            >
              Cancel
            </button>
          </div>
        )}

        {cameraState.previewImage && !cameraState.isUploading && (
          <div className="flex space-x-2">
            <button
              onClick={handleUploadPhoto}
              className="
                flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-medium
                hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500
                transition-colors duration-200
              "
            >
              Upload Photo
            </button>
            <button
              onClick={handleRetakePhoto}
              className="
                px-4 py-3 bg-gray-600 text-white rounded-lg font-medium
                hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500
                transition-colors duration-200
              "
            >
              Retake
            </button>
          </div>
        )}
      </div>

      {/* Permission Guidance */}
      {!cameraState.hasPermission && error && error.includes('permission') && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800 mb-2 font-medium">
            Camera Permission Required
          </p>
          <p className="text-xs text-blue-700">
            To use the camera feature, please allow camera access when prompted by your browser.
            You can also change this in your browser settings.
          </p>
        </div>
      )}
    </div>
  );
}

export default CameraInterface;
