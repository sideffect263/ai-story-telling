import { create } from 'zustand';
import { StorySegment, Choice } from '../types/Story';

interface StoryState {
  currentSegment: StorySegment | null;
  storyHistory: StorySegment[];
  storySummary: string;
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
  updateStorySummary: (newSummary: string) => void;
}


export const useStoryStore = create<StoryState>((set) => ({
  currentSegment: null,
  storyHistory: [],
  storySummary: '',
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

  makeChoice: (_: Choice) => 
    set(_ => ({ 
      isLoading: true 
    })),

  resetStory: () => 
    set({ 
      currentSegment: null, 
      storyHistory: [], 
      storySummary: '',
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
    set({ isONNXInitialized: initialized }),
    
  updateStorySummary: (newSummary: string) =>
    set({ storySummary: newSummary })
})); 