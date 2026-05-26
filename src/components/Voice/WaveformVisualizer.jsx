import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import eventBus from '../../engine/EventBus';

const WaveformVisualizer = ({ active = false }) => {
  const [amplitude, setAmplitude] = useState(0);

  useEffect(() => {
    if (!active) {
      setAmplitude(0);
      return;
    }

    // Capture volume levels from the active audio/mic stream
    const unsubscribe = eventBus.on('amplitude:update', (amp) => {
      setAmplitude(amp);
    });

    return () => unsubscribe();
  }, [active]);

  if (!active) return null;

  return (
    <div className="absolute bottom-[140px] left-0 right-0 flex justify-center items-end h-8 gap-[3px] pointer-events-none z-10">
      {[...Array(12)].map((_, i) => {
        // Distribute height patterns across bars based on amplitude and offset
        const scale = 0.2 + (Math.sin((i / 11) * Math.PI) * 0.8 * amplitude);
        const height = Math.max(scale * 32, 4);

        return (
          <motion.div
            key={i}
            animate={{ height: height }}
            transition={{ type: 'spring', stiffness: 450, damping: 15 }}
            className="w-1 rounded-t bg-gradient-to-t from-companion-blue to-companion-pink"
          />
        );
      })}
    </div>
  );
};

export default WaveformVisualizer;
