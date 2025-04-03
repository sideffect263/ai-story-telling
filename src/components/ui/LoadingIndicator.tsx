import React from 'react';

interface LoadingIndicatorProps {
  message?: string;
  error?: string | null;
  onRetry?: () => void;
  progress?: number;
  currentFile?: string;
  isOverlay?: boolean;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  message = 'Loading...',
  error = null,
  onRetry,
  progress = 0,
  currentFile,
  isOverlay = false
}) => {
  const containerClasses = `fixed inset-0 flex items-center justify-center z-50
    ${isOverlay ? 'bg-black bg-opacity-40 backdrop-blur-sm' : 'bg-black bg-opacity-70'}`;

  if (error) {
    return (
      <div className={containerClasses}>
        <div className="bg-red-900 p-6 rounded-lg max-w-md text-white shadow-xl border border-red-700">
          <h2 className="text-xl font-bold mb-4">Something went wrong</h2>
          <p className="mb-4">{error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 bg-red-700 rounded hover:bg-red-600 transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      <div className="bg-gray-900 bg-opacity-80 p-6 rounded-lg max-w-md text-white text-center 
                    shadow-xl border border-gray-700 transition-all duration-500">
        <div className="text-2xl mb-6 font-semibold text-gradient">
          {message}
        </div>
        <div className="w-full bg-gray-800 rounded-full h-3 mb-4 overflow-hidden shadow-inner">
          <div
            className="bg-blue-500 h-3 rounded-full transition-all duration-300 shadow-lg"
            style={{ 
              width: `${Math.min(100, Math.max(0, progress))}%`,
              background: 'linear-gradient(90deg, #4f46e5, #60a5fa)'
            }}
          ></div>
        </div>
        {currentFile && (
          <p className="text-gray-300 text-sm mb-2">Loading: {currentFile}</p>
        )}
        <p className="text-gray-400 text-sm">
          {progress > 0 ? `${Math.round(progress)}% complete` : 'Preparing your adventure...'}
        </p>
      </div>
    </div>
  );
}; 