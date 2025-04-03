import { create } from 'zustand';
import { StorySegment, Choice } from '../types/Story';

interface StoryState {
  currentSegment: StorySegment | null;
  storyHistory: StorySegment[];
  isLoading: boolean;
  error: string | null;
  downloadProgress: number;
  currentFile: string;
  isONNXInitialized: boolean;
  
  // Actions
  setCurrentSegment: (segment: StorySegment) => void;
  makeChoice: (choice: Choice) => void;
  resetStory: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setProgress: (progress: number, file?: string) => void;
  setONNXInitialized: (initialized: boolean) => void;
}

// Initial empty story segment for typing purposes
const emptySegment: StorySegment = {
  text: '',
  environment: {
    baseEnvironment: 'default',
    lighting: {
      intensity: 1,
      color: '#ffffff',
      ambient: 0.5,
      shadows: true
    },
    atmosphere: {
      fog: false
    },
    props: []
  },
  choices: [],
  metadata: {
    mood: 'neutral',
    location: 'unknown',
    timeOfDay: 'day',
    weatherConditions: 'clear'
  }
};

export const useStoryStore = create<StoryState>((set) => ({
  currentSegment: null,
  storyHistory: [],
  isLoading: false,
  error: null,
  downloadProgress: 0,
  currentFile: '',
  isONNXInitialized: false,

  setCurrentSegment: (segment: StorySegment) => 
    set(state => ({ 
      currentSegment: segment,
      storyHistory: [...state.storyHistory, segment]
    })),

  makeChoice: (choice: Choice) => 
    set(state => ({ 
      isLoading: true 
    })),

  resetStory: () => 
    set({ 
      currentSegment: null, 
      storyHistory: [], 
      error: null,
      downloadProgress: 0,
      currentFile: '',
      isONNXInitialized: false
    }),

  setLoading: (loading: boolean) => 
    set({ isLoading: loading }),

  setError: (error: string | null) => 
    set({ error, isLoading: false }),

  setProgress: (progress: number, file?: string) =>
    set({ 
      downloadProgress: progress,
      currentFile: file || ''
    }),

  setONNXInitialized: (initialized: boolean) =>
    set({ isONNXInitialized: initialized })
})); 