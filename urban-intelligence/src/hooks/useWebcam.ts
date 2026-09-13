import { useState, useEffect, useRef, useCallback } from 'react';

export interface WebcamState {
  stream: MediaStream | null;
  /** True once a MediaStream has been successfully acquired. */
  isActive: boolean;
  isLoading: boolean;
  error: string | null;
  facingMode: 'user' | 'environment';
  /** True only when the <video> element is actually playing frames (readyState >= 2 and videoWidth > 0). */
  videoReady: boolean;
  videoWidth: number;
  videoHeight: number;
  deviceLabel: string | null;
}

const isDev = import.meta.env.DEV;

function devLog(...args: unknown[]) {
  if (isDev) console.log('[Camera]', ...args);
}
function devWarn(...args: unknown[]) {
  if (isDev) console.warn('[Camera]', ...args);
}

function errorMessageFor(err: unknown): string {
  if (err instanceof DOMException) {
    switch (err.name) {
      case 'NotAllowedError':
        return 'Camera permission denied — allow camera access in the browser';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'No camera found on this device';
      case 'NotReadableError':
      case 'TrackStartError':
        return 'Camera is in use by another application';
      case 'OverconstrainedError':
        return 'Camera does not support the requested settings';
      case 'SecurityError':
        return 'Camera blocked by browser security policy (HTTPS required)';
      default:
        return `Camera error: ${err.name}`;
    }
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

function detectFacingMode(label: string, fallback: 'user' | 'environment'): 'user' | 'environment' {
  const lower = label.toLowerCase();
  if (lower.includes('back') || lower.includes('rear') || lower.includes('environment')) return 'environment';
  if (lower.includes('front')) return 'user';
  return fallback;
}

export function useWebcam() {
  const [state, setState] = useState<WebcamState>({
    stream: null,
    isActive: false,
    isLoading: false,
    error: null,
    facingMode: 'user',
    videoReady: false,
    videoWidth: 0,
    videoHeight: 0,
    deviceLabel: null,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const devicesRef = useRef<MediaDeviceInfo[]>([]);
  const deviceIndexRef = useRef(0);
  const facingModeRef = useRef<'user' | 'environment'>('user');

  const enumerateVideoDevices = useCallback(async (): Promise<MediaDeviceInfo[]> => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return [];
      const all = await navigator.mediaDevices.enumerateDevices();
      const videos = all.filter(d => d.kind === 'videoinput');
      if (videos.length > 0) devicesRef.current = videos;
      devLog('video devices:', videos.map(d => `${d.label || '(no label)'}`).join(' | '));
      return videos;
    } catch {
      return [];
    }
  }, []);

  /** Attaches a stream to the (always-mounted) <video> element and starts playback. */
  const attachStream = useCallback((stream: MediaStream) => {
    const video = videoRef.current;
    if (!video) return;
    if (video.srcObject !== stream) video.srcObject = stream;
    const promise = video.play();
    if (promise) {
      promise.catch(() => {
        devWarn('video.play() rejected');
      });
    }
  }, []);

  const applyStream = useCallback(
    (stream: MediaStream, facingMode: 'user' | 'environment', deviceLabel: string | null) => {
      streamRef.current = stream;
      facingModeRef.current = facingMode;
      attachStream(stream);
      setState(prev => ({
        ...prev,
        stream,
        facingMode,
        deviceLabel,
        isActive: true,
        isLoading: false,
        error: null,
        videoReady: false,
      }));
    },
    [attachStream],
  );

  const failWithError = useCallback((message: string) => {
    streamRef.current = null;
    setState(prev => ({
      ...prev,
      stream: null,
      isActive: false,
      isLoading: false,
      error: message,
      videoReady: false,
    }));
  }, []);

  const openStream = useCallback(async (constraints: MediaStreamConstraints): Promise<MediaStream> => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new DOMException('getUserMedia is not available on this browser (may require HTTPS)', 'NotSupportedError');
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const videoTrack = stream.getVideoTracks()[0];
      devLog('acquired stream:', videoTrack?.label || '(no track label)', JSON.stringify(constraints));
      return stream;
    } catch (err) {
      devWarn('openStream failed, retrying with unfiltered constraints:', errorMessageFor(err));
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      const videoTrack = stream.getVideoTracks()[0];
      devLog('acquired fallback stream:', videoTrack?.label || '(no track label)');
      return stream;
    }
  }, []);

  const startCamera = useCallback(
    async (facingMode: 'user' | 'environment' = 'user') => {
      const videoDevices = await enumerateVideoDevices();
      if (videoDevices.length > 0) {
        // Prefer an exact deviceId matching the requested facing mode; fall back to the first camera.
        const preferred = videoDevices.find(d => detectFacingMode(d.label, facingMode) === facingMode);
        const first = videoDevices[0];
        const target = preferred ?? first;
        deviceIndexRef.current = videoDevices.indexOf(target);
        setState(prev => ({ ...prev, isLoading: true, error: null }));
        try {
          const stream = await openStream({
            audio: false,
            video: { deviceId: { exact: target.deviceId } },
          });
          applyStream(stream, detectFacingMode(target.label, facingMode), target.label || null);
          return;
        } catch (err) {
          devWarn('startCamera by deviceId failed:', errorMessageFor(err));
        }
      }

      setState(prev => ({ ...prev, isLoading: true, error: null }));
      try {
        const stream = await openStream({
          audio: false,
          video: {
            facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        applyStream(stream, facingMode, null);
      } catch (err) {
        failWithError(errorMessageFor(err));
      }
    },
    [applyStream, enumerateVideoDevices, failWithError, openStream],
  );

  const stopCamera = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }
    setState(prev => ({
      ...prev,
      stream: null,
      isActive: false,
      isLoading: false,
      error: null,
      videoReady: false,
      videoWidth: 0,
      videoHeight: 0,
    }));
  }, []);

  const switchCamera = useCallback(async () => {
    const currentFacing = state.facingMode;
    const videos = devicesRef.current.length > 0 ? devicesRef.current : await enumerateVideoDevices();
    let nextFacing: 'user' | 'environment' = currentFacing === 'user' ? 'environment' : 'user';
    let constraints: MediaStreamConstraints;

    if (videos.length > 1) {
      const nextIdx = (deviceIndexRef.current + 1) % videos.length;
      deviceIndexRef.current = nextIdx;
      const next = videos[nextIdx];
      constraints = { audio: false, video: { deviceId: { exact: next.deviceId } } };
      nextFacing = detectFacingMode(next.label, nextFacing);
    } else {
      constraints = {
        audio: false,
        video: { facingMode: nextFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
      };
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    stopCamera();
    try {
      const stream = await openStream(constraints);
      const label = videos[deviceIndexRef.current]?.label ?? null;
      applyStream(stream, nextFacing, label);
    } catch (err) {
      failWithError(errorMessageFor(err));
    }
  }, [state.facingMode, applyStream, enumerateVideoDevices, failWithError, openStream, stopCamera]);

  // Keep the stream attached to the video element even if the element mounts later.
  useEffect(() => {
    const stream = state.stream;
    const video = videoRef.current;
    if (!stream || !video) return;
    if (video.srcObject !== stream) {
      video.srcObject = stream;
      const promise = video.play();
      if (promise) promise.catch(() => {});
    }
  }, [state.stream]);

  // Track real playback readiness + dimensions from DOM events (truthful status).
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const markReady = () => {
      const ready = video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;
      setState(prev => ({
        ...prev,
        videoReady: prev.stream ? ready : false,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
      }));
      if (ready) devLog('video ready:', `${video.videoWidth}x${video.videoHeight}`);
    };

    video.addEventListener('loadedmetadata', markReady);
    video.addEventListener('playing', markReady);
    video.addEventListener('resize', markReady);
    if (video.readyState >= 1) markReady();

    return () => {
      video.removeEventListener('loadedmetadata', markReady);
      video.removeEventListener('playing', markReady);
      video.removeEventListener('resize', markReady);
    };
  }, []);

  // Stop the camera when the component unmounts.
  useEffect(() => {
    return () => {
      const stream = streamRef.current;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Enumerate device labels once after permission is granted.
  useEffect(() => {
    if (state.isActive) enumerateVideoDevices();
  }, [state.isActive, enumerateVideoDevices]);

  return {
    ...state,
    videoRef,
    startCamera,
    stopCamera,
    switchCamera,
  };
}

export default useWebcam;