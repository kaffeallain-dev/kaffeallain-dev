import React from 'react';
import { motion } from 'motion/react';
import { ProcessedImageResult } from '../features/vision/presentation/acquisition/CameraEngine';

interface Props {
  image: ProcessedImageResult | null;
}

export function ScanningScreen({ image }: Props) {
  return (
    <div className="absolute inset-0 bg-gray-900 z-50 flex flex-col justify-center items-center">
      {image && (
        <div className="absolute inset-0 opacity-40">
          <img src={image.image} alt="Scan target" className="w-full h-full object-cover blur-sm" />
        </div>
      )}
      
      <div className="relative z-10 w-64 h-64 rounded-3xl overflow-hidden shadow-2xl shadow-emerald-500/20">
        {image ? (
          <img src={image.image} alt="Scan target" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gray-800"></div>
        )}
        
        {/* Scanning Line Animation */}
        <motion.div 
          initial={{ top: '-10%' }}
          animate={{ top: '110%' }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          className="absolute left-0 right-0 h-1 bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.8)]"
        />
      </div>

      <div className="relative z-10 mt-12 text-center">
        <h2 className="text-white text-xl font-bold mb-2">Analyzing your meal...</h2>
        <div className="flex space-x-1 justify-center items-center">
          <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="w-2 h-2 bg-emerald-400 rounded-full" />
          <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-2 h-2 bg-emerald-400 rounded-full" />
          <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-2 h-2 bg-emerald-400 rounded-full" />
        </div>
      </div>
    </div>
  );
}
