import React, { useEffect, useState, useRef } from 'react';
import { EnvironmentDescription } from '../../types/Environment';
import { StoryMetadata } from '../../types/Story';

interface Scene2DProps {
  environmentDescription: EnvironmentDescription;
  metadata: StoryMetadata;
  previousMetadata?: StoryMetadata;
}

export const Scene2D: React.FC<Scene2DProps> = ({ 
  environmentDescription, 
  metadata,
  previousMetadata
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionProgress, setTransitionProgress] = useState(0);
  
  // Track previous state for smooth transitions
  const prevEnvironmentRef = useRef<EnvironmentDescription | null>(null);
  
  // Handle environment changes and transitions
  useEffect(() => {
    if (!prevEnvironmentRef.current) {
      prevEnvironmentRef.current = environmentDescription;
      drawScene(environmentDescription, metadata);
      return;
    }
    
    // If environment has changed, start transition
    if (prevEnvironmentRef.current.baseEnvironment !== environmentDescription.baseEnvironment ||
        prevEnvironmentRef.current.lighting.color !== environmentDescription.lighting.color ||
        metadata.location !== previousMetadata?.location ||
        metadata.timeOfDay !== previousMetadata?.timeOfDay ||
        metadata.weatherConditions !== previousMetadata?.weatherConditions) {
      
      startTransition(prevEnvironmentRef.current, environmentDescription);
    } else {
      // No significant change, just redraw
      drawScene(environmentDescription, metadata);
    }
    
    prevEnvironmentRef.current = environmentDescription;
  }, [environmentDescription, metadata, previousMetadata]);
  
  const startTransition = (fromEnv: EnvironmentDescription, toEnv: EnvironmentDescription) => {
    setIsTransitioning(true);
    setTransitionProgress(0);
    
    const transitionDuration = 2000; // 2 seconds
    const startTime = Date.now();
    
    const animateTransition = () => {
      const elapsedTime = Date.now() - startTime;
      const progress = Math.min(elapsedTime / transitionDuration, 1);
      
      setTransitionProgress(progress);
      
      // Blend between environments based on progress
      const blendedEnv = blendEnvironments(fromEnv, toEnv, progress);
      drawScene(blendedEnv, metadata);
      
      if (progress < 1) {
        requestAnimationFrame(animateTransition);
      } else {
        setIsTransitioning(false);
      }
    };
    
    requestAnimationFrame(animateTransition);
  };
  
  const blendEnvironments = (from: EnvironmentDescription, to: EnvironmentDescription, progress: number) => {
    // Simple linear interpolation between environments
    return {
      ...to,
      lighting: {
        ...to.lighting,
        intensity: from.lighting.intensity + (to.lighting.intensity - from.lighting.intensity) * progress,
        ambient: from.lighting.ambient + (to.lighting.ambient - from.lighting.ambient) * progress,
      }
    };
  };

  // Draw the 2D scene based on environment description
  const drawScene = (env: EnvironmentDescription, meta: StoryMetadata) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set canvas dimensions to match parent container
    canvas.width = canvas.parentElement?.clientWidth || 800;
    canvas.height = canvas.parentElement?.clientHeight || 600;
    
    // Draw background based on time of day and weather
    drawBackground(ctx, canvas.width, canvas.height, meta);
    
    // Draw terrain based on location
    drawTerrain(ctx, canvas.width, canvas.height, meta);
    
    // Draw props
    env.props.forEach(prop => {
      drawProp(ctx, prop.type, prop.position, canvas.width, canvas.height);
    });
    
    // Apply mood/lighting overlay
    applyMoodOverlay(ctx, canvas.width, canvas.height, meta.mood, env.lighting);
  };
  
  const drawBackground = (ctx: CanvasRenderingContext2D, width: number, height: number, meta: StoryMetadata) => {
    // Sky gradient based on time of day
    let topColor, bottomColor;
    
    switch (meta.timeOfDay) {
      case 'dawn':
        topColor = '#1e3c72';
        bottomColor = '#ff9a9e';
        break;
      case 'day':
        topColor = '#2980B9';
        bottomColor = '#6DD5FA';
        break;
      case 'dusk':
        topColor = '#2c3e50';
        bottomColor = '#fd746c';
        break;
      case 'night':
        topColor = '#0f2027';
        bottomColor = '#203a43';
        break;
      default:
        topColor = '#2980B9';
        bottomColor = '#6DD5FA';
    }
    
    // Modify colors based on weather
    if (meta.weatherConditions === 'rainy') {
      topColor = darkenColor(topColor, 30);
      bottomColor = darkenColor(bottomColor, 30);
    } else if (meta.weatherConditions === 'stormy') {
      topColor = darkenColor(topColor, 50);
      bottomColor = darkenColor(bottomColor, 50);
    } else if (meta.weatherConditions === 'foggy') {
      topColor = blendWithColor(topColor, '#ffffff', 0.4);
      bottomColor = blendWithColor(bottomColor, '#ffffff', 0.4);
    }
    
    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, topColor);
    gradient.addColorStop(1, bottomColor);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Add weather effects
    if (meta.weatherConditions === 'rainy' || meta.weatherConditions === 'stormy') {
      drawRain(ctx, width, height, meta.weatherConditions === 'stormy');
    } else if (meta.weatherConditions === 'snowy') {
      drawSnow(ctx, width, height);
    } else if (meta.weatherConditions === 'foggy') {
      drawFog(ctx, width, height);
    }
  };
  
  const drawTerrain = (ctx: CanvasRenderingContext2D, width: number, height: number, meta: StoryMetadata) => {
    // Draw different terrain based on location
    switch (meta.location) {
      case 'forest':
        drawForest(ctx, width, height);
        break;
      case 'mountains':
        drawMountains(ctx, width, height);
        break;
      case 'desert':
        drawDesert(ctx, width, height);
        break;
      case 'beach':
        drawBeach(ctx, width, height);
        break;
      case 'city':
        drawCity(ctx, width, height);
        break;
      default:
        drawGenericLandscape(ctx, width, height);
    }
  };
  
  const drawForest = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Draw ground
    ctx.fillStyle = '#2d572c';
    ctx.fillRect(0, height * 0.7, width, height * 0.3);
    
    // Draw trees
    const treeCount = Math.floor(width / 100);
    for (let i = 0; i < treeCount; i++) {
      const x = (width / treeCount) * i + Math.random() * 50;
      const y = height * 0.7;
      const treeHeight = height * 0.2 + Math.random() * height * 0.1;
      
      // Tree trunk
      ctx.fillStyle = '#5e3a1e';
      ctx.fillRect(x - 5, y - treeHeight * 0.3, 10, treeHeight * 0.3);
      
      // Tree crown
      ctx.fillStyle = '#2e5829';
      ctx.beginPath();
      ctx.moveTo(x, y - treeHeight);
      ctx.lineTo(x + 30, y - treeHeight * 0.4);
      ctx.lineTo(x - 30, y - treeHeight * 0.4);
      ctx.closePath();
      ctx.fill();
      
      ctx.beginPath();
      ctx.moveTo(x, y - treeHeight * 0.8);
      ctx.lineTo(x + 25, y - treeHeight * 0.2);
      ctx.lineTo(x - 25, y - treeHeight * 0.2);
      ctx.closePath();
      ctx.fill();
    }
  };
  
  const drawMountains = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Draw ground
    ctx.fillStyle = '#4b5536';
    ctx.fillRect(0, height * 0.7, width, height * 0.3);
    
    // Draw mountains
    ctx.fillStyle = '#808080';
    
    // First mountain
    ctx.beginPath();
    ctx.moveTo(0, height * 0.7);
    ctx.lineTo(width * 0.33, height * 0.3);
    ctx.lineTo(width * 0.66, height * 0.7);
    ctx.closePath();
    ctx.fill();
    
    // Second mountain
    ctx.fillStyle = '#606060';
    ctx.beginPath();
    ctx.moveTo(width * 0.4, height * 0.7);
    ctx.lineTo(width * 0.7, height * 0.35);
    ctx.lineTo(width, height * 0.7);
    ctx.closePath();
    ctx.fill();
    
    // Snow caps
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(width * 0.25, height * 0.35);
    ctx.lineTo(width * 0.33, height * 0.3);
    ctx.lineTo(width * 0.41, height * 0.35);
    ctx.closePath();
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(width * 0.63, height * 0.4);
    ctx.lineTo(width * 0.7, height * 0.35);
    ctx.lineTo(width * 0.77, height * 0.4);
    ctx.closePath();
    ctx.fill();
  };
  
  const drawDesert = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Draw sand
    ctx.fillStyle = '#E2C391';
    ctx.fillRect(0, height * 0.6, width, height * 0.4);
    
    // Draw sand dunes
    ctx.fillStyle = '#D4B483';
    
    ctx.beginPath();
    ctx.moveTo(0, height * 0.7);
    ctx.quadraticCurveTo(width * 0.25, height * 0.6, width * 0.5, height * 0.7);
    ctx.quadraticCurveTo(width * 0.75, height * 0.8, width, height * 0.65);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();
    
    // Draw cacti
    const cactiCount = 3;
    for (let i = 0; i < cactiCount; i++) {
      const x = width * (0.2 + 0.3 * i);
      const y = height * 0.65;
      
      // Cactus stem
      ctx.fillStyle = '#5D8A66';
      ctx.fillRect(x - 5, y - 40, 10, 40);
      
      // Cactus arms
      if (i % 2 === 0) {
        ctx.fillRect(x, y - 30, 15, 5);
        ctx.fillRect(x + 15, y - 30, 5, 15);
      } else {
        ctx.fillRect(x - 15, y - 25, 15, 5);
        ctx.fillRect(x - 15, y - 25, 5, 15);
      }
    }
  };
  
  const drawBeach = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Draw water
    ctx.fillStyle = '#0099cc';
    ctx.fillRect(0, 0, width, height * 0.6);
    
    // Draw sand
    ctx.fillStyle = '#f5deb3';
    ctx.beginPath();
    ctx.moveTo(0, height * 0.6);
    ctx.quadraticCurveTo(width * 0.5, height * 0.55, width, height * 0.65);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();
    
    // Draw palm trees
    const x = width * 0.8;
    const y = height * 0.65;
    
    // Trunk
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x - 5, y - 40, x + 5, y - 80, x - 10, y - 120);
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#8B4513';
    ctx.stroke();
    
    // Leaves
    ctx.fillStyle = '#3d8b3d';
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      ctx.beginPath();
      ctx.ellipse(
        x - 10 + Math.cos(angle) * 20, 
        y - 120 + Math.sin(angle) * 10, 
        40, 15, 
        angle, 0, Math.PI
      );
      ctx.fill();
    }
  };
  
  const drawCity = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Draw ground
    ctx.fillStyle = '#555555';
    ctx.fillRect(0, height * 0.7, width, height * 0.3);
    
    // Draw buildings
    const buildingCount = 7;
    const buildingWidth = width / buildingCount;
    
    for (let i = 0; i < buildingCount; i++) {
      const x = i * buildingWidth;
      const buildingHeight = height * (0.2 + Math.random() * 0.3);
      const y = height * 0.7 - buildingHeight;
      
      // Building
      ctx.fillStyle = `rgb(${50 + Math.random() * 100}, ${50 + Math.random() * 100}, ${50 + Math.random() * 100})`;
      ctx.fillRect(x, y, buildingWidth - 5, buildingHeight);
      
      // Windows
      const windowRows = Math.floor(buildingHeight / 20);
      const windowCols = Math.floor(buildingWidth / 20);
      
      for (let row = 0; row < windowRows; row++) {
        for (let col = 0; col < windowCols; col++) {
          // Some windows are lit, some are dark
          if (Math.random() > 0.3) {
            ctx.fillStyle = 'rgba(255, 255, 200, 0.8)';
          } else {
            ctx.fillStyle = 'rgba(20, 20, 50, 0.8)';
          }
          
          ctx.fillRect(
            x + 5 + col * 15, 
            y + 5 + row * 15, 
            10, 10
          );
        }
      }
    }
    
    // Draw road
    ctx.fillStyle = '#333333';
    ctx.fillRect(0, height * 0.7, width, height * 0.05);
    
    // Road markings
    ctx.strokeStyle = '#ffffff';
    ctx.setLineDash([20, 10]);
    ctx.beginPath();
    ctx.moveTo(0, height * 0.725);
    ctx.lineTo(width, height * 0.725);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  
  const drawGenericLandscape = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Simple ground
    ctx.fillStyle = '#7CB897';
    ctx.fillRect(0, height * 0.7, width, height * 0.3);
    
    // Simple hills
    ctx.fillStyle = '#5F966E';
    ctx.beginPath();
    ctx.moveTo(0, height * 0.8);
    ctx.quadraticCurveTo(width * 0.25, height * 0.65, width * 0.5, height * 0.8);
    ctx.quadraticCurveTo(width * 0.75, height * 0.65, width, height * 0.75);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();
  };
  
  const drawProp = (
    ctx: CanvasRenderingContext2D, 
    type: string, 
    position: [number, number, number], 
    width: number, 
    height: number
  ) => {
    // Map 3D position to 2D canvas
    // Using basic perspective where y determines both position and size
    const x = width * ((position[0] + 1) / 2);
    const y = height * 0.7 - (position[1] * height * 0.2);
    const scale = 0.5 + position[2] * 0.5; // Objects further away appear smaller
    
    switch (type) {
      case 'rock':
        drawRock(ctx, x, y, scale);
        break;
      case 'tree':
        drawTree(ctx, x, y, scale);
        break;
      case 'bush':
        drawBush(ctx, x, y, scale);
        break;
      case 'flower':
        drawFlower(ctx, x, y, scale);
        break;
      default:
        // Draw a generic object
        ctx.fillStyle = '#555555';
        ctx.fillRect(x - 10 * scale, y - 20 * scale, 20 * scale, 20 * scale);
    }
  };
  
  const drawRock = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) => {
    ctx.fillStyle = '#888888';
    ctx.beginPath();
    ctx.ellipse(x, y, 15 * scale, 10 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  
  const drawTree = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) => {
    const trunkHeight = 40 * scale;
    
    // Tree trunk
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x - 5 * scale, y - trunkHeight, 10 * scale, trunkHeight);
    
    // Tree crown
    ctx.fillStyle = '#2d692d';
    ctx.beginPath();
    ctx.arc(x, y - trunkHeight - 20 * scale, 25 * scale, 0, Math.PI * 2);
    ctx.fill();
  };
  
  const drawBush = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) => {
    ctx.fillStyle = '#2e8b57';
    
    // Draw a cluster of overlapping circles for the bush
    for (let i = 0; i < 5; i++) {
      const offsetX = (Math.random() - 0.5) * 10 * scale;
      const offsetY = (Math.random() - 0.5) * 10 * scale;
      
      ctx.beginPath();
      ctx.arc(x + offsetX, y + offsetY, 10 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  
  const drawFlower = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) => {
    // Stem
    ctx.strokeStyle = '#3a5f0b';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 15 * scale);
    ctx.stroke();
    
    // Flower petals
    const colors = ['#ff6b6b', '#ffb347', '#9fd356', '#BB8FCE'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    ctx.fillStyle = color;
    const petalCount = 5;
    const radius = 5 * scale;
    
    for (let i = 0; i < petalCount; i++) {
      const angle = (i / petalCount) * Math.PI * 2;
      const px = x + Math.cos(angle) * radius;
      const py = y - 15 * scale + Math.sin(angle) * radius;
      
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Flower center
    ctx.fillStyle = '#ffdd00';
    ctx.beginPath();
    ctx.arc(x, y - 15 * scale, radius * 0.6, 0, Math.PI * 2);
    ctx.fill();
  };
  
  const drawRain = (ctx: CanvasRenderingContext2D, width: number, height: number, isStormy: boolean) => {
    ctx.strokeStyle = 'rgba(200, 200, 255, 0.7)';
    ctx.lineWidth = 1;
    
    const raindropsCount = isStormy ? 100 : 50;
    const rainLength = isStormy ? 15 : 10;
    
    for (let i = 0; i < raindropsCount; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height * 0.7; // Only above ground
      
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 1, y + rainLength);
      ctx.stroke();
    }
    
    if (isStormy) {
      // Add lightning occasionally
      if (Math.random() > 0.9) {
        drawLightning(ctx, width, height);
      }
    }
  };
  
  const drawLightning = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.strokeStyle = 'rgba(255, 255, 200, 0.9)';
    ctx.lineWidth = 3;
    
    const startX = width * (0.3 + Math.random() * 0.4);
    let x = startX;
    let y = 0;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    
    while (y < height * 0.5) {
      y += Math.random() * 20 + 10;
      x += (Math.random() - 0.5) * 30;
      ctx.lineTo(x, y);
    }
    
    ctx.stroke();
    
    // Add glow
    ctx.strokeStyle = 'rgba(255, 255, 200, 0.3)';
    ctx.lineWidth = 6;
    ctx.stroke();
  };
  
  const drawSnow = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    
    const snowflakesCount = 100;
    
    for (let i = 0; i < snowflakesCount; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height * 0.7; // Only above ground
      const size = Math.random() * 3 + 1;
      
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  
  const drawFog = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Create a semi-transparent white overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    
    // Draw several horizontal fog bands
    for (let y = 0; y < height * 0.7; y += 50) {
      const opacity = Math.random() * 0.3 + 0.1;
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
      
      ctx.beginPath();
      ctx.ellipse(
        width / 2, 
        y + 25, 
        width / 2 + 100, 
        20, 
        0, 0, Math.PI * 2
      );
      ctx.fill();
    }
  };
  
  const applyMoodOverlay = (
    ctx: CanvasRenderingContext2D, 
    width: number, 
    height: number, 
    mood: string,
    lighting: any
  ) => {
    let overlayColor = 'rgba(0, 0, 0, 0)';
    let opacity = 0.2;
    
    // Set overlay color based on mood
    switch (mood) {
      case 'happy':
        overlayColor = `rgba(255, 255, 150, ${opacity})`;
        break;
      case 'sad':
        overlayColor = `rgba(0, 0, 150, ${opacity})`;
        break;
      case 'tense':
        overlayColor = `rgba(150, 0, 0, ${opacity})`;
        break;
      case 'mysterious':
        overlayColor = `rgba(128, 0, 128, ${opacity})`;
        break;
      case 'peaceful':
        overlayColor = `rgba(100, 200, 255, ${opacity})`;
        break;
      case 'exciting':
        overlayColor = `rgba(255, 165, 0, ${opacity})`;
        break;
      default:
        return; // No overlay for neutral mood
    }
    
    // Apply the overlay
    ctx.fillStyle = overlayColor;
    ctx.fillRect(0, 0, width, height);
    
    // Add vignette effect (darker corners)
    const gradient = ctx.createRadialGradient(
      width / 2, height / 2, height * 0.2,
      width / 2, height / 2, height
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  };
  
  // Helper function to darken colors
  const darkenColor = (color: string, percent: number) => {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, (num >> 8 & 0x00FF) - amt);
    const B = Math.max(0, (num & 0x0000FF) - amt);
    return `#${(1 << 24 | R << 16 | G << 8 | B).toString(16).slice(1)}`;
  };
  
  // Helper function to blend colors
  const blendWithColor = (color1: string, color2: string, ratio: number) => {
    const hex = (x: number) => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    
    const r1 = parseInt(color1.substring(1, 3), 16);
    const g1 = parseInt(color1.substring(3, 5), 16);
    const b1 = parseInt(color1.substring(5, 7), 16);
    
    const r2 = parseInt(color2.substring(1, 3), 16);
    const g2 = parseInt(color2.substring(3, 5), 16);
    const b2 = parseInt(color2.substring(5, 7), 16);
    
    const r = Math.round(r1 * (1 - ratio) + r2 * ratio);
    const g = Math.round(g1 * (1 - ratio) + g2 * ratio);
    const b = Math.round(b1 * (1 - ratio) + b2 * ratio);
    
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  };

  return (
    <div className="w-full h-full" style={{ height: '100vh', width: '100vw' }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
      />
      {isTransitioning && (
        <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded">
          Environment shifting... {Math.round(transitionProgress * 100)}%
        </div>
      )}
    </div>
  );
}; 