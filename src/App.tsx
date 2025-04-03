import React, { useEffect, useState } from 'react';
import { BasicEnvironment } from './components/BasicEnvironment';
import { StoryDisplay } from './components/ui/StoryDisplay';
import { ChoiceInterface } from './components/ui/ChoiceInterface';
import { LoadingIndicator } from './components/ui/LoadingIndicator';
import { useStoryGeneration } from './hooks/useStoryGeneration';
import { useStoryStore } from './store/storyState';
import { Choice } from './types/Story';
import { initializeONNX } from './services/storyGeneration';
import './styles/environment.css';

// Default environment to show during loading
const DEFAULT_ENVIRONMENT = {
  baseEnvironment: 'forest',
  lighting: {
    intensity: 1.2,
    color: '#fdf4c4',
    ambient: 0.6,
    shadows: true
  },
  atmosphere: {
    fog: true,
    fogDensity: 0.02,
    fogColor: '#d8e8f0'
  },
  props: []
};

// Default metadata to use during loading
const DEFAULT_METADATA = {
  mood: 'mysterious',
  location: 'forest',
  timeOfDay: 'day',
  weatherConditions: 'clear'
};

const App: React.FC = () => {
  const { currentSegment, storyHistory, isLoading, error, downloadProgress, currentFile } = useStoryStore();
  const { generateStoryStart, generateNextSegment } = useStoryGeneration();
  const [storyComplete, setStoryComplete] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initializationStep, setInitializationStep] = useState<string>('Starting up...');

  useEffect(() => {
    let mounted = true;
    let retryCount = 0;
    const maxRetries = 3;

    // Initialize ONNX as early as possible
    const preloadONNX = async () => {
      try {
        if (!mounted) return;
        
        setIsInitializing(true);
        setInitializationStep('Initializing ONNX runtime...');
        
        await initializeONNX();
        
        if (!mounted) return;
        setInitializationStep('Starting story generation...');
        
        await generateStoryStart();
        
        if (!mounted) return;
        setInitializationStep('Ready');
        setIsInitializing(false);
      } catch (error) {
        console.error('Initialization error:', error);
        
        if (!mounted) return;
        
        if (retryCount < maxRetries) {
          retryCount++;
          setInitializationStep(`Retrying initialization (attempt ${retryCount}/${maxRetries})...`);
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 2000));
          await preloadONNX();
        } else {
          setInitializationStep('Failed to initialize. Please refresh the page.');
          setIsInitializing(false);
        }
      }
    };

    preloadONNX();

    return () => {
      mounted = false;
    };
  }, [generateStoryStart]);

  // Get the previous story segment to enable smooth transitions
  const getPreviousSegment = () => {
    if (storyHistory.length < 2) return undefined;
    return storyHistory[storyHistory.length - 2];
  };

  // Handle choice selection
  const handleChoiceSelected = (choice: Choice) => {
    setStoryComplete(false);
    
    // Store the animation effect from this choice in the environment
    if (choice.environmentImpact.animationEffect) {
      const { transitionType, intensity, duration } = choice.environmentImpact.animationEffect;
      
      // Add animation effect to environment as a prop for the BasicEnvironment to use
      const animationProp = {
        type: 'animationEffect',
        position: [
          transitionType === 'fade' ? 0 : transitionType === 'slide' ? 1 : 2, // Map type to number
          intensity || 1,
          duration || 2
        ] as [number, number, number],
        scale: [intensity || 1, 1, 1] as [number, number, number]
      };
      
      // Add the animation prop to the current segment
      if (currentSegment) {
        currentSegment.environment.props = [
          ...currentSegment.environment.props.filter(p => p.type !== 'animationEffect'),
          animationProp
        ];
      }
    }
    
    generateNextSegment(choice);
  };

  // Determine what environment and metadata to show
  const environmentToShow = currentSegment ? currentSegment.environment : DEFAULT_ENVIRONMENT;
  const metadataToShow = currentSegment ? currentSegment.metadata : DEFAULT_METADATA;
  const previousSegment = getPreviousSegment();

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Basic Environment - always shown regardless of loading state */}
      <div className="absolute inset-0 z-0">
        <BasicEnvironment 
          environmentDescription={environmentToShow}
          metadata={metadataToShow}
          previousMetadata={previousSegment?.metadata}
        />
      </div>
      
      {/* Loading overlay - shown during initialization or loading */}
      {(isInitializing || isLoading || error) && (
        <LoadingIndicator
          message={isInitializing ? initializationStep : isLoading ? "Loading story generator..." : undefined}
          error={error}
          onRetry={() => {
            setIsInitializing(true);
            setInitializationStep('Retrying initialization...');
            generateStoryStart();
          }}
          progress={downloadProgress}
          currentFile={currentFile}
          isOverlay={true}
        />
      )}
      
      {/* UI overlay - shown when story is loaded */}
      {currentSegment && (
        <div className="absolute inset-x-0 bottom-0 z-10 p-6" style={{ position: 'absolute', top: '20vh'}}>
          <div className="max-w-2xl mx-auto">
            <StoryDisplay 
              segment={currentSegment}
              onComplete={() => setStoryComplete(true)}
            />
            
            <ChoiceInterface 
              choices={currentSegment.choices}
              onChoiceSelected={handleChoiceSelected}
              isVisible={storyComplete}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default App; 