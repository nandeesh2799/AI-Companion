import React from 'react';

const GlassPanel = ({ children, className = '', ...props }) => {
  return (
    <div 
      className={`glass-panel rounded-2xl p-4 text-white shadow-lg transition-all duration-300 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default GlassPanel;
