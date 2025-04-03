import { useCallback } from 'react';
import { Choice } from '../types/Story';
import { useStoryStore } from '../store/storyState';
import { generateInitialStory, generateNextStorySegment } from '../services/storyGeneration';

// This is a placeholder for the actual ML-based story generation
// In Phase 2, this will use Transformers.js for local LLM integration
export const useStoryGeneration = () => {
  const { setCurrentSegment, setLoading, setError } = useStoryStore();
  
  const generateStoryStart = useCallback(async () => {
    try {
      setError(null); // Clear any previous errors
      setLoading(true);
      console.log('Starting story generation...');
      const initialStory = await generateInitialStory();
      console.log('Story generated successfully');
      setCurrentSegment(initialStory);
    } catch (error) {
      console.error('Story generation error:', error);
      setError(
        error instanceof Error 
          ? error.message 
          : 'Failed to generate story. Please check your internet connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [setCurrentSegment, setLoading, setError]);

  const generateNextSegment = useCallback(async (choice: Choice) => {
    try {
      setError(null); // Clear any previous errors
      setLoading(true);
      const { currentSegment } = useStoryStore.getState();
      
      if (!currentSegment) {
        throw new Error('No current story segment found. Please start a new story.');
      }
      
      console.log('Generating next story segment...');
      const nextSegment = await generateNextStorySegment(currentSegment, choice);
      console.log('Next segment generated successfully');
      setCurrentSegment(nextSegment);
    } catch (error) {
      console.error('Next segment generation error:', error);
      setError(
        error instanceof Error 
          ? error.message 
          : 'Failed to generate the next part of the story. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setCurrentSegment]);

  return {
    generateStoryStart,
    generateNextSegment
  };
}; 