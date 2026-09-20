import React, { useEffect } from 'react';
import { X, Zap, Image as ImageIcon, RefreshCcw } from 'lucide-react';
import { useCameraEngine } from '../features/vision/presentation/acquisition/useCameraEngine';
import { ProcessedImageResult } from '../features/vision/presentation/acquisition/CameraEngine';

interface Props {
  onCapture: (image: ProcessedImageResult) => void;
  onClose: () => void;
}

export function CameraScreen({ onCapture, onClose }: Props) {
  const { videoRef, state, requestPermissions, takePicture, toggleCameraType, pickFromGallery } = useCameraEngine();

  useEffect(() => {
    requestPermissions();
  }, [requestPermissions]);

  const handleCapture = async () => {
    const img = await takePicture();
    if (img) {
      onCapture(img);
    }
  };

  const handleGallery = async () => {
    const img = await pickFromGallery();
    if (img) {
      onCapture(img);
    }
  };

  return (
    <div className="absolute inset-0 bg-black z-50 flex flex-col">
      {/* Top Controls */}
      <div className="absolute top-0 left-0 right-0 p-6 pt-14 flex justify-between items-center z-20 bg-gradient-to-b from-black/50 to-transparent">
        <button onClick={onClose} className="p-2 bg-black/30 rounded-full text-white backdrop-blur-md">
          <X size={24} />
        </button>
        <button className="p-2 bg-black/30 rounded-full text-white backdrop-blur-md">
          <Zap size={24} />
        </button>
      </div>

      {/* Camera View */}
      <div className="flex-1 relative overflow-hidden bg-gray-900 rounded-3xl m-2 mt-24 mb-32">
        {state.status === 'UNAVAILABLE' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-30 bg-gray-900">
            <p className="text-white mb-2 font-bold text-lg">Camera unavailable in this preview</p>
            <p className="text-gray-400 mb-6 text-sm">Your browser or the preview environment is blocking the camera.</p>
            <div className="flex gap-4">
              <button onClick={requestPermissions} className="bg-emerald-600 text-white px-6 py-2 rounded-full font-bold shadow-lg shadow-emerald-500/20 active:scale-95 transition-transform">
                Retry Camera
              </button>
              <button onClick={handleGallery} className="bg-gray-800 text-white px-6 py-2 rounded-full font-bold border border-gray-700 active:scale-95 transition-transform">
                Upload Photo
              </button>
            </div>
          </div>
        ) : state.status === 'DENIED' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-30 bg-gray-900">
            <p className="text-white mb-2 font-bold text-lg">Camera Access Denied</p>
            <p className="text-gray-400 mb-6 text-sm">Please allow camera access in your browser settings to scan meals.</p>
            <div className="flex gap-4">
              <button onClick={requestPermissions} className="bg-emerald-600 text-white px-6 py-2 rounded-full font-bold shadow-lg shadow-emerald-500/20 active:scale-95 transition-transform">
                Retry
              </button>
              <button onClick={handleGallery} className="bg-gray-800 text-white px-6 py-2 rounded-full font-bold border border-gray-700 active:scale-95 transition-transform">
                Upload Photo
              </button>
            </div>
          </div>
        ) : state.status === 'INITIAL' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-30 bg-gray-900">
            <p className="text-white font-bold text-lg">Starting camera...</p>
          </div>
        ) : (
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        
        {/* Viewfinder Guide */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="w-[80%] h-[60%] border-2 border-white/30 rounded-3xl absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="w-8 h-8 border-t-2 border-l-2 border-emerald-400 absolute top-0 left-0 rounded-tl-3xl"></div>
            <div className="w-8 h-8 border-t-2 border-r-2 border-emerald-400 absolute top-0 right-0 rounded-tr-3xl"></div>
            <div className="w-8 h-8 border-b-2 border-l-2 border-emerald-400 absolute bottom-0 left-0 rounded-bl-3xl"></div>
            <div className="w-8 h-8 border-b-2 border-r-2 border-emerald-400 absolute bottom-0 right-0 rounded-br-3xl"></div>
          </div>
          <p className="text-white/70 text-center absolute top-[15%] w-full text-sm font-medium">Position food in frame</p>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 h-32 flex justify-around items-center px-8 pb-8 z-20">
        <button onClick={handleGallery} className="p-3 bg-gray-800 rounded-full text-white">
          <ImageIcon size={24} />
        </button>
        
        <button 
          onClick={handleCapture}
          disabled={state.isProcessing}
          className="w-20 h-20 bg-white rounded-full flex items-center justify-center p-1"
        >
          <div className="w-full h-full rounded-full border-4 border-emerald-500 bg-white shadow-lg transition-transform active:scale-95"></div>
        </button>

        <button onClick={toggleCameraType} className="p-3 bg-gray-800 rounded-full text-white">
          <RefreshCcw size={24} />
        </button>
      </div>
    </div>
  );
}
