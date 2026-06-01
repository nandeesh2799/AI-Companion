import React from 'react';
import AvatarSprite from './AvatarSprite';
import Live2DAvatar from './Live2DAvatar';

const AvatarCanvas = ({ 
  avatarType = '2d',
  avatarPath = '',
  currentEmotion = 'idle', 
  isSpeaking = false, 
  isListening = false 
}) => {

  return (
    <div className="relative h-[340px] w-[240px] flex items-center justify-center">
      {avatarType === 'live2d' && avatarPath ? (
        <Live2DAvatar
          avatarPath={avatarPath}
          currentEmotion={currentEmotion}
          isSpeaking={isSpeaking}
          isListening={isListening}
        />
      ) : (
        <AvatarSprite 
          avatarPath={avatarPath}
          currentEmotion={currentEmotion} 
          isSpeaking={isSpeaking} 
          isListening={isListening} 
        />
      )}
    </div>
  );
};

export default AvatarCanvas;
