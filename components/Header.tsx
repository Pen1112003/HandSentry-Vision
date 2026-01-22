
import React from 'react';
import { Camera, Github } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="bg-slate-950/50 backdrop-blur-xl border-b border-slate-800 sticky top-0 z-50">
      <div className="container mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-cyan-500 p-2 rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.4)]">
            <Camera className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight leading-none mb-1">HandSentry VN</h1>
            <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-[0.2em]">Theo dõi bàn tay AI</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <a href="#" className="hover:text-white transition-colors">Tài liệu</a>
            <a href="#" className="hover:text-white transition-colors">Hiệu năng</a>
            <a href="#" className="hover:text-white transition-colors">Liên hệ</a>
          </nav>
          <a 
            href="https://github.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-4 py-2 rounded-lg hover:bg-slate-800 transition-all text-sm font-medium"
          >
            <Github size={18} />
            <span className="hidden sm:inline">Mã nguồn</span>
          </a>
        </div>
      </div>
    </header>
  );
};

export default Header;
