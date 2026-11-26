import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraSession } from './CameraEngine';

export function useCameraEngine() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<CameraSession | null>(null);
  const facingMode = useRef<'environment' | 'user'>('environment');
  const [status, setStatus] = useState<CameraSession['status']>('INITIAL');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [canSwitch, setCanSwitch] = useState(false);

  useEffect(() => {
    const session = new CameraSession({ onStatusChange: setStatus, onStream: setStream });
    sessionRef.current = session;
    const stopWhenHidden = () => {
      if (document.hidden) session.stop();
    };
    document.addEventListener('visibilitychange', stopWhenHidden);
    window.addEventListener('pagehide', stop);
    function stop() { session.stop(); }
    return () => {
      document.removeEventListener('visibilitychange', stopWhenHidden);
      window.removeEventListener('pagehide', stop);
      session.unmount();
      sessionRef.current = null;
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    let active = true;
    if (stream) {
      void navigator.mediaDevices.enumerateDevices().then(devices => {
        if (active) setCanSwitch(devices.filter(device => device.kind === 'videoinput').length > 1);
      }).catch(() => { if (active) setCanSwitch(false); });
    }
    return () => {
      active = false;
      video.srcObject = null;
    };
  }, [stream]);

  const start = useCallback(() => {
    void sessionRef.current?.start(facingMode.current).catch(() => {
      // The session publishes the permission or device error status.
    });
  }, []);

  const switchLens = async () => {
    const session = sessionRef.current;
    if (!session?.stream || !canSwitch) return;
    const previous = facingMode.current;
    const next = previous === 'environment' ? 'user' : 'environment';
    try {
      if (await session.start(next)) facingMode.current = next;
    } catch {
      // Some devices list auxiliary cameras that a WebView cannot open.
      setCanSwitch(false);
      if (sessionRef.current === session) await session.start(previous).catch(() => {});
    }
  };

  return { videoRef, status, stream, start, canSwitch, switchLens, stop: () => sessionRef.current?.stop() };
}

export { CameraSession } from './CameraEngine';
