import React, { useEffect, useState, useRef } from 'react';
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

// Background animation objects for ambience during loading/generation
const BackgroundAnimation = ({ isActive }: { isActive: boolean }) => {
  const frameRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<any[]>([]);
  
  // Initialize particle system
  useEffect(() => {
    if (!isActive || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Resize canvas to match window size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    // Create initial particles
    const createParticles = () => {
      const particleCount = Math.min(50, Math.floor(window.innerWidth * window.innerHeight / 15000));
      const newParticles = [];
      
      for (let i = 0; i < particleCount; i++) {
        newParticles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          radius: Math.random() * 2 + 1,
          color: `rgba(255, 255, 255, ${Math.random() * 0.3 + 0.1})`,
          speedX: Math.random() * 0.5 - 0.25,
          speedY: Math.random() * 0.5 - 0.25,
          life: Math.random() * 100 + 50
        });
      }
      
      particlesRef.current = newParticles;
    };
    
    // Animation loop
    const animate = () => {
      if (!isActive || !ctx || !canvas) return;
      
      // Clear canvas with semi-transparent black to create trailing effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Update and draw particles
      particlesRef.current.forEach(p => {
        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        
        // Update position
        p.x += p.speedX;
        p.y += p.speedY;
        p.life -= 1;
        
        // Check bounds
        if (p.x < 0 || p.x > canvas.width) p.speedX *= -1;
        if (p.y < 0 || p.y > canvas.height) p.speedY *= -1;
        
        // Respawn if life is depleted
        if (p.life <= 0) {
          p.x = Math.random() * canvas.width;
          p.y = Math.random() * canvas.height;
          p.radius = Math.random() * 2 + 1;
          p.life = Math.random() * 100 + 50;
        }
      });
      
      frameRef.current = requestAnimationFrame(animate);
    };
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    createParticles();
    frameRef.current = requestAnimationFrame(animate);
    
    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [isActive]);
  
  if (!isActive) return null;
  
  return (
    <canvas 
      ref={canvasRef}
      className="absolute inset-0 z-0 bg-transparent"
      style={{ pointerEvents: 'none' }}
    />
  );
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

  // Track whether an animation is needed (during loading or text generation)
  const isGenerating = isLoading || (downloadProgress > 0 && downloadProgress < 100);

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
      {/* Background animation during loading/generation */}
      <BackgroundAnimation isActive={isGenerating} />
      
      {/* Basic Environment - always shown regardless of loading state */}
      <div className="absolute inset-0 z-0">
        <BasicEnvironment 
          environmentDescription={environmentToShow}
          metadata={metadataToShow}
          previousMetadata={previousSegment?.metadata}
        />
      </div>
      
      {/* Response time notification */}
      <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-40 max-w-md w-full rounded-lg overflow-hidden shadow-lg"
      style={{ position: 'absolute', top: '1vh', left: '50%', transform: 'translateX(-50%)' }}
      >
        <div className="bg-black bg-opacity-75 border border-gray-700 px-4 py-3">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-yellow-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ width: '40px', aspectRatio: '1/1' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <p className="font-medium text-white">Current response times: 10-30 seconds</p>
          </div>
        </div>
      </div>
      
      {/* App explanation */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 max-w-lg w-full rounded-lg overflow-hidden shadow-lg"
      style={{ position: 'absolute', top: '70vh', left: '50%', transform: 'translateX(-50%)' }}
      >
        <div className="bg-black bg-opacity-75 border border-gray-700 px-4 py-3">
          <h3 className="text-white font-semibold mb-2 text-center">About This Experience</h3>
          <p className="text-gray-200 text-sm leading-relaxed">
            This web app is a work in progress. I'm experimenting with loading an LLM 
            such as DistilGPT2 to generate interactive fiction. The story is generated 
            in the background while you wait, and unfolds in real-time as you make choices.
          </p>
        </div>
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
        <div className="absolute inset-x-0 bottom-0 z-10 p-6" style={{ position: 'absolute', top: '20vh', left: '50%', transform: 'translateX(-50%)' }}>
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