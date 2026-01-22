
import React, { useState, useRef } from 'react';
import Header from './components/Header';
import HandTracker from './components/HandTracker';
import BuildingGame, { GameHandle } from './components/BuildingGame';
import { HandTrackerSettings, GameState } from './types';
import { Settings, Info, Trophy, RefreshCw, Hand, X } from 'lucide-react';

const App: React.FC = () => {
  const [settings, setSettings] = useState<HandTrackerSettings>({
    maxHands: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7,
    showLandmarks: true,
    showConnectors: true,
    mirror: true,
  });

  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    highScore: parseInt(localStorage.getItem('building_highscore') || '0'),
    isGameOver: false,
    isPinching: false,
  });

  const [showSettings, setShowSettings] = useState(false);
  const [landmarks, setLandmarks] = useState<any[] | null>(null);
  const gameRef = useRef<GameHandle>(null);

  const handleGameStateChange = (update: { score: number; isGameOver: boolean; isPinching: boolean }) => {
    setGameState(prev => {
      const newScore = update.score;
      const newHighScore = Math.max(prev.highScore, newScore);
      
      if (newHighScore > prev.highScore) {
        localStorage.setItem('building_highscore', newHighScore.toString());
      }

      return {
        ...prev,
        score: newScore,
        highScore: newHighScore,
        isGameOver: update.isGameOver,
        isPinching: update.isPinching
      };
    });
  };

  return (
    <div className="h-screen w-screen bg-black overflow-hidden relative font-sans">
      {/* Background: Camera & Game Engine */}
      <div className="absolute inset-0 z-0">
        <HandTracker settings={settings} onLandmarksUpdate={setLandmarks}>
          <BuildingGame 
            ref={gameRef}
            landmarks={landmarks} 
            mirror={settings.mirror}
            onGameStateChange={handleGameStateChange} 
          />
        </HandTracker>
      </div>

      {/* Top UI Overlay */}
      <div className="absolute top-0 inset-x-0 z-10 pointer-events-none">
        <Header />
      </div>

      {/* Floating Score Panel */}
      <div className="absolute top-24 left-6 z-10 flex flex-col gap-4">
        <div className="bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-slate-700 shadow-2xl">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Độ cao tháp</span>
            <div className="text-5xl font-black text-cyan-400 tabular-nums">
              {gameState.score}
              <span className="text-sm font-medium ml-2 text-slate-400 uppercase">Tầng</span>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-700/50 flex items-center gap-3">
            <div className="bg-amber-500/20 p-2 rounded-lg">
              <Trophy size={18} className="text-amber-400" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Kỷ lục cá nhân</span>
              <div className="text-lg font-bold text-white tabular-nums">{gameState.highScore}</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="pointer-events-auto bg-slate-900/80 backdrop-blur-xl p-4 rounded-2xl border border-slate-700 shadow-xl hover:bg-slate-800 transition-all group"
        >
          <Settings size={24} className={`text-slate-400 group-hover:text-cyan-400 transition-colors ${showSettings ? 'rotate-90' : ''}`} />
        </button>
      </div>

      {/* Right Side Info Panel */}
      <div className="absolute top-24 right-6 z-10 hidden lg:block max-w-xs pointer-events-none">
        <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-3xl border border-white/5">
          <div className="flex items-center gap-3 mb-4">
            <Info className="text-indigo-400 w-5 h-5" />
            <h3 className="text-lg font-semibold text-white">Nhiệm vụ</h3>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed mb-4">
            Hãy xây dựng tòa tháp cao nhất có thể! Các hình khối khác nhau đòi hỏi sự cân bằng tuyệt đối.
          </p>
          <div className="space-y-3">
             <div className="flex items-center gap-3 text-xs text-slate-400">
               <div className="w-2 h-2 rounded-full bg-cyan-400" />
               <span>Chụm tay để gắp khối</span>
             </div>
             <div className="flex items-center gap-3 text-xs text-slate-400">
               <div className="w-2 h-2 rounded-full bg-indigo-400" />
               <span>Nhả tay để thả rơi</span>
             </div>
          </div>
        </div>
      </div>

      {/* Settings Modal/Overlay */}
      {showSettings && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-sm pointer-events-auto">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl shadow-2xl p-8 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Settings className="text-cyan-400" /> Cài đặt AR
              </h2>
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-8">
              <Toggle 
                label="Chế độ soi gương (Mirror)" 
                checked={settings.mirror} 
                onChange={(val) => setSettings({...settings, mirror: val})} 
              />
              <div className="space-y-4">
                <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
                  <span>Độ nhạy AI</span>
                  <span className="text-cyan-400">{Math.round(settings.minDetectionConfidence * 100)}%</span>
                </div>
                <input 
                  type="range" min="0.4" max="0.9" step="0.05"
                  value={settings.minDetectionConfidence} 
                  onChange={(e) => setSettings({...settings, minDetectionConfidence: parseFloat(e.target.value)})}
                  className="w-full accent-cyan-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div className="pt-6 border-t border-slate-800">
                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-xl transition-all"
                >
                  Xong
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Overlay */}
      {gameState.isGameOver && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-500">
          <div className="bg-slate-900 border-2 border-rose-500/50 p-10 rounded-[2.5rem] shadow-[0_0_50px_rgba(244,63,94,0.15)] text-center scale-in-center max-w-md w-full mx-6">
            <div className="bg-rose-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <RefreshCw size={40} className="text-rose-500" />
            </div>
            <h2 className="text-4xl font-black text-white mb-2">TÒA NHÀ ĐÃ ĐỔ!</h2>
            <p className="text-slate-400 mb-8 text-lg">Bạn đã đạt đến độ cao <span className="text-rose-400 font-bold">{gameState.score} tầng</span>.</p>
            <button 
              onClick={() => gameRef.current?.resetGame()}
              className="flex items-center justify-center gap-3 bg-white text-slate-950 hover:bg-slate-200 w-full py-4 rounded-2xl font-bold text-lg transition-all shadow-xl"
            >
              <RefreshCw size={24} />
              Thử lại ngay
            </button>
          </div>
        </div>
      )}

      {/* Interaction Hint */}
      {!gameState.isGameOver && !gameState.isPinching && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="bg-cyan-500/20 backdrop-blur-xl px-8 py-4 rounded-full border border-cyan-500/40 flex items-center gap-4 animate-bounce">
            <Hand className="text-cyan-400" size={24} />
            <span className="text-lg font-bold text-white tracking-wide">Chụm tay để gắp khối</span>
          </div>
        </div>
      )}
    </div>
  );
};

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}

const Toggle: React.FC<ToggleProps> = ({ label, checked, onChange }) => (
  <label className="flex items-center justify-between cursor-pointer group">
    <span className="text-base font-medium text-slate-300 group-hover:text-white transition-colors">{label}</span>
    <div className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
      <div className="w-12 h-6 bg-slate-800 rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:start-[4px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
    </div>
  </label>
);

export default App;
