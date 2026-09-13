import { useState, useEffect, useCallback, useRef } from 'react';
import type { GPSPosition } from '../types';

export interface GeolocationState {
  position: GPSPosition | null;
  isWatching: boolean;
  error: string | null;
  permissionState: PermissionState | 'unsupported';
}

const DELHI_FALLBACK: GPSPosition = {
  latitude: 28.6139,
  longitude: 77.2090,
  accuracy: 12,
  timestamp: Date.now(),
  isReal: false,
};

export function useGeolocation(options?: PositionOptions) {
  const [state, setState] = useState<GeolocationState>({
    position: null,
    isWatching: false,
    error: null,
    permissionState: 'unsupported',
  });

  const watchIdRef = useRef<number | null>(null);
  const fallbackUsedRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const checkPermission = useCallback(async () => {
    if (!navigator.permissions) {
      setState(prev => ({ ...prev, permissionState: 'unsupported' }));
      return;
    }

    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      setState(prev => ({ ...prev, permissionState: permission.state }));

      permission.onchange = () => {
        setState(prev => ({ ...prev, permissionState: permission.state }));
      };
    } catch {
      setState(prev => ({ ...prev, permissionState: 'unsupported' }));
    }
  }, []);

  const startWatching = useCallback((useFallback: boolean = false) => {
    if (useFallback) {
      fallbackUsedRef.current = true;
      setState(prev => ({
        ...prev,
        position: {
          ...DELHI_FALLBACK,
          timestamp: Date.now(),
        },
        isWatching: true,
        error: 'Using demo GPS (Delhi)',
      }));
      return;
    }

    if (!navigator.geolocation) {
      setState(prev => ({ ...prev, error: 'Geolocation not supported' }));
      return;
    }

    const showError = (error: GeolocationPositionError) => {
      let errorMessage = 'GPS error';
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'GPS permission denied';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'GPS position unavailable';
          break;
        case error.TIMEOUT:
          errorMessage = 'GPS timeout';
          break;
      }
      setState(prev => ({ ...prev, error: errorMessage, isWatching: false }));
      fallbackUsedRef.current = false;

      if (error.code === error.PERMISSION_DENIED || error.code === error.TIMEOUT) {
        setTimeout(() => startWatching(true), 2000);
      }
    };

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    const defaultOptions: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000,
      ...optionsRef.current,
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        fallbackUsedRef.current = false;
        const gpsPosition: GPSPosition = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude ?? undefined,
          speed: position.coords.speed ?? undefined,
          heading: position.coords.heading ?? undefined,
          timestamp: position.timestamp,
          isReal: true,
        };
        setState(prev => ({
          ...prev,
          position: gpsPosition,
          isWatching: true,
          error: null,
        }));
      },
      showError,
      defaultOptions,
    );

    setState(prev => ({ ...prev, isWatching: true }));
  }, []);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    fallbackUsedRef.current = false;
    setState(prev => ({ ...prev, isWatching: false }));
  }, []);

  const requestPermission = useCallback(() => {
    if (!navigator.geolocation) {
      return Promise.reject(new Error('Geolocation not supported'));
    }

    return new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
      });
    });
  }, []);

  useEffect(() => {
    checkPermission();
    return () => {
      stopWatching();
    };
  }, [checkPermission, stopWatching]);

  const getCurrentGPS = useCallback(() => {
    return state.position
      ? { latitude: state.position.latitude, longitude: state.position.longitude }
      : null;
  }, [state.position]);

  return {
    ...state,
    startWatching,
    stopWatching,
    requestPermission,
    checkPermission,
    isUsingFallback: fallbackUsedRef.current,
    getCurrentGPS,
  };
}