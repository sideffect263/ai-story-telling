// Import types only, we'll dynamically import the actual modules
import type { TextGenerationPipeline } from '@xenova/transformers';
import { StorySegment, Choice } from '../types/Story';
import { useStoryStore } from '../store/storyState';

// Simple type definitions for transformer.js outputs


// Core components
let generator: TextGenerationPipeline | null = null;
let isInitializing = false;
let transformers: any = null;

const MODEL_NAME = 'Xenova/distilgpt2';
const REFRESH_PROMPT_AFTER_SEGMENTS = 3;

// Utility functions
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Handle progress updates
const updateProgress = (progress: number, message: string) => {
  const { setProgress } = useStoryStore.getState();
  setProgress(progress, message);
  return delay(50); // Small delay to allow UI updates
};

// Initialize the ONNX runtime and other dependencies
export const initializeONNX = async (): Promise<boolean> => {
  console.log('Initializing story engine...');
  const { setONNXInitialized } = useStoryStore.getState();
  
  try {
    await updateProgress(10, 'Loading transformers library');
    transformers = await import('@xenova/transformers');
    
    await updateProgress(30, 'Loading resources');
    await updateProgress(60, 'Preparing story engine');
    await updateProgress(100, 'Initialization complete');
    
    setONNXInitialized(true);
    return true;
  } catch (error) {
    console.error('Failed to initialize story engine:', error);
    setONNXInitialized(false);
    throw error;
  }
};

// Initialize the text generation model
const initializeGenerator = async (): Promise<boolean> => {
  if (generator) return true;
  if (isInitializing) return false;
  
  try {
    isInitializing = true;
    
    // Make sure ONNX is initialized
    const { isONNXInitialized } = useStoryStore.getState();
    if (!isONNXInitialized) {
      await initializeONNX();
    }
    
    // Initialize the pipeline
    if (transformers) {
      await updateProgress(25, 'Loading text generation model');
      generator = await transformers.pipeline('text-generation', MODEL_NAME, {
        quantized: false
      });
      
      await updateProgress(75, 'Testing model');
      if (generator) {
        await generator('Test', { max_new_tokens: 5 });
      }
      
      await updateProgress(100, 'Model ready');
      isInitializing = false;
      return !!generator;
    }
    return false;
  } catch (error) {
    console.error('Failed to initialize model:', error);
    isInitializing = false;
    generator = null;
    throw error;
  }
};

