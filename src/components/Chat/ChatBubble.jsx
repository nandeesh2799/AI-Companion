import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ChatBubble = ({ text = '', visible = false }) => {
  // Parse text to style *actions* dynamically
  const renderFormattedText = (rawText) => {
    if (!rawText) return null;
    const parts = rawText.split(/(\*[^*]+\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('*') && part.endsWith('*')) {
        const actionContent = part.slice(1, -1);
        return (
          <span key={index} className="text-companion-pink italic font-medium">
            {actionContent}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <AnimatePresence>
      {visible && text && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -10 }}
          transition={{ type: 'spring', stiffness: 350, damping: 20 }}
          className="absolute top-2 left-4 right-4 z-20 no-drag"
        >
          <div className="relative glass-card rounded-2xl px-4 py-3 text-sm text-white shadow-xl">
            <p className="leading-relaxed font-semibold">{renderFormattedText(text)}</p>
            {/* Pointer arrow pointing down */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-white/10" />
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-t-[7px] border-t-black/30 blur-[1px]" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ChatBubble;
