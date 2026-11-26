import React from 'react';
import { ScanLine } from 'lucide-react';
import type { ProcessedImageResult } from '../features/vision/presentation/acquisition/CameraEngine';
import { useI18n } from '../lib/i18n';

interface Props {
  image: ProcessedImageResult | null;
  onCancel: () => void;
}

export function ScanningScreen({ image, onCancel }: Props) {
  const { t } = useI18n();
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-gray-950 p-6 text-center text-white">
      {image && <img src={image.image} alt={t('camera_preview')}
        className="aspect-square w-52 max-w-full rounded-3xl bg-gray-900 object-contain sm:w-64" />}
      <div role="status" className="flex items-center gap-2 text-lg font-bold">
        <ScanLine aria-hidden="true" className="text-emerald-300 motion-safe:animate-pulse" />
        {t('camera_analyzing')}
      </div>
      <button type="button" onClick={onCancel} className="min-h-11 rounded-xl border border-white/30 px-5 py-2 font-semibold">
        {t('camera_cancel_processing')}
      </button>
    </div>
  );
}
