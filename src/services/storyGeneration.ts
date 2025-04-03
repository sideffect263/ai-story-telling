// Import types only, we'll dynamically import the actual modules
import type { TextGenerationPipeline } from '@xenova/transformers';
import { StorySegment, Choice } from '../types/Story';
import { useStoryStore } from '../store/storyState';

// Define proper types for the transformer.js outputs
// These types match what the library actually returns
type GeneratedText = string;

interface TextGenerationSingle {
  generated_text: GeneratedText;
  score?: number;
  token?: number;
}

// TextGenerationOutput is an array of TextGenerationSingle objects
type TextGenerationOutput = TextGenerationSingle[];

// Type guard function to check if result is a single generation object
function isSingleGeneration(result: any): result is TextGenerationSingle {
  return result && typeof result === 'object' && 
         'generated_text' in result && 
         typeof result.generated_text === 'string';
}

// Type guard function to check if result is an array of generation objects
function isGenerationArray(result: any): result is TextGenerationOutput {
  return Array.isArray(result) && 
         result.length > 0 && 
         isSingleGeneration(result[0]);
}

// Initialize components
let generator: TextGenerationPipeline | null = null;
let isInitializing = false;
let transformers: any = null;

const MODEL_NAME = 'Xenova/distilgpt2';

// Add a delay utility function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface ProgressCallback {
  status: string;
  file?: string;
  progress?: number;
}

const handleProgress = (progress: ProgressCallback) => {
  console.log('Model loading progress:', progress);
  const { setProgress } = useStoryStore.getState();

  if (progress.status === 'progress' && progress.progress) {
    setProgress(progress.progress, progress.file);
  } else if (progress.status === 'download' || progress.status === 'init') {
    setProgress(0, progress.file);
  } else if (progress.status === 'done') {
    setProgress(100, progress.file);
  }
};

// Initialize ONNX and other components
export const initializeONNX = async (): Promise<boolean> => {
  console.log('Initializing story engine...');
  const { setONNXInitialized, setProgress } = useStoryStore.getState();
  
  try {
    // Dynamically import the transformers library
    if (!transformers) {
      setProgress(10, 'Loading transformers library');
      transformers = await import('@xenova/transformers');
      console.log('Transformers library loaded successfully');
    }
    
    setProgress(30, 'Loading resources');
    await delay(500);
    
    setProgress(60, 'Preparing story engine');
    await delay(500);
    
    setProgress(100, 'Initialization complete');
    setONNXInitialized(true);
    console.log('Story engine initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize story engine:', error);
    setONNXInitialized(false);
    throw error;
  }
};

