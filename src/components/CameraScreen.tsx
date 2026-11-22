import React, { useEffect, useRef, useState } from 'react';
import { Camera, Image as ImageIcon, RefreshCcw, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useCameraEngine } from '../features/vision/presentation/acquisition/useCameraEngine';
import { CameraEngine, type ProcessedImageResult } from '../features/vision/presentation/acquisition/CameraEngine';
import { useI18n } from '../lib/i18n';

interface Props {
  onCapture: (image: ProcessedImageResult) => void;
  onClose: () => void;
  onManualEntry: () => void;
  scanAvailable: boolean | null;
  scanLimit?: number;
  unavailableMessage?: string;
}

export function CameraScreen({ onCapture, onClose, onManualEntry, scanAvailable, scanLimit, unavailableMessage }: Props) {
  const { videoRef, status, stream, start, canSwitch, switchLens, stop } = useCameraEngine();
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);
  const inFlight = useRef(false);
  const [ready, setReady] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(false);
  const [preview, setPreview] = useState<ProcessedImageResult | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const openCamera = () => {
    setError(false);
    setReady(false);
    start();
  };

  const acquire = async (read: () => Promise<ProcessedImageResult>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setWorking(true);
    setError(false);
    try {
      const image = await read();
      if (!mounted.current) return;
      stop();
      setReady(false);
      setPreview(image);
    } catch {
      if (mounted.current) setError(true);
    } finally {
      inFlight.current = false;
      if (mounted.current) setWorking(false);
    }
  };

  const showLive = Boolean(stream) && !preview;
  const statusKey = status === 'DENIED' ? 'camera_denied_desc' : status === 'UNAVAILABLE'
    ? 'camera_unavailable_desc' : status === 'STARTING' ? 'camera_starting' : 'camera_choice';
  const buttonStyle = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ring-1 ring-white/20 disabled:opacity-50';

  return (
    <section className="flex h-full min-h-0 flex-col overflow-y-auto bg-gray-950 text-white">
      <header className="flex items-center justify-between gap-4 px-5 py-4">
        <h2 className="text-lg font-bold">{t('scan_photo')}</h2>
        <button type="button" aria-label={t('camera_close')} onClick={() => { stop(); onClose(); }}
          className="grid size-11 place-items-center rounded-full bg-white/10">
          <X size={22} />
        </button>
      </header>

      <div className="relative mx-4 flex min-h-40 flex-1 items-center justify-center overflow-hidden rounded-3xl bg-gray-900">
        <video ref={videoRef} autoPlay playsInline muted hidden={!showLive}
          onPlaying={() => setReady(true)}
          className="absolute inset-0 h-full w-full object-contain" />
        {showLive && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-[12%] rounded-3xl border-2 border-emerald-300/60" />
        )}
        {preview ? (
          <motion.img initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}
            src={preview.image} alt={t('camera_preview')} className="absolute inset-0 h-full w-full object-contain" />
        ) : !showLive && (
          <p role="status" className="max-w-xs px-5 py-6 text-center text-sm leading-relaxed text-gray-200">
            {t(working ? 'camera_preparing' : statusKey)}
          </p>
        )}
      </div>

      <div className="shrink-0 space-y-3 p-4 text-center">
        {error && <p role="alert" className="text-sm text-amber-200">{t('camera_photo_error')}</p>}
        {preview ? (
          <>
            {preview.quality < 0.7 && <p className="text-sm text-amber-200">{t('camera_quality_hint')}</p>}
            <p className="text-sm text-gray-200">
              {scanAvailable === false && unavailableMessage
                ? unavailableMessage
                : t(scanAvailable === null ? 'camera_checking_scan' : scanAvailable ? 'camera_upload_consent' : 'camera_preview_only')}
            </p>
            {scanAvailable && scanLimit && <p className="text-xs text-gray-300">{t('camera_scan_limit', { limit: scanLimit })}</p>}
            <div className="flex flex-wrap justify-center gap-3">
              <button type="button" className={buttonStyle} onClick={() => setPreview(null)}>{t('retry_photo')}</button>
              {scanAvailable && <motion.button type="button" whileTap={{ scale: 0.97 }}
                className={`${buttonStyle} bg-emerald-500 text-gray-950`} onClick={() => onCapture(preview)}>
                {t('camera_analyze')}
              </motion.button>}
            </div>
          </>
        ) : (
          <div className="flex flex-wrap justify-center gap-3">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden
              onChange={event => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = '';
                if (file) void acquire(() => CameraEngine.processFile(file));
              }} />
            <button type="button" disabled={working} aria-label={t('camera_gallery')} className={buttonStyle}
              onClick={() => fileRef.current?.click()}>
              <ImageIcon size={19} aria-hidden="true" />{t('camera_upload_photo')}
            </button>
            {showLive ? (
              <>
                <motion.button type="button" disabled={!ready || working} whileTap={{ scale: 0.95 }}
                  className={`${buttonStyle} bg-emerald-500 text-gray-950`}
                  onClick={() => videoRef.current && void acquire(() => CameraEngine.captureFromVideo(videoRef.current!))}>
                  <Camera size={19} aria-hidden="true" />{t('camera_capture')}
                </motion.button>
                {canSwitch && <button type="button" disabled={working} className={buttonStyle} aria-label={t('camera_switch')}
                  onClick={() => { setReady(false); void switchLens(); }}>
                  <RefreshCcw size={19} aria-hidden="true" />
                </button>}
              </>
            ) : (
              <motion.button type="button" disabled={working || status === 'STARTING'} whileTap={{ scale: 0.97 }}
                className={`${buttonStyle} bg-emerald-500 text-gray-950`} onClick={openCamera}>
                <Camera size={19} aria-hidden="true" />
                {t(status === 'DENIED' || status === 'UNAVAILABLE' ? 'camera_retry' : 'camera_open')}
              </motion.button>
            )}
          </div>
        )}
        <button type="button" onClick={() => { stop(); onManualEntry(); }}
          className="min-h-11 rounded-xl px-4 text-sm font-semibold text-emerald-200 hover:bg-white/10">
          {t('camera_enter_manually')}
        </button>
      </div>
    </section>
  );
}
