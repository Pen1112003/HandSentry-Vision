
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as mpHands from '@mediapipe/hands';
import * as mpCamera from '@mediapipe/camera_utils';
import * as mpDrawing from '@mediapipe/drawing_utils';
import { HandTrackerSettings, ConnectionStatus } from '../types';
import { Loader2, AlertCircle } from 'lucide-react';

const getMediaPipeConstructor = (module: any, name: string) => {
  if (module[name]) return module[name];
  if (module.default && module.default[name]) return module.default[name];
  if (typeof module.default === 'function' && module.default.name === name) return module.default;
  return module.default;
};

const Hands = getMediaPipeConstructor(mpHands, 'Hands');
const Camera = getMediaPipeConstructor(mpCamera, 'Camera');
const HAND_CONNECTIONS = mpHands.HAND_CONNECTIONS || (mpHands as any).default?.HAND_CONNECTIONS;
const drawConnectors = mpDrawing.drawConnectors || (mpDrawing as any).default?.drawConnectors;
const drawLandmarks = mpDrawing.drawLandmarks || (mpDrawing as any).default?.drawLandmarks;

interface HandTrackerProps {
  settings: HandTrackerSettings;
  onLandmarksUpdate?: (landmarks: any[] | null) => void;
  children?: React.ReactNode;
}

const HandTracker: React.FC<HandTrackerProps> = ({ settings, onLandmarksUpdate, children }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.LOADING);
  const [error, setError] = useState<string | null>(null);

  const handsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const settingsRef = useRef(settings);
  const isCleaningUp = useRef(false);

  useEffect(() => {
    settingsRef.current = settings;
    if (handsRef.current) {
      handsRef.current.setOptions({
        maxNumHands: settings.maxHands,
        minDetectionConfidence: settings.minDetectionConfidence,
        minTrackingConfidence: settings.minTrackingConfidence
      });
    }
  }, [settings]);

  const onResults = useCallback((results: any) => {
    if (isCleaningUp.current || !canvasRef.current || !videoRef.current) return;

    const canvasCtx = canvasRef.current.getContext('2d');
    if (!canvasCtx) return;

    // Scale canvas to match window size for full screen experience
    if (canvasRef.current.width !== window.innerWidth || canvasRef.current.height !== window.innerHeight) {
      canvasRef.current.width = window.innerWidth;
      canvasRef.current.height = window.innerHeight;
    }

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    // Draw the camera image scaled to cover the entire canvas
    const canvasWidth = canvasRef.current.width;
    const canvasHeight = canvasRef.current.height;
    const videoWidth = results.image.width;
    const videoHeight = results.image.height;
    
    const scale = Math.max(canvasWidth / videoWidth, canvasHeight / videoHeight);
    const x = (canvasWidth / 2) - (videoWidth / 2) * scale;
    const y = (canvasHeight / 2) - (videoHeight / 2) * scale;

    canvasCtx.globalAlpha = 0.5; // Slight transparency for a more "AR overlay" feel
    canvasCtx.drawImage(results.image, x, y, videoWidth * scale, videoHeight * scale);
    canvasCtx.globalAlpha = 1.0;

    if (results.multiHandLandmarks) {
      onLandmarksUpdate?.(results.multiHandLandmarks);
      for (const landmarks of results.multiHandLandmarks) {
        // We need to remap landmarks to the "cover" scaled coordinates
        const mappedLandmarks = landmarks.map((lm: any) => ({
          x: (lm.x * videoWidth * scale + x) / canvasWidth,
          y: (lm.y * videoHeight * scale + y) / canvasHeight,
          z: lm.z
        }));

        if (settingsRef.current.showConnectors && HAND_CONNECTIONS && drawConnectors) {
          drawConnectors(canvasCtx, mappedLandmarks, HAND_CONNECTIONS, { color: '#22d3ee', lineWidth: 4 });
        }
        if (settingsRef.current.showLandmarks && drawLandmarks) {
          drawLandmarks(canvasCtx, mappedLandmarks, { color: '#ffffff', fillColor: '#22d3ee', radius: 4 });
        }
      }
    } else {
      onLandmarksUpdate?.(null);
    }
    canvasCtx.restore();

    setStatus(prev => prev === ConnectionStatus.ACTIVE ? prev : ConnectionStatus.ACTIVE);
  }, [onLandmarksUpdate]);

  useEffect(() => {
    isCleaningUp.current = false;
    const initialize = async () => {
      try {
        if (typeof Hands !== 'function' || typeof Camera !== 'function') {
          throw new Error("Lỗi tải module AI.");
        }
        const hands = new Hands({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });
        hands.setOptions({
          maxNumHands: settingsRef.current.maxHands,
          modelComplexity: 1,
          minDetectionConfidence: settingsRef.current.minDetectionConfidence,
          minTrackingConfidence: settingsRef.current.minTrackingConfidence
        });
        hands.onResults(onResults);
        handsRef.current = hands;

        if (videoRef.current) {
          const camera = new Camera(videoRef.current, {
            onFrame: async () => {
              if (!isCleaningUp.current && handsRef.current && videoRef.current) {
                try { await handsRef.current.send({ image: videoRef.current }); } catch (e) {}
              }
            },
            width: 1280,
            height: 720
          });
          cameraRef.current = camera;
          await camera.start();
        }
      } catch (err: any) {
        setError(err.message);
        setStatus(ConnectionStatus.ERROR);
      }
    };
    initialize();
    return () => {
      isCleaningUp.current = true;
      if (cameraRef.current) cameraRef.current.stop();
      if (handsRef.current) {
        const h = handsRef.current;
        setTimeout(() => h.close(), 100);
      }
    };
  }, [onResults]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <video ref={videoRef} className="hidden" playsInline />
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full block transition-transform duration-300 ${settings.mirror ? 'scale-x-[-1]' : ''}`}
      />
      
      {/* Container cho Game Overlay */}
      {status === ConnectionStatus.ACTIVE && children}

      {status === ConnectionStatus.LOADING && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950">
          <Loader2 className="w-16 h-16 text-cyan-500 animate-spin mb-6" />
          <h2 className="text-2xl font-bold text-white mb-2">Đang khởi tạo AR...</h2>
          <p className="text-slate-400">Vui lòng cấp quyền Camera nếu được yêu cầu</p>
        </div>
      )}

      {status === ConnectionStatus.ERROR && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 p-8 text-center">
          <AlertCircle className="w-20 h-20 text-rose-500 mb-6" />
          <h3 className="text-3xl font-bold text-white mb-4">Lỗi Kết Nối</h3>
          <p className="text-slate-400 text-lg mb-8 max-w-md">{error}</p>
          <button onClick={() => window.location.reload()} className="bg-white text-black px-8 py-3 rounded-xl font-bold">Thử lại</button>
        </div>
      )}
    </div>
  );
};

export default HandTracker;
