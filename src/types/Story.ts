import { EnvironmentDescription, EnvironmentModification } from './Environment';

export interface StorySegment {
  text: string;
  environment: EnvironmentDescription;
  choices: Choice[];
  metadata: StoryMetadata;
}

export interface Choice {
  text: string;
  consequence: string;
  environmentImpact: EnvironmentModification;
}

export interface StoryMetadata {
  mood: string;
  location: string;
  timeOfDay: string;
  weatherConditions: string;
} 