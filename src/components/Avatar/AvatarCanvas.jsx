import React from 'react';
import AvatarSprite from './AvatarSprite';

const AvatarCanvas = ({ 
  currentEmotion = 'idle', 
  isSpeaking = false, 
  isListening = false 
}) => {

  return (
    <div className="relative h-[320px] w-[220px] flex items-center justify-center">
      <AvatarSprite 
        currentEmotion={currentEmotion} 
        isSpeaking={isSpeaking} 
        isListening={isListening} 
      />
    </div>
  );
};

export default AvatarCanvas;