// Generate text using the model
const generateText = async (prompt: string): Promise<string> => {
  try {
    // Initialize the model if needed
    await initializeGenerator();
    if (!generator) throw new Error('Text generator not initialized');
    
    // Visual feedback for text generation
    await updateProgress(25, 'Crafting your story...');
    
    // Generate the text with improved parameters
    const result = await generator(prompt, {
      max_new_tokens: 150,        // Increased from 120 to allow more coherent output
      temperature: 0.8,           // Slightly increased from 0.7 for more creativity
      do_sample: true,
      top_k: 40,
      top_p: 0.9,                 // Add top_p sampling for better quality
      repetition_penalty: 1.3,    // Increased from 1.2 to reduce repetition
      no_repeat_ngram_size: 3,    // Avoid repeating the same 3-grams
    });
    
    await updateProgress(75, 'Refining results...');
    
    // Extract and clean the generated text
    let text = '';
    
    // Handle different result formats safely
    if (Array.isArray(result) && result.length > 0) {
      // Type assertion to handle the array case
      const firstResult = result[0] as unknown as { generated_text: string };
      text = firstResult.generated_text;
    } else if (result && typeof result === 'object' && 'generated_text' in result) {
      // Type assertion for single object case
      text = (result as { generated_text: string }).generated_text;
    } else {
      throw new Error('Unexpected output format');
    }
    
    // Clean up the text
    text = cleanText(text, prompt);
    
    await updateProgress(100, 'Ready');
    return text;
  } catch (error) {
    console.error('Text generation error:', error);
    throw new Error(`Failed to generate text: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Clean generated text
const cleanText = (text: string, prompt: string): string => {
  // Remove the prompt from the beginning
  let cleanedText = text.trim();
  if (cleanedText.startsWith(prompt)) {
    cleanedText = cleanedText.slice(prompt.length).trim();
  }
  
  // Limit length
  if (cleanedText.length > 300) {
    const truncated = cleanedText.substring(0, 300);
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf('.'), 
      truncated.lastIndexOf('!'), 
      truncated.lastIndexOf('?')
    );
    
    if (lastSentenceEnd > 0) {
      cleanedText = cleanedText.substring(0, lastSentenceEnd + 1);
    }
  }
  
  // Enhanced cleanup with more robust text normalization
  cleanedText = cleanedText.trim()
    // Fix common formatting issues
    .replace(/\s+/g, ' ')          // Replace multiple spaces with single space
    .replace(/\n+/g, ' ')          // Replace newlines with spaces
    .replace(/\.+/g, '.')          // Replace multiple periods with single period
    .replace(/([.!?])\s*([.!?])+/g, '$1') // Remove consecutive punctuation
    // Remove problematic characters
    .replace(/[<>‹›‼]/g, '')       // Remove brackets and unusual punctuation
    .replace(/\u00A0/g, ' ')       // Replace non-breaking spaces with regular spaces
    // Fix missing first letter in sentences that start with "ou" (common in generated text)
    .replace(/(\.\s+|\n|^)ou\b/g, '$1You')
    .replace(/(\.\s+|\n|^)he\b/g, '$1The')
    // Fix sentence structure
    .replace(/\s+([,.!?])/g, '$1') // Remove spaces before punctuation
    .replace(/([.!?])(?=[a-zA-Z])/g, '$1 '); // Add space after punctuation if missing
  
  // If it ends abruptly without punctuation, add a period
  if (!/[.!?]$/.test(cleanedText)) {
    cleanedText += '.';
  }
  
  // Make sure we don't return the fallback if we have at least some decent text
  if (cleanedText.length > 20) {
    return cleanedText;
  }
  
  return cleanedText || "The adventure continues...";
};

// Generate choices
const generateChoices = async (context: string): Promise<Choice[]> => {
  try {
    // Enhanced default choices in case generation fails
    const defaultChoices: Choice[] = [
      {
        text: "Investigate further",
        consequence: "You decide to investigate further into the mystery.",
        environmentImpact: {
          lightingChange: { intensity: 0.8 },
          atmosphereChange: { fogDensity: 0.1 },
          animationEffect: {
            transitionType: 'fade',
            intensity: 1.2,
            duration: 2
          }
        }
      },
      {
        text: "Take an alternative path",
        consequence: "You choose a different direction, seeking a new opportunity.",
        environmentImpact: {
          lightingChange: { intensity: 1.2 },
          atmosphereChange: { fogDensity: 0.01 },
          animationEffect: {
            transitionType: 'slide',
            intensity: 1.3,
            duration: 2.5
          }
        }
      }
    ];
    
    // Try to generate tailored choices with improved prompt
    const trimmedContext = context.slice(-200); // Get more context for better choices
    const prompt = `Based on this fantasy adventure context: "${trimmedContext}" 

Generate two distinct, compelling choices for what the protagonist could do next.
Each choice should:
1. Be brief (3-7 words)
2. Offer a clear action
3. Suggest different approaches/directions
4. Fit the current story situation

Format each choice on a new line:`;
    
    const choicesText = await generateText(prompt);
    
    // Enhanced choice extraction with better filtering
    const lines = choicesText
      .split(/[\.|\n|;]/) // Split by periods, newlines, or semicolons
      .map(line => line.trim())
      .filter(line => {
        // Must be reasonable length (not too short, not too long)
        const goodLength = line.length > 3 && line.length < 50;
        // Should not contain unwanted characters
        const noUnwantedChars = !/[:|"]/.test(line);
        // Should not start with numbers or bullets
        const noLeadingNumbersOrBullets = !/^[0-9\-*•]/.test(line);
        return goodLength && noUnwantedChars && noLeadingNumbersOrBullets;
      });
    
    if (lines.length >= 2) {
      // Process the first two valid choices
      const processedChoices: Choice[] = [];
      
      // Create first choice with animation
      processedChoices.push({
        text: lines[0],
        consequence: `You decide to ${lines[0].toLowerCase().replace(/\.$/, '')}.`,
        environmentImpact: {
          lightingChange: { intensity: 0.8 },
          atmosphereChange: { fogDensity: 0.1 },
          animationEffect: {
            transitionType: 'fade',
            intensity: 1.2,
            duration: 2
          }
        }
      });
      
      // Create second choice with a different animation effect
      // Use one of the allowed transition types
      const secondChoiceTransition: 'slide' | 'zoom' = Math.random() > 0.5 ? 'zoom' : 'slide';
      
      processedChoices.push({
        text: lines[1],
        consequence: `You decide to ${lines[1].toLowerCase().replace(/\.$/, '')}.`,
        environmentImpact: {
          lightingChange: { intensity: 1.2 },
          atmosphereChange: { fogDensity: 0.01 },
          animationEffect: {
            transitionType: secondChoiceTransition,
            intensity: 1.3,
            duration: 2.5
          }
        }
      });
      
      return processedChoices;
    }
    
    return defaultChoices;
  } catch (error) {
    console.error('Failed to generate choices:', error);
    return [
      {
        text: "Explore the unknown",
        consequence: "You venture deeper into the mysterious surroundings.",
        environmentImpact: {
          lightingChange: { intensity: 0.8 },
          atmosphereChange: { fogDensity: 0.1 },
          animationEffect: {
            transitionType: 'slide',
            intensity: 1.2,
            duration: 2.5
          }
        }
      },
      {
        text: "Proceed with caution",
        consequence: "You move forward carefully, alert to the dangers around you.",
        environmentImpact: {
          lightingChange: { intensity: 1.2 },
          atmosphereChange: { fogDensity: 0.01 },
          animationEffect: {
            transitionType: 'fade',
            intensity: 1.1,
            duration: 2
          }
        }
      }
    ];
  }
};

// Environment presets
const environments = {
  forest: {
    description: "A mysterious forest with ancient trees reaching toward the sky.",
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
    metadata: {
      mood: 'mysterious',
      location: 'forest',
      timeOfDay: 'day',
      weatherConditions: 'clear'
    }
  },
  cave: {
    description: "A dark cave with stalactites hanging from the ceiling.",
    lighting: {
      intensity: 0.4,
      color: '#a0c0e0',
      ambient: 0.2,
      shadows: true
    },
    atmosphere: {
      fog: true,
      fogDensity: 0.08,
      fogColor: '#202030'
    },
    metadata: {
      mood: 'mysterious',
      location: 'cave',
      timeOfDay: 'night',
      weatherConditions: 'enclosed'
    }
  },
  ruins: {
    description: "Ancient ruins of a forgotten civilization.",
    lighting: {
      intensity: 1.1,
      color: '#e8d8c0',
      ambient: 0.5,
      shadows: true
    },
    atmosphere: {
      fog: true,
      fogDensity: 0.03,
      fogColor: '#e0e0d8'
    },
    metadata: {
      mood: 'ancient',
      location: 'ruins',
      timeOfDay: 'day',
      weatherConditions: 'clear'
    }
  }
};

// Get environment based on story content
const getEnvironment = (text: string) => {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('cave') || lowerText.includes('underground') || lowerText.includes('dark')) {
    return 'cave';
  } else if (lowerText.includes('ruin') || lowerText.includes('ancient') || lowerText.includes('temple')) {
    return 'ruins';
  } else {
    return 'forest';
  }
};

// Generate the initial story segment
export const generateInitialStory = async (): Promise<StorySegment> => {
  try {
    // Generate the initial story text with improved prompt
    const prompt = `Write an engaging opening to a fantasy adventure. 
Establish a clear setting and atmosphere in 2-3 sentences. 
Use second-person perspective (you) and set up an intriguing situation:`;
    
    const text = await generateText(prompt);
    
    // Update summary in the store
    useStoryStore.getState().updateStorySummary(text);
    
    // Generate choices
    const choices = await generateChoices(text);
    
    // Create the story segment with the forest environment
    const envType = 'forest';
    const env = environments[envType as keyof typeof environments];
    
    return {
      text,
      environment: {
        baseEnvironment: envType,
        lighting: env.lighting,
        atmosphere: env.atmosphere,
        props: []
      },
      choices,
      metadata: env.metadata
    };
  } catch (error) {
    console.error('Failed to generate initial story:', error);
    
    // Improved fallback to a default story
    const envType = 'forest';
    const env = environments[envType as keyof typeof environments];
    
    return {
      text: "You find yourself in a mysterious forest clearing. The air is thick with anticipation, and strange sounds echo in the distance. The ancient trees around you seem to watch your every move.",
      environment: {
        baseEnvironment: envType,
        lighting: env.lighting,
        atmosphere: env.atmosphere,
        props: []
      },
      choices: [
        {
          text: "Explore the forest",
          consequence: "You venture deeper into the mysterious forest.",
          environmentImpact: {
            lightingChange: { intensity: 0.8 },
            atmosphereChange: { fogDensity: 0.1 },
            animationEffect: {
              transitionType: 'slide',
              intensity: 1.2,
              duration: 2
            }
          }
        },
        {
          text: "Look for a path",
          consequence: "You search for a clear path through the trees.",
          environmentImpact: {
            lightingChange: { intensity: 1.2 },
            atmosphereChange: { fogDensity: 0.01 },
            animationEffect: {
              transitionType: 'fade',
              intensity: 1.1,
              duration: 2
            }
          }
        }
      ],
      metadata: env.metadata
    };
  }
};

// Generate the next story segment based on the choice
export const generateNextStorySegment = async (
  currentStory: StorySegment,
  choice: Choice
): Promise<StorySegment> => {
  try {
    const { storySummary, segmentsSincePromptRefresh } = useStoryStore.getState();
    
    // Count segments and maybe refresh prompt
    useStoryStore.getState().incrementSegmentCount();
    const shouldRefresh = segmentsSincePromptRefresh >= REFRESH_PROMPT_AFTER_SEGMENTS;
    
    // Build continuation prompt with improved instructions
    let prompt;
    if (shouldRefresh) {
      // Enhanced fresh prompt with clear context and instructions
      prompt = `Fantasy adventure setting: ${currentStory.environment.baseEnvironment}
      
Previous events: ${storySummary}

Current situation: ${choice.consequence}

Continue the adventure by describing what happens next. Use vivid details and second-person perspective.
Write 2-3 sentences that advance the story in an interesting way:`;
      
      // Reset segment counter
      useStoryStore.getState().resetSegmentCount();
    } else {
      // Enhanced standard prompt with more context
      prompt = `Fantasy adventure in progress:
      
Story so far: "${storySummary.slice(-300)}"

The protagonist just chose to: ${choice.text}
This leads to: ${choice.consequence}

Continue the story with 2-3 vivid sentences that advance the plot. 
Use second-person perspective (you) and include sensory details:`;
    }
    
    // Generate the continuation text
    const generatedText = await generateText(prompt);
    
    // Join text with proper spacing and avoiding redundancy
    let fullText = choice.consequence;
    if (!generatedText.startsWith(choice.consequence)) {
      if (!choice.consequence.endsWith('.') && !choice.consequence.endsWith('!') && !choice.consequence.endsWith('?')) {
        fullText += '. ';
      } else {
        fullText += ' ';
      }
      fullText += generatedText;
    } else {
      fullText = generatedText;
    }
    
    // Update the story summary in the store with the complete text
    // Limit the summary size to prevent it from growing too large over time
    const maxSummaryLength = 1000;
    const newSummary = `${storySummary} ${fullText}`.slice(-maxSummaryLength);
    useStoryStore.getState().updateStorySummary(newSummary);
    
    // Determine environment based on text content with more keywords
    const envType = getEnvironment(fullText);
    const env = environments[envType as keyof typeof environments];
    
    // Generate choices for the next segment
    const choices = await generateChoices(fullText);
    
    return {
      text: fullText,
      environment: {
        baseEnvironment: envType,
        lighting: {
          ...env.lighting,
          ...choice.environmentImpact.lightingChange
        },
        atmosphere: {
          ...env.atmosphere,
          ...choice.environmentImpact.atmosphereChange
        },
        props: currentStory.environment.props
      },
      choices,
      metadata: {
        ...env.metadata,
        location: envType
      }
    };
  } catch (error) {
    console.error('Failed to generate next story segment:', error);
    
    // Improved fallback with more interesting content
    const fallbackText = `${choice.consequence} As you continue your journey, new paths reveal themselves before you. The atmosphere shifts, hinting at unknown adventures ahead.`;
    const envType = currentStory.environment.baseEnvironment;
    
    return {
      text: fallbackText,
      environment: {
        baseEnvironment: envType,
        lighting: {
          ...currentStory.environment.lighting,
          ...choice.environmentImpact.lightingChange
        },
        atmosphere: {
          ...currentStory.environment.atmosphere,
          ...choice.environmentImpact.atmosphereChange
        },
        props: currentStory.environment.props
      },
      choices: [
        {
          text: "Explore further",
          consequence: "You decide to explore the area more thoroughly.",
          environmentImpact: {
            lightingChange: { intensity: 0.8 },
            atmosphereChange: { fogDensity: 0.1 },
            animationEffect: {
              transitionType: 'slide',
              intensity: 1.2,
              duration: 2.5
            }
          }
        },
        {
          text: "Take a cautious approach",
          consequence: "You proceed with caution, carefully observing your surroundings.",
          environmentImpact: {
            lightingChange: { intensity: 1.2 },
            atmosphereChange: { fogDensity: 0.01 },
            animationEffect: {
              transitionType: 'fade',
              intensity: 1.1,
              duration: 2
            }
          }
        }
      ],
      metadata: {
        ...currentStory.metadata,
        location: envType
      }
    };
  }
}; 