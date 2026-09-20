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

  const requestPermissions = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn("getUserMedia is not supported or not available in this environment.");
        setState(prev => ({ ...prev, hasPermission: false, status: 'UNAVAILABLE' }));
        return;
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: state.facingMode } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setState(prev => ({ ...prev, hasPermission: true, status: 'GRANTED', stream }));
    } catch (err: any) {
      console.warn("Camera permission denied or not available", err);
      if (err.name === 'NotAllowedError') {
        setState(prev => ({ ...prev, hasPermission: false, status: 'DENIED' }));
      } else {
        setState(prev => ({ ...prev, hasPermission: false, status: 'UNAVAILABLE' }));
      }
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
        state.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [state.stream]);

  const toggleCameraType = useCallback(() => {
    if (state.stream) {
      state.stream.getTracks().forEach(track => track.stop());
    }
    setState(prev => ({
      ...prev,
      facingMode: prev.facingMode === 'user' ? 'environment' : 'user'
    }));
    // We defer requesting permission to next render or explicit call
    setTimeout(() => {
      requestPermissions();
    }, 100);
  }, [state.stream, requestPermissions]);

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