// Initialize components separately to ensure proper loading
const initializeComponents = async () => {
  console.log('Initializing components...');
  const { isONNXInitialized } = useStoryStore.getState();
  
  try {
    // First initialize ONNX if not already initialized
    if (!isONNXInitialized || !transformers) {
      await initializeONNX();
      // Add additional delay after ONNX initialization
      await delay(500);
    }

    if (!transformers) {
      throw new Error('Transformers not initialized');
    }

    // Configure transformers environment
    if (transformers.env) {
      transformers.env.useBrowserCache = true;
      transformers.env.allowLocalModels = false;  // Changed to false to ensure fresh downloads
      transformers.env.backends.onnx.wasm.numThreads = 1;
    }

    console.log('Loading tokenizer...');
    try {
      await transformers.AutoTokenizer.from_pretrained(MODEL_NAME, {
        progress_callback: handleProgress,
        quantized: false,
        fetch: (url: string, init?: RequestInit) => {
          console.log('Fetching model file:', url);
          return fetch(url, {
            ...init,
            headers: {
              ...init?.headers,
              'User-Agent': 'Mozilla/5.0'
            }
          }).then(async (response) => {
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response;
          });
        }
      });
    } catch (error) {
      console.error('Failed to load tokenizer:', error);
      throw error;
    }

    console.log('Loading model...');
    try {
     
      
      return true;
    } catch (error) {
      console.error('Failed to load model:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to initialize components:', error);
    throw error;
  }
};

const initializeGenerator = async () => {
  console.log('Initializing generator...');
  try {
    if (!generator && !isInitializing) {
      isInitializing = true;
      console.log('Starting model initialization...');

      // First initialize components
      await initializeComponents();
      
      // Then create the pipeline
      if (transformers) {
        generator = await transformers.pipeline('text-generation', MODEL_NAME, {
          quantized: false,
          progress_callback: handleProgress,
        });

        // Test the model with a simple prompt
        console.log('Testing model...');
        if (generator) {
          const testResult = await generator("Test", {
            max_new_tokens: 5,
            do_sample: true,
            temperature: 0.7,
          });
          
          // Use the type guards to check the result format
          if (!testResult || 
             (!isGenerationArray(testResult) && !isSingleGeneration(testResult))) {
            throw new Error('Model test failed');
          }
        }
        
        console.log('Model initialized successfully');
        isInitializing = false;
        return true;
      }
    }
    return !!generator;
  } catch (error) {
    console.error('Failed to initialize model:', error);
    isInitializing = false;
    generator = null;
    throw new Error(`Failed to initialize model: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Clean up the generated text by removing the prompt and any unwanted artifacts
 */
const cleanGeneratedText = (generatedText: string, prompt: string): string => {
  let cleanedText = generatedText.trim();
  
  // Remove the prompt from the beginning of the text
  if (cleanedText.startsWith(prompt)) {
    cleanedText = cleanedText.slice(prompt.length).trim();
  }
  
  // Handle possible JSON in text (for choices)
  const jsonStartIndex = cleanedText.indexOf('[{');
  if (jsonStartIndex !== -1) {
    cleanedText = cleanedText.substring(0, jsonStartIndex).trim();
  }
  
  // Remove specific prompt repetitions and metadata that shouldn't be in the story
  const irrelevantPatterns = [
    /The protagonist just chose to:.*/i,
    /This leads to:.*/i,
    /Setting:.*/i,
    /Describe only what happens.*/i,
    /Continue the story.*/i,
    /Be vivid but concise.*/i,
    /Write a brief continuation.*/i,
    /The story was first published.*/i,
    /The book was first published.*/i
  ];
  
  for (const pattern of irrelevantPatterns) {
    cleanedText = cleanedText.replace(pattern, '');
  }
  
  // Handle repetitive text by removing duplicate sentences or phrases
  const sentences = cleanedText.match(/[^.!?]+[.!?]+/g) || [];
  if (sentences.length > 1) {
    // Only deduplicate if we have multiple sentences to avoid removing everything
    const uniqueSentences = [...new Set(sentences)];
    cleanedText = uniqueSentences.join(' ');
  }
  
  // Limit length to avoid overly long stories
  if (cleanedText.length > 300) {
    // Find the last complete sentence within the limit
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
  
  // Final cleanup
  cleanedText = cleanedText.trim()
    .replace(/\s+/g, ' ')                // Replace multiple spaces with single space
    .replace(/\n+/g, ' ')                // Replace newlines with spaces
    .replace(/\.+/g, '.')                // Replace multiple periods with single period
    .replace(/([.!?])\s*([.!?])+/g, '$1'); // Remove consecutive punctuation
  
  return cleanedText || 'The adventure continues...';
};

const generateText = async (prompt: string): Promise<string> => {
  console.log('Generating text with LLM...');
  try {
    const initialized = await initializeGenerator();
    
    if (!initialized || !generator) {
      throw new Error('Story generator not initialized');
    }

    console.log('Generating text with prompt:', prompt);
    
    // Check if we're generating JSON (choices) or regular text (story)
    const isJsonGeneration = prompt.includes('JSON FORMAT') || prompt.includes('JSON array');
    
    // Use different parameters based on what we're generating
    const result = await generator(prompt, {
      max_new_tokens: isJsonGeneration ? 150 : 120,  // More tokens for JSON to ensure complete structure
      num_return_sequences: 1,
      temperature: isJsonGeneration ? 0.5 : 0.7,     // Lower temperature for JSON = more predictable output
      do_sample: true,
      top_k: isJsonGeneration ? 30 : 40,             // Lower for JSON = more focused token selection
      top_p: isJsonGeneration ? 0.8 : 0.85,          // Slightly lower for JSON
      repetition_penalty: 1.2,                        // Keep repetition penalty the same
    });

    // Handle different possible result formats safely using the type guards
    let generatedText = "";
    if (isGenerationArray(result)) {
      generatedText = result[0].generated_text;
    } else if (isSingleGeneration(result)) {
      generatedText = result.generated_text;
    } else {
      throw new Error('Failed to generate text: Unexpected output format');
    }

    // Clean up the generated text
    return cleanGeneratedText(generatedText, prompt);
  } catch (error) {
    console.error('Text generation error:', error);
    throw new Error(`Failed to generate story text: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Parse choices from generated text
 * Returns a default set of choices if parsing fails
 */
const parseChoicesFromText = (choicesText: string): Choice[] => {
  try {
    let jsonString = choicesText.trim();
    console.log('Raw choices text:', jsonString);
    
    // Try multiple approaches to extract valid choices
    
    // Approach 1: Try to find and parse a JSON array
    try {
      // Find the most likely JSON array using regex
      const jsonArrayRegex = /\[\s*\{.*?\}\s*\]/gs;
      const match = jsonArrayRegex.exec(jsonString);
      
      if (match && match[0]) {
        // Clean up the potential JSON
        let cleanedJson = match[0]
          .replace(/'/g, '"')                          // Replace single quotes with double quotes
          .replace(/(\w+)\s*:/g, '"$1":')              // Ensure keys have double quotes
          .replace(/:\s*"?([^",\}\]]+)"?([,\}\]])/g, ':"$1"$2'); // Ensure values have double quotes
        
        console.log('Attempting to parse JSON:', cleanedJson);
        
        const parsed = JSON.parse(cleanedJson);
        if (Array.isArray(parsed) && parsed.length >= 2) {
          return parsed.map((c, index) => {
            // Generate different animation effects based on the choice
            const animationTypes = ['fade', 'slide', 'zoom'] as const;
            return {
              text: c.text || "Continue",
              consequence: c.consequence || "You continue your journey",
              environmentImpact: {
                lightingChange: { 
                  intensity: index === 0 ? 0.8 : 1.2 
                },
                atmosphereChange: { 
                  fogDensity: Math.random() * 0.1 
                },
                animationEffect: {
                  transitionType: animationTypes[Math.floor(Math.random() * animationTypes.length)],
                  intensity: 1 + (Math.random() * 0.5),
                  duration: 2 + (Math.random() * 1)
                }
              }
            };
          });
        }
      }
    } catch (e) {
      console.warn('Failed to parse using JSON array approach:', e);
    }
    
    // Approach 2: Extract text/consequence pairs using regex
    try {
      // Look for patterns like "text": "some text", "consequence": "some consequence"
      const textRegex = /"?text"?\s*:\s*"([^"]+)"/gi;
      const consequenceRegex = /"?consequence"?\s*:\s*"([^"]+)"/gi;
      
      const texts: string[] = [];
      const consequences: string[] = [];
      
      // Extract all matches
      let textMatch;
      while ((textMatch = textRegex.exec(jsonString)) !== null) {
        if (textMatch[1]) texts.push(textMatch[1].trim());
      }
      
      let consMatch;
      while ((consMatch = consequenceRegex.exec(jsonString)) !== null) {
        if (consMatch[1]) consequences.push(consMatch[1].trim());
      }
      
      console.log('Extracted text/consequence pairs:', { texts, consequences });
      
      // If we have at least 2 text/consequence pairs
      if (texts.length >= 2 && consequences.length >= 2) {
        return [
          {
            text: texts[0],
            consequence: consequences[0],
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
            text: texts[1],
            consequence: consequences[1],
            environmentImpact: {
              lightingChange: { intensity: 1.2 },
              atmosphereChange: { fogDensity: 0.01 },
              animationEffect: {
                transitionType: 'zoom',
                intensity: 1.3,
                duration: 2.5
              }
            }
          }
        ];
      }
    } catch (e) {
      console.warn('Failed to parse using regex extraction:', e);
    }
    
    // Approach 3: Try to find any structured content that looks like choices
    try {
      // Look for numbered items like "1. Option text"
      const numberedItems = jsonString.match(/\d+\.\s*([^\n\.]+)/g);
      if (numberedItems && numberedItems.length >= 2) {
        console.log('Found numbered items:', numberedItems);
        return [
          {
            text: numberedItems[0].replace(/^\d+\.\s*/, '').trim(),
            consequence: "You choose the first option.",
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
            text: numberedItems[1].replace(/^\d+\.\s*/, '').trim(),
            consequence: "You choose the second option.",
            environmentImpact: {
              lightingChange: { intensity: 1.2 },
              atmosphereChange: { fogDensity: 0.01 },
              animationEffect: {
                transitionType: 'zoom',
                intensity: 1.3,
                duration: 2.5
              }
            }
          }
        ];
      }
      
      // Look for bullet points or dashes
      const bulletItems = jsonString.match(/[\*\-•]\s*([^\n\.]+)/g);
      if (bulletItems && bulletItems.length >= 2) {
        console.log('Found bullet items:', bulletItems);
        return [
          {
            text: bulletItems[0].replace(/^[\*\-•]\s*/, '').trim(),
            consequence: "You choose this path.",
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
            text: bulletItems[1].replace(/^[\*\-•]\s*/, '').trim(),
            consequence: "You choose this direction.",
            environmentImpact: {
              lightingChange: { intensity: 1.2 },
              atmosphereChange: { fogDensity: 0.01 },
              animationEffect: {
                transitionType: 'zoom',
                intensity: 1.3,
                duration: 2.5
              }
            }
          }
        ];
      }
    } catch (e) {
      console.warn('Failed to parse using structured content approach:', e);
    }
    
    // If all approaches fail, fall back to default choices
    console.warn('All parsing approaches failed, using default choices');
    throw new Error('Could not extract valid choices from any approach');
  } catch (e) {
    console.warn('Failed to parse choices, using defaults:', e);
    return [
      {
        text: "Explore further",
        consequence: "You decide to venture deeper into the unknown.",
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
        text: "Stay cautious",
        consequence: "You decide to carefully observe your surroundings before proceeding.",
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

// Base environments with default descriptions
const baseEnvironments = {
  forest: {
    defaultDescription: "You find yourself in a mysterious forest clearing. The air is thick with anticipation, and strange sounds echo in the distance.",
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
  ruins: {
    defaultDescription: "Ancient stone structures rise before you, covered in vines and moss. The remnants of a forgotten civilization.",
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
  },
  cave: {
    defaultDescription: "The dark cave opens before you, stalactites hanging from the ceiling. Water drips somewhere in the distance.",
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
  }
};

// Add utility function to generate summaries
const generateSummary = async (text: string, previousSummary: string = ""): Promise<string> => {
  try {
    const summaryPrompt = `
Summarize this story in a single concise paragraph (max 3 sentences):

Previous summary: ${previousSummary}

New content: ${text}

Keep only the most important plot points and character information.
`;

    // Generate a summary with the LLM
    const summary = await generateText(summaryPrompt);
    return summary.trim();
  } catch (error) {
    console.error("Failed to generate summary:", error);
    // If there's an error, return a simple concatenation
    const simpleSummary = previousSummary ? 
      `${previousSummary} Then, ${text.split('.')[0]}.` : 
      text.split('.')[0] + ".";
    return simpleSummary.substring(0, 200); // Limit length
  }
};

// Constants for prompt refreshing
const REFRESH_PROMPT_AFTER_SEGMENTS = 3; // Refresh prompt every 3 story segments

// Build prompt using summary and last paragraph
const buildPrompt = (summary: string, lastParagraph: string, setting: string): string => `
Genre: Fantasy
Setting: ${setting}
Story summary: ${summary}

Last scene:
${lastParagraph}

Write a brief continuation of this fantasy story in 2-3 sentences. Be vivid but concise.
`;

// Build a fresh prompt from scratch to prevent model drift
const buildFreshPrompt = (
  summary: string, 
  lastParagraph: string, 
  setting: string, 
  metadata: { mood: string, timeOfDay: string, weatherConditions: string }
): string => `
RESET CONTEXT
Genre: Fantasy Adventure
Setting: A ${metadata.mood} ${setting} during ${metadata.timeOfDay}, ${metadata.weatherConditions} conditions

Complete Story Summary: ${summary}

Most Recent Scene:
${lastParagraph}

Write a fresh, focused continuation of this fantasy story in 2-3 sentences.
Be vivid but concise. Match the established mood and setting.
Avoid repeating phrases from the summary.
`;

// Function to refresh the story's prompt and summary
const refreshStoryPrompt = async (
  storySummary: string,
  lastSegment: StorySegment
): Promise<string> => {
  // Generate a completely new summary from the entire story history
  // This helps prevent drift by providing a fresh starting point
  const newSummaryPrompt = `
Create a fresh, concise summary (3 sentences max) of this fantasy story:

${storySummary}

Focus only on the most important plot points and character development.
Capture the essence of the story without using repetitive language.
`;

  try {
    // Generate the refreshed summary
    const refreshedSummary = await generateText(newSummaryPrompt);
    
    // Update the store with the refreshed summary
    useStoryStore.getState().updateStorySummary(refreshedSummary);
    useStoryStore.getState().resetSegmentCount();
    
    console.log('Prompt refreshed with new summary:', refreshedSummary);
    return refreshedSummary;
  } catch (error) {
    console.error('Error refreshing story prompt:', error);
    // If refresh fails, just return the original summary
    return storySummary;
  }
};

// Function to generate the initial story using the LLM
export const generateInitialStory = async (): Promise<StorySegment> => {
  console.log('Generating initial story with LLM...');
  
  try {
    // Use forest as default starting environment
    const environment = baseEnvironments.forest;
    
    // Generate story text with LLM - improved prompt
    const prompt = "Write a brief, one-line introduction to a fantasy adventure";
    const generatedText = await generateText(prompt);
    
    // Generate initial summary
    const summary = await generateSummary(generatedText);
    
    // Update store with the summary
    useStoryStore.getState().updateStorySummary(summary);
    
    // Generate choices with LLM - simplified prompt for better JSON output
    const choicesPrompt = `Answer with ONLY a JSON array and nothing else. Create two choices for a  adventure.

RESPOND WITH ONLY THIS JSON FORMAT:
[{"text":"First choice text","consequence":"First choice result"},{"text":"Second choice text","consequence":"Second choice result"}]

Keep each text and consequence under 10 words.`;
    
    const choicesText = await generateText(choicesPrompt);
    
    const choices = parseChoicesFromText(choicesText);
    
    return {
      text: generatedText || environment.defaultDescription,
      environment: {
        baseEnvironment: 'forest',
        lighting: environment.lighting,
        atmosphere: environment.atmosphere,
        props: []
      },
      choices: choices,
      metadata: environment.metadata
    };
  } catch (error) {
    console.error('Failed to generate initial story:', error);
    
    // Fallback to a predefined story if LLM generation fails
    const fallbackText = baseEnvironments.forest.defaultDescription;
    
    // Generate initial summary for fallback
    const summary = await generateSummary(fallbackText).catch(() => "A protagonist finds themselves in a mysterious forest.");
    useStoryStore.getState().updateStorySummary(summary);
    
    return {
      text: fallbackText,
      environment: {
        baseEnvironment: 'forest',
        lighting: baseEnvironments.forest.lighting,
        atmosphere: baseEnvironments.forest.atmosphere,
        props: []
      },
      choices: [
        {
          text: "Explore further",
          consequence: "You decide to venture deeper into this mysterious forest.",
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
          text: "Stay cautious",
          consequence: "You decide to carefully observe your surroundings before proceeding.",
          environmentImpact: {
            lightingChange: { intensity: 1.4 },
            atmosphereChange: { fogDensity: 0.01 },
            animationEffect: {
              transitionType: 'fade',
              intensity: 1.1,
              duration: 2
            }
          }
        }
      ],
      metadata: baseEnvironments.forest.metadata
    };
  }
};

// Function to generate the next story segment based on the choice made using LLM
export const generateNextStorySegment = async (
  currentStory: StorySegment,
  choice: Choice
): Promise<StorySegment> => {
  console.log('Generating next story segment with LLM...');
  
  try {
    // Get the current summary and segment count from the store
    const { storySummary, segmentsSincePromptRefresh } = useStoryStore.getState();
    
    // Increment the segment count
    useStoryStore.getState().incrementSegmentCount();
    
    // Determine if we need to refresh the prompt
    const shouldRefreshPrompt = segmentsSincePromptRefresh >= REFRESH_PROMPT_AFTER_SEGMENTS;
    let workingSummary = storySummary;
    
    // If it's time to refresh the prompt, generate a fresh summary
    if (shouldRefreshPrompt) {
      console.log('Refreshing story prompt after', segmentsSincePromptRefresh, 'segments');
      workingSummary = await refreshStoryPrompt(storySummary, currentStory);
    }
    
    // Generate the continuation using the summary and last paragraph
    const lastParagraph = currentStory.text.split(".").slice(-2).join(".").trim();
    const nextText = `${choice.consequence} `;
    
    // Use either the standard prompt or the fresh prompt based on whether we're refreshing
    const storyPrompt = shouldRefreshPrompt 
      ? buildFreshPrompt(
          workingSummary,
          lastParagraph,
          currentStory.environment.baseEnvironment,
          currentStory.metadata
        )
      : buildPrompt(
          workingSummary,
          lastParagraph,
          currentStory.environment.baseEnvironment
        );
    
    const generatedText = await generateText(storyPrompt);
    const fullNewText = nextText + generatedText;
    
    // Update the summary with the new content (only if we didn't just refresh it)
    if (!shouldRefreshPrompt) {
      const updatedSummary = await generateSummary(fullNewText, workingSummary);
      useStoryStore.getState().updateStorySummary(updatedSummary);
    }
    
    // Determine the next environment
    let nextEnvironment = currentStory.environment.baseEnvironment;
    // Simple logic to potentially change environment based on text
    const lowerText = generatedText.toLowerCase();
    if (lowerText.includes('cave') || lowerText.includes('cavern') || lowerText.includes('underground')) {
      nextEnvironment = 'cave';
    } else if (lowerText.includes('ruin') || lowerText.includes('ancient') || lowerText.includes('structure')) {
      nextEnvironment = 'ruins';
    }
    
    // Get appropriate environment settings
    const environmentSettings = baseEnvironments[nextEnvironment as keyof typeof baseEnvironments] || baseEnvironments.forest;
    
    // Generate new choices with LLM - simplified prompt for better JSON output
    const choicesPrompt = `Answer with ONLY a JSON array and nothing else. Create two choices based on this situation: "${generatedText}"

RESPOND WITH ONLY THIS JSON FORMAT:
[{"text":"First choice text","consequence":"First choice result"},{"text":"Second choice text","consequence":"Second choice result"}]

Keep each text and consequence under 10 words.`;
    
    const choicesText = await generateText(choicesPrompt);
    
    const newChoices = parseChoicesFromText(choicesText);
    
    return {
      text: fullNewText,
      environment: {
        baseEnvironment: nextEnvironment,
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
      choices: newChoices,
      metadata: {
        ...environmentSettings.metadata,
        location: nextEnvironment
      }
    };
  } catch (error) {
    console.error('Failed to generate next story segment:', error);
    
    // Fallback to a simpler story segment if LLM generation fails
    const fallbackText = `${choice.consequence} As you continue your journey, new paths reveal themselves.`;
    
    return {
      text: fallbackText,
      environment: {
        ...currentStory.environment,
        baseEnvironment: currentStory.environment.baseEnvironment,
        lighting: {
          ...currentStory.environment.lighting,
          ...choice.environmentImpact.lightingChange
        },
        atmosphere: {
          ...currentStory.environment.atmosphere,
          ...choice.environmentImpact.atmosphereChange
        }
      },
      choices: [
        {
          text: "Explore the area",
          consequence: "You take time to explore your surroundings.",
          environmentImpact: {
            lightingChange: { intensity: 1.1 },
            atmosphereChange: { fogDensity: 0.05 },
            animationEffect: {
              transitionType: 'zoom',
              intensity: 1.3,
              duration: 2.5
            }
          }
        },
        {
          text: "Continue on your path",
          consequence: "You decide to keep moving forward.",
          environmentImpact: {
            lightingChange: { intensity: 0.9 },
            atmosphereChange: { fogDensity: 0.03 },
            animationEffect: {
              transitionType: 'slide',
              intensity: 1.2,
              duration: 2
            }
          }
        }
      ],
      metadata: {
        ...currentStory.metadata,
        location: currentStory.environment.baseEnvironment
      }
    };
  }
}; 