
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
  const groundRef = useRef<Matter.Body | null>(null);
  
  const [currentBlock, setCurrentBlock] = useState<Matter.Body | null>(null);
  const isPinchingRef = useRef(false);
  const scoreRef = useRef(0);
  const isGameOverRef = useRef(false);

  // Khởi tạo AudioContext an toàn
  const getAudioCtx = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        latencyHint: 'interactive'
      });
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // Âm thanh khi gắp khối (Tiếng "chíp" đi lên)
  const playGrabSound = () => {
    try {
      const ctx = getAudioCtx();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(200, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.05);

      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.05);
    } catch (e) {}
  };

  // Âm thanh khi thả khối (Tiếng "tách" đi xuống - yêu cầu của người dùng)
  const playDropSound = () => {
    try {
      const ctx = getAudioCtx();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(400, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.08);

      gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.08);
    } catch (e) {}
  };

  // Âm thanh khi khối rơi mất (Tiếng "bloop" đi xuống sâu)
  const playFailSound = () => {
    try {
      const ctx = getAudioCtx();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(300, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.4);

      gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.4);
    } catch (e) {}
  };

  // Helper tạo khối ngẫu nhiên
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
        isGameOverRef.current = false;
        onGameStateChange({ score: 0, isGameOver: false, isPinching: false });
      }
    }
  }));

  const setupInitialWorld = () => {
    if (!engineRef.current) return;
    const world = engineRef.current.world;
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Nền tảng trung tâm (Base platform)
    const ground = Matter.Bodies.rectangle(width / 2, height / 2 + 100, 400, 60, {
      isStatic: true,
      render: { 
        fillStyle: 'rgba(30, 41, 59, 0.9)', 
        strokeStyle: '#0ea5e9', 
        lineWidth: 4 
      },
      label: 'ground'
    });

    groundRef.current = ground;
    Matter.World.add(world, [ground]);
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = Matter.Engine.create({
      gravity: { y: 1.5 }
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
      if (isGameOverRef.current || !groundRef.current) return;

      const bodies = Matter.Composite.allBodies(engine.world);
      let maxHeight = 0;
      let gameOver = false;
      const groundY = groundRef.current.position.y;

      bodies.forEach(body => {
        if (!body.isStatic && (body.parts.length <= 1 || (body.parts.length > 1 && body.parent === body))) {
          // Check nếu rơi khỏi tầm mắt (so với vị trí thanh nền)
          if (body.position.y > groundY + 400 || body.position.y > window.innerHeight + 100) {
            gameOver = true;
          }
          
          // Tính điểm độ cao so với mặt trên của thanh nền (groundY - 30)
          const h = Math.max(0, (groundY - 30) - body.position.y);
          if (h > maxHeight) maxHeight = Math.round(h / 15);
        }
      });

      if (gameOver && !isGameOverRef.current) {
        isGameOverRef.current = true;
        playFailSound();
        onGameStateChange({ score: scoreRef.current, isGameOver: true, isPinching: isPinchingRef.current });
      } else if (maxHeight !== scoreRef.current) {
        scoreRef.current = maxHeight;
        onGameStateChange({ score: scoreRef.current, isGameOver: false, isPinching: isPinchingRef.current });
      }
    }, 300);

    const handleResize = () => {
       if (renderRef.current && canvasRef.current) {
         const width = window.innerWidth;
         const height = window.innerHeight;
         
         canvasRef.current.width = width;
         canvasRef.current.height = height;
         renderRef.current.options.width = width;
         renderRef.current.options.height = height;

         // Cập nhật vị trí thanh nền khi resize
         if (groundRef.current) {
           Matter.Body.setPosition(groundRef.current, {
             x: width / 2,
             y: height / 2 + 100
           });
         }
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
    if (isGameOverRef.current) return;
    
    // Nếu không thấy tay, coi như nhả grip
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

    if (mirror) midX = window.innerWidth - midX;

    const isPinching = dist < 0.08;

    if (isPinching) {
      if (!currentBlock) {
        // Mới gắp khối
        const newBlock = createRandomBlock(midX, midY);
        Matter.Body.setStatic(newBlock, true);
        Matter.World.add(engineRef.current.world, newBlock);
        setCurrentBlock(newBlock);
        playGrabSound(); // Phản hồi khi gắp
      } else {
        // Đang di chuyển khối
        Matter.Body.setPosition(currentBlock, { x: midX, y: midY });
      }
    } else {
      if (currentBlock) {
        // Nhả grip - THẢ KHỐI
        Matter.Body.setStatic(currentBlock, false);
        setCurrentBlock(null);
        playDropSound(); // Phản hồi khi nhả (yêu cầu người dùng)
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
