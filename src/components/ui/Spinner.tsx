import React from 'react';

interface SpinnerProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ 
  size = 'medium',
  message 
}) => {
  const getSizeClass = () => {
    switch (size) {
      case 'small':
        return 'w-5 h-5';
      case 'large':
        return 'w-10 h-10';
      case 'medium':
      default:
        return 'w-8 h-8';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-2">
      <div className={`spinner ${getSizeClass()}`} />
      {message && (
        <div className="text-sm text-gradient">{message}</div>
      )}
    </div>
  );
}; 