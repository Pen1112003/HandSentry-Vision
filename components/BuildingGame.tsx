
import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import Matter from 'matter-js';

interface BuildingGameProps {
  landmarks: any[] | null;
  onGameStateChange: (state: { score: number; isGameOver: boolean; isPinching: boolean }) => void;
  mirror: boolean;
}

export interface GameHandle {
  resetGame: () => void;
}

const BuildingGame = forwardRef<GameHandle, BuildingGameProps>(({ landmarks, onGameStateChange, mirror }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const renderRef = useRef<Matter.Render | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  
  const [currentBlock, setCurrentBlock] = useState<Matter.Body | null>(null);
  const isPinchingRef = useRef(false);
  const scoreRef = useRef(0);

  // Sound effect when dropping
  const playDropSound = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(150, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.2);

      gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.2);
    } catch (e) {
      console.warn("Audio blocked", e);
    }
  };

  // Helper to create a random shape
  const createRandomBlock = (x: number, y: number) => {
    const shapes = ['plank', 'brick', 'square', 'triangle', 'L-block'];
    const selected = shapes[Math.floor(Math.random() * shapes.length)];
    const colors = ['#0ea5e9', '#22d3ee', '#818cf8', '#fbbf24', '#f87171', '#c084fc'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    const commonOptions = {
      friction: 0.8,
      restitution: 0.05,
      density: 0.01,
      render: { fillStyle: color, strokeStyle: '#ffffff', lineWidth: 2 }
    };

    switch (selected) {
      case 'plank':
        return Matter.Bodies.rectangle(x, y, 180, 20, commonOptions);
      case 'square':
        return Matter.Bodies.rectangle(x, y, 60, 60, commonOptions);
      case 'triangle':
        return Matter.Bodies.polygon(x, y, 3, 55, commonOptions);
      case 'L-block':
        const partA = Matter.Bodies.rectangle(x, y, 100, 30, commonOptions);
        const partB = Matter.Bodies.rectangle(x - 35, y + 35, 30, 100, commonOptions);
        return Matter.Body.create({
          parts: [partA, partB],
          ...commonOptions
        });
      case 'brick':
      default:
        return Matter.Bodies.rectangle(x, y, 100, 50, commonOptions);
    }
  };

  useImperativeHandle(ref, () => ({
    resetGame: () => {
      if (engineRef.current) {
        Matter.World.clear(engineRef.current.world, false);
        setupInitialWorld();
        scoreRef.current = 0;
        onGameStateChange({ score: 0, isGameOver: false, isPinching: false });
      }
    }
  }));

  const setupInitialWorld = () => {
    if (!engineRef.current) return;
    const world = engineRef.current.world;
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Base platform
    const ground = Matter.Bodies.rectangle(width / 2, height - 40, 400, 60, {
      isStatic: true,
      render: { fillStyle: 'rgba(30, 41, 59, 0.8)', strokeStyle: '#475569', lineWidth: 4 }
    });

    Matter.World.add(world, [ground]);
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = Matter.Engine.create({
      gravity: { y: 1.5 } // Slightly stronger gravity for more physical feel
    });
    const runner = Matter.Runner.create();
    
    const render = Matter.Render.create({
      canvas: canvasRef.current,
      engine: engine,
      options: {
        width: window.innerWidth,
        height: window.innerHeight,
        wireframes: false,
        background: 'transparent'
      }
    });

    engineRef.current = engine;
    renderRef.current = render;
    runnerRef.current = runner;

    setupInitialWorld();
    Matter.Runner.run(runner, engine);
    Matter.Render.run(render);

    const checkInterval = setInterval(() => {
      const bodies = Matter.Composite.allBodies(engine.world);
      let maxHeight = 0;
      let gameOver = false;

      bodies.forEach(body => {
        if (!body.isStatic) {
          // Check if any part of the body fell too low
          if (body.position.y > window.innerHeight + 100) gameOver = true;
          
          // Calculate tower height from the ground (height - 40 is ground Y)
          const h = Math.max(0, (window.innerHeight - 70) - body.position.y);
          if (h > maxHeight) maxHeight = Math.round(h / 15);
        }
      });

      if (maxHeight !== scoreRef.current || gameOver) {
        scoreRef.current = maxHeight;
        onGameStateChange({ score: scoreRef.current, isGameOver: gameOver, isPinching: isPinchingRef.current });
      }
    }, 300);

    const handleResize = () => {
       if (renderRef.current && canvasRef.current) {
         canvasRef.current.width = window.innerWidth;
         canvasRef.current.height = window.innerHeight;
         renderRef.current.options.width = window.innerWidth;
         renderRef.current.options.height = window.innerHeight;
       }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      Matter.Render.stop(render);
      Matter.Runner.stop(runner);
      Matter.Engine.clear(engine);
      clearInterval(checkInterval);
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, []);

  useEffect(() => {
    if (!landmarks || landmarks.length === 0 || !engineRef.current) {
      if (currentBlock) {
        Matter.Body.setStatic(currentBlock, false);
        setCurrentBlock(null);
        isPinchingRef.current = false;
        playDropSound();
      }
      return;
    }

    const hand = landmarks[0];
    const thumbTip = hand[4];
    const indexTip = hand[8];

    const dist = Math.sqrt(
      Math.pow(thumbTip.x - indexTip.x, 2) + Math.pow(thumbTip.y - indexTip.y, 2)
    );

    let midX = thumbTip.x * window.innerWidth;
    const midY = thumbTip.y * window.innerHeight;

    // Note: Landmarks are already mirrored by HandTracker component's mirroring logic if applied to coordinates
    // However, HandTracker currently passes raw landmarks from MediaPipe and mirrors the CANVAS.
    // If mirror is true, we need to flip the landmark coordinate to match the visual.
    if (mirror) midX = window.innerWidth - midX;

    const isPinching = dist < 0.08; // Slightly larger tolerance for full screen

    if (isPinching) {
      if (!currentBlock) {
        const newBlock = createRandomBlock(midX, midY);
        Matter.Body.setStatic(newBlock, true);
        Matter.World.add(engineRef.current.world, newBlock);
        setCurrentBlock(newBlock);
      } else {
        Matter.Body.setPosition(currentBlock, { x: midX, y: midY });
      }
    } else {
      if (currentBlock) {
        Matter.Body.setStatic(currentBlock, false);
        setCurrentBlock(null);
        playDropSound();
      }
    }

    if (isPinching !== isPinchingRef.current) {
      isPinchingRef.current = isPinching;
      onGameStateChange({ score: scoreRef.current, isGameOver: false, isPinching });
    }
  }, [landmarks, mirror]);

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
});

export default BuildingGame;
