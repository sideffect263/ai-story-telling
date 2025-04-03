import React, { useState, useEffect } from 'react';
import { Choice } from '../../types/Story';

interface ChoiceInterfaceProps {
  choices: Choice[];
  onChoiceSelected: (choice: Choice) => void;
  isVisible: boolean;
}

export const ChoiceInterface: React.FC<ChoiceInterfaceProps> = ({ 
  choices, 
  onChoiceSelected,
  isVisible
}) => {
  const [isRendered, setIsRendered] = useState(false);
  const [hoveredChoice, setHoveredChoice] = useState<number | null>(null);
  
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    if (isVisible) {
      // Delay rendering choices for a more natural flow
      timeout = setTimeout(() => {
        setIsRendered(true);
      }, 500); // 500ms delay after text is complete
    } else {
      setIsRendered(false);
    }
    
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [isVisible]);
  
  // Preview the environment impact when hovering over choices
  const handleMouseEnter = (index: number) => {
    setHoveredChoice(index);
    // Could add a preview effect here in the future
  };
  
  const handleMouseLeave = () => {
    setHoveredChoice(null);
  };
  
  if (!isVisible) return null;
  
  // Render choices with visual hints about their impact
  const renderChoice = (choice: Choice, index: number) => {
    // Determine button styling based on the choice's impact
    const isHovered = hoveredChoice === index;
    
    // Change border color based on animationEffect type
    const getBorderColor = () => {
      if (!choice.environmentImpact.animationEffect) return 'border-gray-700';
      
      switch (choice.environmentImpact.animationEffect.transitionType) {
        case 'slide': return 'border-blue-700';
        case 'zoom': return 'border-purple-700';
        case 'fade': return 'border-green-700';
        default: return 'border-gray-700';
      }
    };
    
    return (
      <button
        key={index}
        onClick={() => onChoiceSelected(choice)}
        disabled={!isRendered}
        className={`w-full p-4 bg-gray-800 border ${getBorderColor()} rounded-lg 
                  hover:bg-gray-700 hover:border-gray-500 transition-all duration-300
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                  transform ${isRendered ? `translate-y-0 opacity-100 delay-${index * 100}` : 'translate-y-2 opacity-0'}
                  ${isHovered ? 'scale-102 shadow-lg' : 'scale-100'}`}
        style={{ 
          transitionDelay: isRendered ? `${100 + (index * 100)}ms` : '0ms',
          boxShadow: isHovered ? '0 0 15px rgba(0, 0, 0, 0.3)' : 'none'
        }}
        onMouseEnter={() => handleMouseEnter(index)}
        onMouseLeave={handleMouseLeave}
      >
        <div className="flex items-center">
          <div className="flex-1">
            <span className="block text-left text-md font-medium">{choice.text}</span>
            
            {/* If we want to show a hint about the consequence */}
            {isHovered && (
              <span className="block text-left text-xs text-gray-400 mt-1 italic transition-all">
                {choice.consequence.substring(0, 30)}...
              </span>
            )}
          </div>
          
          {/* Visual indicator for the choice type */}
          <div className="ml-2 w-6 h-6 rounded-full flex items-center justify-center">
            {choice.environmentImpact.animationEffect?.transitionType === 'slide' && (
              <span className="text-blue-400">→</span>
            )}
            {choice.environmentImpact.animationEffect?.transitionType === 'zoom' && (
              <span className="text-purple-400">⊕</span>
            )}
            {choice.environmentImpact.animationEffect?.transitionType === 'fade' && (
              <span className="text-green-400">≈</span>
            )}
          </div>
        </div>
      </button>
    );
  };
  
  return (
    <div 
      className={`mt-6 space-y-3 transition-opacity duration-700 ${isRendered ? 'opacity-100' : 'opacity-0'}`}
      style={{display:'flex', justifyContent:'space-around', alignItems:'center'}}
    >
      {choices.map((choice, index) => renderChoice(choice, index))}
    </div>
  );
}; 