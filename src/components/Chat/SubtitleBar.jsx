import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SubtitleBar = ({ text = '', name = 'Aria', visible = false }) => {
  const [words, setWords] = useState([]);

  useEffect(() => {
    if (text) {
      setWords(text.split(' '));
    } else {
      setWords([]);
    }
  }, [text]);

  return (
    <AnimatePresence>
      {visible && text && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          className="absolute top-8 left-3 right-12 z-20 no-drag"
        >
          <div className="glass-panel flex items-start px-3 py-2 rounded-xl shadow-lg border border-white/5 gap-2">
            <span className="text-companion-pink font-bold drop-shadow-[0_0_8px_rgba(255,110,180,0.6)] shrink-0 select-none text-xs uppercase tracking-wider mt-0.5">
              {name}:
            </span>
            <div className="text-xs font-semibold text-gray-100 flex flex-wrap gap-x-1 items-center overflow-y-auto leading-tight">
              {words.map((word, idx) => (
                <motion.span
                  key={idx}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.04, duration: 0.15 }}
                >
                  {word}
                </motion.span>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SubtitleBar;
