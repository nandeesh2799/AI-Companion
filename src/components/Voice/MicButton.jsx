import React from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Loader2, Volume2, Eye } from 'lucide-react';

const MicButton = ({ 
  status = 'idle', // 'idle', 'listening', 'thinking', 'speaking'
  inputLevel = 0,
  enableVision = false,
  onToggleVision = () => {},
  isMuted = false,
  onToggleMute = () => {}
}) => {
  
  // Outer circle scale based on live microphone amplitude level
  const outerScale = (status === 'listening' && !isMuted) ? 1.0 + inputLevel * 0.45 : 1.0;

  return (
    <div className="absolute top-[52px] right-[4px] flex flex-col items-center no-drag z-30">
      
      {/* Main Record Button */}
      <div className="relative">
        {/* Breathing / Pulse wave rings */}
        <AnimatePresenceOuterRing status={status} outerScale={outerScale} isMuted={isMuted} />

        <motion.button
          onClick={onToggleMute}
          animate={{ scale: (status === 'listening' && !isMuted) ? 0.95 : 1 }}
          className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center border text-white shadow-lg cursor-pointer transition-all duration-300 ${
            isMuted
              ? 'bg-gray-700/50 border-gray-600 text-gray-400 hover:bg-gray-700/70 hover:text-gray-300 shadow-none'
              : status === 'listening'
              ? 'bg-red-500 border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.5)]'
              : status === 'speaking'
              ? 'bg-companion-pink border-companion-pink/50'
              : 'bg-companion-pink border-companion-pink/30 hover:bg-companion-pink/95 shadow-[0_0_10px_rgba(255,110,180,0.35)]'
          }`}
          title={isMuted ? "Unmute Microphone (Auto-Mic)" : "Mute Microphone"}
        >
          {isMuted ? (
            <MicOff className="w-5 h-5" />
          ) : status === 'thinking' ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : status === 'speaking' ? (
            <Volume2 className="w-5 h-5 animate-pulse" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </motion.button>
      </div>
    </div>
  );
};

// Internal helper to render concentric pulsing backdrop layers
const AnimatePresenceOuterRing = ({ status, outerScale, isMuted }) => {
  if (isMuted) return null;
  
  if (status === 'listening') {
    return (
      <motion.div
        animate={{ scale: outerScale }}
        transition={{ type: 'spring', stiffness: 500, damping: 15 }}
        className="absolute inset-0 bg-red-500/20 rounded-full blur-[4px]"
      />
    );
  }
  
  if (status === 'idle') {
    return (
      <motion.div
        animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute inset-0 bg-companion-pink/20 rounded-full blur-[2px]"
      />
    );
  }

  return null;
};

export default MicButton;
