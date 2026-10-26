import { useState, useRef, useCallback, useEffect } from 'react';
import { CameraEngine, CameraEngineOptions, ProcessedImageResult } from './CameraEngine';

export interface CameraEngineState {
  hasPermission: boolean | null;
  status: 'INITIAL' | 'UNAVAILABLE' | 'DENIED' | 'GRANTED';
  isProcessing: boolean;
  facingMode: 'user' | 'environment';
  stream: MediaStream | null;
}

export function useCameraEngine() {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [state, setState] = useState<CameraEngineState>({
    hasPermission: null,
    status: 'INITIAL',
    isProcessing: false,
    facingMode: 'environment',
    stream: null
  });

  const isMountedRef = useRef<boolean>(true);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (activeStreamRef.current) {
        CameraEngine.stopTracks(activeStreamRef.current);
        activeStreamRef.current = null;
      }
    };
  }, []);

  const requestPermissions = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const ac = new AbortController();
    abortControllerRef.current = ac;

    try {
      const stream = await CameraEngine.requestStream(state.facingMode, { signal: ac.signal });

      // If unmounted or cancelled while getUserMedia was resolving (late stream arrival):
      if (!isMountedRef.current || ac.signal.aborted) {
        CameraEngine.stopTracks(stream);
        return;
      }

      if (activeStreamRef.current && activeStreamRef.current !== stream) {
        CameraEngine.stopTracks(activeStreamRef.current);
      }
      activeStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setState(prev => ({ ...prev, hasPermission: true, status: 'GRANTED', stream }));
    } catch (err: any) {
      if (ac.signal.aborted || !isMountedRef.current) {
        return;
      }
      console.warn("Camera permission denied or not available", err);
      const mappedStatus = CameraEngine.mapAcquisitionError(err);
      setState(prev => ({ ...prev, hasPermission: false, status: mappedStatus }));
    }
  }, [state.facingMode]);

  useEffect(() => {
    if (state.stream && videoRef.current && videoRef.current.srcObject !== state.stream) {
      videoRef.current.srcObject = state.stream;
    }
  }, [state.stream, state.status]);

  useEffect(() => {
    return () => {
      if (state.stream) {
        CameraEngine.stopTracks(state.stream);
      }
    };
  }, [state.stream]);

  const toggleCameraType = useCallback(() => {
    if (activeStreamRef.current) {
      CameraEngine.stopTracks(activeStreamRef.current);
      activeStreamRef.current = null;
    }
    setState(prev => ({
      ...prev,
      stream: null,
      facingMode: prev.facingMode === 'user' ? 'environment' : 'user'
    }));
    setTimeout(() => {
      if (isMountedRef.current) {
        requestPermissions();
      }
    }, 100);
  }, [requestPermissions]);

  const takePicture = useCallback(async (options?: CameraEngineOptions): Promise<ProcessedImageResult | null> => {
    if (state.isProcessing || !videoRef.current) return null;
    
    try {
      setState(prev => ({ ...prev, isProcessing: true }));
      const result = await CameraEngine.captureFromVideo(videoRef.current, options);
      return result;
    } catch (error) {
      console.error("[useCameraEngine] Error taking picture:", error);
      throw error;
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  }, [state.isProcessing]);

  const pickFromGallery = useCallback(async (options?: CameraEngineOptions): Promise<ProcessedImageResult | null> => {
    if (state.isProcessing) return null;
    
    try {
      setState(prev => ({ ...prev, isProcessing: true }));
      const result = await CameraEngine.pickFromGallery(options);
      return result;
    } catch (error) {
      console.error("[useCameraEngine] Error picking from gallery:", error);
      throw error;
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  }, [state.isProcessing]);

  return {
    videoRef,
    state,
    requestPermissions,
    toggleCameraType,
    takePicture,
    pickFromGallery
  };
}

export { CameraSession } from './CameraEngine';
