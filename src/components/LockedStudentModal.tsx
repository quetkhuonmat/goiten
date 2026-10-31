import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { DetectedFace } from '../types';
import { Star, RotateCcw, Download, X, Sparkles } from 'lucide-react';
import { sound } from '../utils/audio';

interface LockedStudentModalProps {
  isOpen: boolean;
  facePhotoUrl: string | null;
  targetBox: DetectedFace | null;
  score: number;
  onClose: () => void;
  onScanAgain: () => void;
  onAddScore: () => void;
}

export const LockedStudentModal: React.FC<LockedStudentModalProps> = ({
  isOpen,
  facePhotoUrl,
  targetBox,
  score,
  onClose,
  onScanAgain,
  onAddScore,
}) => {
  useEffect(() => {
    if (isOpen) {
      sound.playFanfare();
      // Burst confetti celebration
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#06b6d4', '#22c55e', '#fbbf24', '#f43f5e', '#a855f7'],
      });

      const timer = setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
        });
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
        });
      }, 250);

      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDownloadFace = () => {
    if (!facePhotoUrl) return;
    const a = document.createElement('a');
    a.href = facePhotoUrl;
    a.download = `hoc-sinh-len-bang-${Date.now()}.jpg`;
    a.click();
    sound.playClick();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-sm bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-cyan-400/90 rounded-3xl p-6 shadow-[0_0_60px_rgba(6,182,212,0.45)] text-center overflow-hidden">
        {/* Glow ambient light */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-32 bg-cyan-500/30 rounded-full blur-3xl pointer-events-none" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors p-1.5 rounded-full hover:bg-slate-800"
          aria-label="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Banner Kicker */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[11px] font-cyber tracking-widest uppercase mb-3">
          <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
          <span>CHIẾN BINH ĐÃ ĐƯỢC CHỌN</span>
        </div>

        <h2 className="text-2xl font-black font-cyber text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-100 tracking-wide mb-5">
          MỜI EM LÊN BẢNG!
        </h2>

        {/* PROMINENT FACE PHOTO DISPLAY (NO NAME AS REQUESTED) */}
        <div className="relative mx-auto w-56 h-56 sm:w-60 sm:h-60 mb-5 group">
          {/* Animated Glowing Outer Ring */}
          <div className="absolute -inset-2 rounded-3xl bg-gradient-to-tr from-amber-400 via-cyan-400 to-emerald-400 opacity-75 blur-md animate-pulse" />

          {/* Sci-Fi Target Framing */}
          <div className="relative w-full h-full rounded-2xl overflow-hidden border-3 border-amber-400 bg-slate-950 shadow-2xl flex items-center justify-center">
            {facePhotoUrl ? (
              <img
                src={facePhotoUrl}
                alt="Khuôn mặt học sinh được chọn"
                className="w-full h-full object-cover transform transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-400 p-4">
                <div className="w-16 h-16 rounded-full border-2 border-dashed border-cyan-400 flex items-center justify-center mb-2">
                  <span className="text-2xl">🎯</span>
                </div>
                <span className="text-xs font-cyber">VỊ TRÍ BÀN #{targetBox?.id || 1}</span>
              </div>
            )}

            {/* Futuristic HUD Crosshair Overlay on Face */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Corner brackets */}
              <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-amber-300" />
              <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-amber-300" />
              <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-amber-300" />
              <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-amber-300" />

              {/* Center subtle reticle */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 border border-amber-400/40 rounded-full" />
            </div>

            {/* Live Target Lock Badge */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-slate-950/90 border border-amber-400/80 px-2.5 py-0.5 rounded-full text-[10px] font-cyber text-amber-300 font-bold tracking-wider shadow-md whitespace-nowrap">
              ● LOCKED
            </div>
          </div>
        </div>

        {/* Score stars if awarded */}
        {score > 0 && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-amber-300 font-bold mb-4 bg-amber-500/10 py-1.5 px-3 rounded-full border border-amber-500/30">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            <span>Thưởng {score} sao tích cực</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <button
            onClick={() => {
              onAddScore();
              sound.playClick();
            }}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/60 rounded-xl text-amber-300 text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Star className="w-4 h-4 fill-amber-400" />
            <span>Thưởng Sao (+1)</span>
          </button>

          <button
            onClick={handleDownloadFace}
            disabled={!facePhotoUrl}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/60 disabled:opacity-50 rounded-xl text-cyan-300 text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Download className="w-4 h-4" />
            <span>Lưu ảnh mặt</span>
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              onScanAgain();
              sound.playClick();
            }}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black font-cyber text-sm rounded-xl shadow-[0_0_25px_rgba(16,185,129,0.5)] transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <RotateCcw className="w-4 h-4" />
            <span>QUÉT TIẾP</span>
          </button>
          <button
            onClick={onClose}
            className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-xl transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
