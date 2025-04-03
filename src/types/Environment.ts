export interface EnvironmentDescription {
  baseEnvironment: string;
  lighting: LightingConfig;
  atmosphere: AtmosphereConfig;
  props: Prop[];
}

export interface LightingConfig {
  intensity: number;
  color: string;
  ambient: number;
  shadows: boolean;
}

export interface AtmosphereConfig {
  fog: boolean;
  fogDensity?: number;
  fogColor?: string;
  particles?: ParticleConfig;
}

export interface ParticleConfig {
  type: string;
  density: number;
  speed: number;
}

export interface Prop {
  type: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}

export interface AnimationEffect {
  transitionType?: 'fade' | 'slide' | 'zoom';
  intensity?: number;  // How intense the animation should be (1 is normal)
  duration?: number;   // How long the effect lasts in seconds
}

export interface EnvironmentModification {
  lightingChange?: Partial<LightingConfig>;
  atmosphereChange?: Partial<AtmosphereConfig>;
  addProps?: Prop[];
  removeProps?: string[];
  animationEffect?: AnimationEffect;
} 