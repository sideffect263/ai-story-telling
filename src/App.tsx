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

// Local storage keys
const STORY_SUMMARY_KEY = 'worlds_unfolding_summary';
const DEBUG_MODE_KEY = 'worlds_unfolding_debug';
const SEGMENTS_COUNT_KEY = 'worlds_unfolding_segments_count';

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
  const { 
    currentSegment, 
    storyHistory, 
    storySummary, 
    isLoading, 
    error, 
    downloadProgress, 
    currentFile, 
    updateStorySummary,
    segmentsSincePromptRefresh,
    resetSegmentCount 
  } = useStoryStore();
  const { generateStoryStart, generateNextSegment } = useStoryGeneration();
  const [storyComplete, setStoryComplete] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initializationStep, setInitializationStep] = useState<string>('Starting up...');
  const [debugMode, setDebugMode] = useState(false);
  const [isPromptRefreshing, setIsPromptRefreshing] = useState(false);

  // Load debug mode setting
  useEffect(() => {
    const savedDebugMode = localStorage.getItem(DEBUG_MODE_KEY);
    if (savedDebugMode === 'true') {
      setDebugMode(true);
    }
    
    // Add keyboard shortcut for debug mode toggle (Ctrl+Shift+D)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setDebugMode(prev => {
          const newValue = !prev;
          localStorage.setItem(DEBUG_MODE_KEY, String(newValue));
          return newValue;
        });
      }
      
      // Add keyboard shortcut for manual prompt refresh (Ctrl+Shift+R)
      if (e.ctrlKey && e.shiftKey && e.key === 'R' && debugMode) {
        e.preventDefault();
        // Only allow manual refresh if we have a current segment
        if (currentSegment) {
          console.log('Manual prompt refresh triggered');
          // Force a refresh by resetting the segment count to a high number
          localStorage.setItem(SEGMENTS_COUNT_KEY, '999');
          resetSegmentCount();
          setIsPromptRefreshing(true);
          setTimeout(() => setIsPromptRefreshing(false), 1500);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [debugMode, currentSegment, resetSegmentCount]);

  // Load saved story data from localStorage on initial mount
  useEffect(() => {
    try {
      const savedSummary = localStorage.getItem(STORY_SUMMARY_KEY);
      if (savedSummary) {
        updateStorySummary(savedSummary);
      }
      
      // Load segments count since last refresh
      const savedSegmentsCount = localStorage.getItem(SEGMENTS_COUNT_KEY);
      if (savedSegmentsCount) {
        const count = parseInt(savedSegmentsCount);
        // If we have a valid count, use it to manually set the counter
        // This allows persistence across page refreshes
        if (!isNaN(count)) {
          // We'll update the counter in the store
          for (let i = 0; i < count; i++) {
            useStoryStore.getState().incrementSegmentCount();
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load story from localStorage:', e);
    }
  }, [updateStorySummary]);
  
  // Save story summary to localStorage when it changes
  useEffect(() => {
    if (storySummary) {
      try {
        localStorage.setItem(STORY_SUMMARY_KEY, storySummary);
      } catch (e) {
        console.warn('Failed to save story summary to localStorage:', e);
      }
    }
  }, [storySummary]);
  
  // Save segments count to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem(SEGMENTS_COUNT_KEY, segmentsSincePromptRefresh.toString());
    } catch (e) {
      console.warn('Failed to save segments count to localStorage:', e);
    }
  }, [segmentsSincePromptRefresh]);

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
      
      {/* Debug mode indicator */}
      {debugMode && (
        <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded z-50">
          Debug Mode Active
          {isPromptRefreshing && (
            <span className="ml-2 font-bold text-green-400">Prompt Refreshed!</span>
          )}
        </div>
      )}
      
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
              showDebug={debugMode}
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