import React from 'react';

const DragHandle = () => {
  const handleMouseDown = (e) => {
    // Send event to Electron main process to begin dragging
    if (window.electronAPI && window.electronAPI.startDrag) {
      window.electronAPI.startDrag();
    }
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      className="absolute top-0 left-0 right-0 h-6 flex justify-center items-center cursor-move z-40 transition-opacity duration-300 opacity-0 hover:opacity-100 bg-gradient-to-b from-black/20 to-transparent"
      title="Drag to reposition Aria"
    >
      <div className="w-12 h-1 bg-white/45 rounded-full flex gap-1 justify-center items-center">
        {/* Grip dots */}
        <span className="w-1 h-1 bg-white/60 rounded-full" />
        <span className="w-1 h-1 bg-white/60 rounded-full" />
        <span className="w-1 h-1 bg-white/60 rounded-full" />
      </div>
    </div>
  );
};

export default DragHandle;
