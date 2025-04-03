import React, { useEffect, useState, useRef } from 'react';
import { EnvironmentDescription } from '../types/Environment';
import { StoryMetadata } from '../types/Story';

interface BasicEnvironmentProps {
  environmentDescription: EnvironmentDescription;
  metadata: StoryMetadata;
  previousMetadata?: StoryMetadata;
}

export const BasicEnvironment: React.FC<BasicEnvironmentProps> = ({
  environmentDescription,
  metadata,
  previousMetadata
}) => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionType, setTransitionType] = useState<'fade' | 'slide' | 'zoom'>('fade');
  const [animationIntensity, setAnimationIntensity] = useState(1);
  const [animationDuration, setAnimationDuration] = useState(2);
  const prevEnvRef = useRef<string | null>(null);
  
  // Apply animation effects from environment description if available
  useEffect(() => {
    // Extract animation effect from the environment description if present
    const animationEffect = environmentDescription.props
      .find(prop => prop.type === 'animationEffect')?.scale?.[0] || 1;
      
    // Set animation intensity based on lighting or props
    setAnimationIntensity(animationEffect);
  }, [environmentDescription]);
  
  // Start transition when environment changes
  useEffect(() => {
    if (!previousMetadata) return;
    
    const hasLocationChanged = previousMetadata.location !== metadata.location;
    const hasTimeChanged = previousMetadata.timeOfDay !== metadata.timeOfDay;
    const hasWeatherChanged = previousMetadata.weatherConditions !== metadata.weatherConditions;
    const hasMoodChanged = previousMetadata.mood !== metadata.mood;
    
    if (hasLocationChanged || hasTimeChanged || hasWeatherChanged || hasMoodChanged) {
      // Use animation effect if available in props (added through choice impact)
      const animationEffectProp = environmentDescription.props
        .find(prop => prop.type === 'animationEffect');
        
      if (animationEffectProp) {
        // Extract animation settings from prop
        const effect = {
          transitionType: animationEffectProp.position[0] as number,
          intensity: animationEffectProp.position[1] as number,
          duration: animationEffectProp.position[2] as number
        };
        
        // Apply animation effect
        setTransitionType(effect.transitionType === 0 ? 'fade' : 
                         effect.transitionType === 1 ? 'slide' : 'zoom');
        setAnimationIntensity(effect.intensity);
        setAnimationDuration(effect.duration);
      } else {
        // Default animation based on what changed
        if (hasLocationChanged) {
          setTransitionType('slide');
        } else if (hasTimeChanged) {
          setTransitionType('fade');
        } else if (hasWeatherChanged) {
          setTransitionType('zoom');
        } else {
          setTransitionType('fade');
        }
        
        // Store previous environment for transition direction
        prevEnvRef.current = previousMetadata.location;
        
        // Adjust animation intensity based on lighting changes
        const lightingChange = environmentDescription.lighting.intensity || 1;
        setAnimationIntensity(Math.abs(lightingChange - 1) * 2 + 1);
        setAnimationDuration(2); // Default duration
      }
      
      setIsTransitioning(true);
      
      // End transition after animation completes
      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, animationDuration * 1000);
      
      return () => clearTimeout(timer);
    }
  }, [metadata, previousMetadata, environmentDescription]);
  
  // Get environment colors based on metadata
  const getEnvironmentStyle = () => {
    // Base colors for different environments
    const baseColors = {
      forest: {
        top: '#2980B9',
        bottom: '#2D572C'
      },
      mountains: {
        top: '#5D4157',
        bottom: '#808080'
      },
      desert: {
        top: '#F9D423',
        bottom: '#E2C391'
      },
      beach: {
        top: '#36D1DC',
        bottom: '#F5DEB3'
      },
      cave: {
        top: '#232526',
        bottom: '#414345'
      },
      city: {
        top: '#5C258D',
        bottom: '#4389A2'
      },
      ruins: {
        top: '#3C3B3F',
        bottom: '#A19D94'
      }
    };
    
    // Default to forest if location not found
    const location = metadata.location in baseColors 
      ? metadata.location 
      : 'forest';
    
    // Get base colors for this location
    const colors = baseColors[location as keyof typeof baseColors];
    
    // Modify colors based on time of day
    let topColor = colors.top;
    let bottomColor = colors.bottom;
    
    switch (metadata.timeOfDay) {
      case 'dawn':
        topColor = blendColors(colors.top, '#FF9A9E', 0.3);
        bottomColor = blendColors(colors.bottom, '#FF9A9E', 0.2);
        break;
      case 'day':
        // Use default colors
        break;
      case 'dusk':
        topColor = blendColors(colors.top, '#FF6B6B', 0.3);
        bottomColor = blendColors(colors.bottom, '#FD746C', 0.2);
        break;
      case 'night':
        topColor = darkenColor(colors.top, 50);
        bottomColor = darkenColor(colors.bottom, 30);
        break;
    }
    
    // Modify colors based on weather
    switch (metadata.weatherConditions) {
      case 'rainy':
        topColor = darkenColor(topColor, 20);
        bottomColor = darkenColor(bottomColor, 10);
        break;
      case 'stormy':
        topColor = darkenColor(topColor, 40);
        bottomColor = darkenColor(bottomColor, 20);
        break;
      case 'foggy':
        topColor = blendColors(topColor, '#FFFFFF', 0.3);
        bottomColor = blendColors(bottomColor, '#FFFFFF', 0.2);
        break;
      case 'snowy':
        topColor = blendColors(topColor, '#FFFFFF', 0.4);
        bottomColor = blendColors(bottomColor, '#FFFFFF', 0.3);
        break;
    }
    
    // Apply mood filter
    const moodOverlays = {
      happy: 'rgba(255, 255, 150, 0.2)',
      sad: 'rgba(0, 0, 150, 0.2)',
      tense: 'rgba(150, 0, 0, 0.2)',
      mysterious: 'rgba(128, 0, 128, 0.2)',
      peaceful: 'rgba(100, 200, 255, 0.2)',
      exciting: 'rgba(255, 165, 0, 0.2)'
    };
    
    const moodOverlay = metadata.mood in moodOverlays 
      ? moodOverlays[metadata.mood as keyof typeof moodOverlays] 
      : 'transparent';
    
    // Apply animation speed based on intensity
    const animationSpeedModifier = `--animation-speed: ${1 / animationIntensity}s`;
    
    return {
      background: `linear-gradient(to bottom, ${topColor} 0%, ${bottomColor} 100%)`,
      boxShadow: `inset 0 0 0 1000px ${moodOverlay}`,
      style: animationSpeedModifier
    };
  };
  
  // Helper to darken a hex color
  const darkenColor = (color: string, percent: number) => {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, (num >> 8 & 0x00FF) - amt);
    const B = Math.max(0, (num & 0x0000FF) - amt);
    return `#${(1 << 24 | R << 16 | G << 8 | B).toString(16).slice(1)}`;
  };
  
  // Helper to blend two hex colors
  const blendColors = (color1: string, color2: string, percentage: number) => {
    const parseHex = (hex: string) => {
      hex = hex.replace('#', '');
      return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16)
      };
    };
    
    const c1 = parseHex(color1);
    const c2 = parseHex(color2);
    
    const r = Math.floor(c1.r * (1 - percentage) + c2.r * percentage);
    const g = Math.floor(c1.g * (1 - percentage) + c2.g * percentage);
    const b = Math.floor(c1.b * (1 - percentage) + c2.b * percentage);
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };
  
  // Get decoration elements based on environment type
  const getEnvironmentDecorations = () => {
    switch (metadata.location) {
      case 'forest':
        return (
          <div className="decorations forest">
            <div className="tree large" style={{animationDuration: `${8 / animationIntensity}s`}}></div>
            <div className="tree medium" style={{animationDuration: `${10 / animationIntensity}s`}}></div>
            <div className="tree small" style={{animationDuration: `${7 / animationIntensity}s`}}></div>
            <div className="tree large right" style={{animationDuration: `${9 / animationIntensity}s`}}></div>
            <div className="tree medium right" style={{animationDuration: `${11 / animationIntensity}s`}}></div>
          </div>
        );
      case 'mountains':
        return (
          <div className="decorations mountains">
            <div className="mountain large"></div>
            <div className="mountain medium"></div>
            <div className="mountain small"></div>
          </div>
        );
      case 'desert':
        return (
          <div className="decorations desert">
            <div className="dune large"></div>
            <div className="dune medium"></div>
            <div className="cactus"></div>
            <div className="cactus right"></div>
          </div>
        );
      case 'beach':
        return (
          <div className="decorations beach">
            <div className="ocean" style={{animationDuration: `${8 / animationIntensity}s`}}></div>
            <div className="palm-tree" style={{animationDuration: `${10 / animationIntensity}s`}}></div>
            <div className="palm-tree right" style={{animationDuration: `${12 / animationIntensity}s`}}></div>
          </div>
        );
      case 'city':
        return (
          <div className="decorations city">
            <div className="building tall"></div>
            <div className="building medium"></div>
            <div className="building small"></div>
            <div className="building medium-tall"></div>
          </div>
        );
      default:
        return <div className="decorations"></div>;
    }
  };
  
  // Generate weather effects
  const getWeatherEffects = () => {
    const intensityStyle = { 
      animationDuration: metadata.weatherConditions === 'stormy' 
        ? `${0.3 / animationIntensity}s` 
        : `${0.5 / animationIntensity}s` 
    };
    
    switch (metadata.weatherConditions) {
      case 'rainy':
        return <div className="weather-effect rain" style={intensityStyle}></div>;
      case 'stormy':
        return (
          <>
            <div className="weather-effect rain heavy" style={intensityStyle}></div>
            <div className="weather-effect lightning" style={{animationDuration: `${10 / animationIntensity}s`}}></div>
          </>
        );
      case 'foggy':
        return <div className="weather-effect fog" style={{animationDuration: `${20 / animationIntensity}s`}}></div>;
      case 'snowy':
        return <div className="weather-effect snow" style={{animationDuration: `${10 / animationIntensity}s`}}></div>;
      default:
        return null;
    }
  };
  
  // Get transition class based on type
  const getTransitionClass = () => {
    if (!isTransitioning) return '';
    
    switch (transitionType) {
      case 'slide':
        // Determine slide direction based on previous environment
        const slideDirection = prevEnvRef.current === 'forest' && metadata.location === 'mountains' ? 'slide-left' : 'slide-right';
        return `transitioning ${slideDirection}`;
      case 'zoom':
        return 'transitioning zoom';
      case 'fade':
      default:
        return 'transitioning';
    }
  };
  
  const environmentStyle = getEnvironmentStyle();
  const animationStyle = {
    '--animation-speed': `${1 / animationIntensity}s`,
    '--transition-duration': `${animationDuration}s`,
  } as React.CSSProperties;
  
  return (
    <div 
      className={`environment-container ${getTransitionClass()}`}
      style={{
        background: environmentStyle.background,
        boxShadow: environmentStyle.boxShadow,
        ...animationStyle
      }}
    >
      {getEnvironmentDecorations()}
      {getWeatherEffects()}
    </div>
  );
}; 