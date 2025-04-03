import React, { useState, useEffect } from 'react';
import { StorySegment } from '../../types/Story';
import { Spinner } from './Spinner';
import { useStoryStore } from '../../store/storyState';

interface StoryDisplayProps {
  segment: StorySegment;
  onComplete?: () => void;
  showDebug?: boolean;
}

export const StoryDisplay: React.FC<StoryDisplayProps> = ({ 
  segment, 
  onComplete,
  showDebug = false
}) => {
  const [displayText, setDisplayText] = useState<string>('');
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fadeIn, setFadeIn] = useState<boolean>(false);
  const { storySummary } = useStoryStore();
  const textSpeed = 30; // milliseconds per character
  
  // Reset text display when segment changes
  useEffect(() => {
    setDisplayText('');
    setIsComplete(false);
    setIsLoading(true);
    setFadeIn(false);
    
    // Initial delay before starting to type text - allows for environment to render
    const initialDelay = setTimeout(() => {
      setIsLoading(false);
      setFadeIn(true);
      
      let index = 0;
      const timer = setInterval(() => {
        if (index < segment.text.length) {
          setDisplayText(prev => prev + segment.text.charAt(index));
          index++;
        } else {
          clearInterval(timer);
          setIsComplete(true);
          onComplete?.();
        }
      }, textSpeed);

      // Cleanup timer on component unmount or segment change
      return () => clearInterval(timer);
    }, 800); // 800ms delay to show loading spinner
    
    return () => clearTimeout(initialDelay);
  }, [segment.text]);

  // Skip animation on click
  const handleClick = () => {
    if (!isComplete) {
      setIsLoading(false);
      setDisplayText(segment.text);
      setIsComplete(true);
      onComplete?.();
    }
  };

  // Function to get box-shadow based on the environment mood
  const getBoxShadowForMood = () => {
    const moodColors = {
      happy: '0 0 15px rgba(255, 255, 150, 0.3)',
      mysterious: '0 0 15px rgba(128, 0, 128, 0.3)',
      tense: '0 0 15px rgba(255, 0, 0, 0.3)',
      peaceful: '0 0 15px rgba(100, 200, 255, 0.3)',
      exciting: '0 0 15px rgba(255, 165, 0, 0.3)',
      sad: '0 0 15px rgba(0, 0, 150, 0.3)'
    };
    
    return moodColors[segment.metadata.mood as keyof typeof moodColors] || '0 0 15px rgba(0, 0, 0, 0.3)';
  };

  return (
    <div 
      className={`bg-black bg-opacity-70 p-6 rounded-lg cursor-pointer min-h-[100px] flex items-center justify-center 
                transition-all duration-700 border border-gray-800 backdrop-blur-sm 
                ${fadeIn ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform -translate-y-4'}`}
      onClick={handleClick}
      style={{ 
        boxShadow: getBoxShadowForMood()
      }}
    >
      {isLoading ? (
        <Spinner size="medium" message="Loading story..." />
      ) : (
        <div className="prose prose-invert w-full">
          <p className="text-lg leading-relaxed">
            {displayText}
            {!isComplete && <span className="animate-pulse">|</span>}
          </p>
          
          {/* Debug summary display */}
          {showDebug && storySummary && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <h4 className="text-xs text-gray-400 mb-1">Story Summary (Debug)</h4>
              <p className="text-sm text-gray-300 italic">{storySummary}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 