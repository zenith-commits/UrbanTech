import { useState, useEffect, useRef, useCallback } from 'react';

export interface WebcamState {
  stream: MediaStream | null;
  isActive: boolean;
  isLoading: boolean;
  error: string | null;
  facingMode: 'user' | 'environment';
}

export function useWebcam() {
  const [state, setState] = useState<WebcamState>({
    stream: null,
    isActive: false,
    isLoading: false,
    error: null,
    facingMode: 'environment',
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async (facingMode: 'user' | 'environment' = 'environment') => {
    setState(prev => {
      if (prev.isLoading || prev.isActive) return prev;
      return { ...prev, isLoading: true, error: null };
    });

    let resolved = false;
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      resolved = true;
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setState(prev => ({
        ...prev,
        stream,
        isActive: true,
        isLoading: false,
        facingMode,
        error: null,
      }));
    } catch (err) {
      if (!resolved) {
        let errorMessage = 'Failed to access camera';

        if (err instanceof DOMException) {
          switch (err.name) {
            case 'NotAllowedError':
              errorMessage = 'Camera permission denied';
              break;
            case 'NotFoundError':
              errorMessage = 'No camera found';
              break;
            case 'NotReadableError':
              errorMessage = 'Camera is in use by another application';
              break;
            case 'OverconstrainedError':
              errorMessage = 'Camera constraints not supported';
              break;
            default:
              errorMessage = `Camera error: ${err.message}`;
          }
        }

        setState(prev => ({
          ...prev,
          isLoading: false,
          isActive: false,
          stream: null,
          error: errorMessage,
        }));
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setState(prev => ({
      ...prev,
      stream: null,
      isActive: false,
      isLoading: false,
      error: null,
    }));
  }, []);

  const switchCamera = useCallback(async () => {
    const newFacingMode = state.facingMode === 'user' ? 'environment' : 'user';
    stopCamera();
    await new Promise(resolve => setTimeout(resolve, 300));
    await startCamera(newFacingMode);
  }, [state.facingMode, startCamera, stopCamera]);

  useEffect(() => {
    return () => {
      const stream = streamRef.current;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return {
    ...state,
    videoRef,
    startCamera,
    stopCamera,
    switchCamera,
  };
}