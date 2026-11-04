import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { DetectedFace } from '../types';
import { Star, RotateCcw, Download, X, Sparkles, Eye, User, ZoomIn, ZoomOut, CheckCircle2 } from 'lucide-react';
import { sound } from '../utils/audio';

interface LockedStudentModalProps {
  isOpen: boolean;
  facePhotoUrl: string | null;
  overviewPhotoUrl?: string | null;
  targetBox: DetectedFace | null;
  score: number;
  studentName?: string;
  onClose: () => void;
  onScanAgain: () => void;
  onAddScore: () => void;
}

export const LockedStudentModal: React.FC<LockedStudentModalProps> = ({
  isOpen,
  facePhotoUrl,
  overviewPhotoUrl,
  targetBox,
  score,
  studentName,
  onClose,
  onScanAgain,
  onAddScore,
}) => {
  // View mode: 'portrait' (phóng đại vừa phải) or 'overview' (toàn cảnh vị trí ngồi trong lớp)
  const [viewMode, setViewMode] = useState<'portrait' | 'overview'>('portrait');
  // Magnification scale: 1.0 (chuẩn vừa phải) or 1.25 (cận cảnh)
  const [zoomScale, setZoomScale] = useState<number>(1.0);

  useEffect(() => {
    if (isOpen) {
      setViewMode('portrait');
      setZoomScale(1.0);
      sound.playFanfare();

      // Confetti celebration burst
      confetti({
        particleCount: 85,
        spread: 75,
        origin: { y: 0.6 },
        colors: ['#06b6d4', '#22c55e', '#fbbf24', '#f43f5e', '#a855f7'],
      });

      const timer = setTimeout(() => {
        confetti({
          particleCount: 45,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
        });
        confetti({
          particleCount: 45,
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
    a.download = `hoc-sinh-len-bang-mat-${targetBox?.id || 1}-${Date.now()}.jpg`;
    a.click();
    sound.playClick();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-cyan-400/90 rounded-3xl p-5 sm:p-6 shadow-[0_0_60px_rgba(6,182,212,0.45)] text-center overflow-hidden">
        {/* Glow ambient light */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-32 bg-cyan-500/25 rounded-full blur-3xl pointer-events-none" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors p-1.5 rounded-full hover:bg-slate-800"
          aria-label="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Kicker badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/90 border border-cyan-500/50 text-cyan-300 text-[11px] font-cyber tracking-widest uppercase mb-2.5">
          <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
          <span>CHIẾN BINH ĐÃ ĐƯỢC CHỌN</span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-black font-cyber text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-100 tracking-wide mb-3">
          MỜI EM LÊN BẢNG!
        </h2>

        {/* VIEW MODE TABS: Chân dung rõ nét vs Vị trí cả lớp */}
        {overviewPhotoUrl && (
          <div className="inline-flex items-center p-1 bg-slate-950/80 border border-cyan-500/30 rounded-xl mb-4 gap-1">
            <button
              onClick={() => {
                sound.playClick();
                setViewMode('portrait');
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-cyber font-bold transition-all ${
                viewMode === 'portrait'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-cyan-300'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Chân Dung Rõ Nét</span>
            </button>
            <button
              onClick={() => {
                sound.playClick();
                setViewMode('overview');
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-cyber font-bold transition-all ${
                viewMode === 'overview'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-cyan-300'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Vị Trí Cả Lớp</span>
            </button>
          </div>
        )}

        {/* PHOTO DISPLAY CONTAINER */}
        <div className="relative mx-auto mb-4 group max-w-[280px] sm:max-w-[300px]">
          {/* Animated Glow Border */}
          <div className="absolute -inset-1.5 rounded-3xl bg-gradient-to-tr from-amber-400 via-cyan-400 to-emerald-400 opacity-75 blur-md animate-pulse" />

          {/* VIEW: 1) PORTRAIT WITH BALANCED MAGNIFICATION (Độ phóng đại vừa phải) */}
          {viewMode === 'portrait' ? (
            <div className="relative w-full aspect-square rounded-2xl overflow-hidden border-3 border-amber-400 bg-slate-950 shadow-2xl flex items-center justify-center">
              {facePhotoUrl ? (
                <div className="relative w-full h-full overflow-hidden flex items-center justify-center">
                  <img
                    src={facePhotoUrl}
                    alt="Khuôn mặt học sinh được chọn"
                    style={{
                      transform: `scale(${zoomScale})`,
                      transition: 'transform 0.3s ease-out',
                      imageRendering: 'auto',
                    }}
                    className="w-full h-full object-cover"
                  />
                  {/* Subtle vignette border to frame student face */}
                  <div className="absolute inset-0 ring-1 ring-inset ring-amber-400/40 pointer-events-none rounded-2xl" />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 p-4">
                  <div className="w-16 h-16 rounded-full border-2 border-dashed border-cyan-400 flex items-center justify-center mb-2">
                    <span className="text-2xl">🎯</span>
                  </div>
                  <span className="text-xs font-cyber">VỊ TRÍ BÀN #{targetBox?.id || 1}</span>
                </div>
              )}

              {/* Sci-Fi HUD Corner Brackets */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-amber-300" />
                <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-amber-300" />
                <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-amber-300" />
                <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-amber-300" />
              </div>

              {/* Locked Tag Badge */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-slate-950/90 border border-amber-400 px-3 py-0.5 rounded-full text-[10px] font-cyber text-amber-300 font-bold tracking-wider shadow-md whitespace-nowrap flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>HỌC SINH #{targetBox?.id || 1}</span>
              </div>
            </div>
          ) : (
            /* VIEW: 2) FULL CLASSROOM OVERVIEW LOCATOR (Toàn cảnh vị trí ngồi của học sinh) */
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden border-3 border-amber-400 bg-slate-950 shadow-2xl flex items-center justify-center">
              {overviewPhotoUrl ? (
                <img
                  src={overviewPhotoUrl}
                  alt="Vị trí học sinh trong lớp học"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-xs text-slate-400">Không có ảnh toàn cảnh</div>
              )}
              <div className="absolute top-2 left-2 bg-slate-950/90 border border-cyan-400/60 px-2 py-0.5 rounded text-[10px] font-cyber text-cyan-300">
                TOÀN CẢNH LỚP HỌC
              </div>
            </div>
          )}
        </div>

        {/* Magnification Controls (Độ phóng đại vừa phải) */}
        {viewMode === 'portrait' && (
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-[11px] font-cyber text-slate-400">Độ phóng đại:</span>
            <button
              onClick={() => {
                sound.playClick();
                setZoomScale(1.0);
              }}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-cyber font-bold border transition-all ${
                zoomScale === 1.0
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm'
                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
              }`}
            >
              Chuẩn (1.0x)
            </button>
            <button
              onClick={() => {
                sound.playClick();
                setZoomScale(1.2);
              }}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-cyber font-bold border transition-all ${
                zoomScale === 1.2
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm'
                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
              }`}
            >
              Vừa phải (1.2x)
            </button>
            <button
              onClick={() => {
                sound.playClick();
                setZoomScale(1.4);
              }}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-cyber font-bold border transition-all ${
                zoomScale === 1.4
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm'
                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
              }`}
            >
              Cận cảnh (1.4x)
            </button>
          </div>
        )}

        {/* Student name if available from album */}
        {studentName && (
          <div className="mb-3">
            <div className="text-xl font-black font-cyber text-amber-300 tracking-wide">
              {studentName}
            </div>
          </div>
        )}

        {/* Score stars if awarded */}
        {score > 0 && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-amber-300 font-bold mb-3 bg-amber-500/10 py-1 px-3 rounded-full border border-amber-500/30">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            <span>Thưởng {score} sao tích cực</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 mb-3">
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
            <span>Lưu ảnh chân dung</span>
          </button>
        </div>

        {/* Main Continue / Scan Next Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              onScanAgain();
              sound.playClick();
            }}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black font-cyber text-sm rounded-xl shadow-[0_0_25px_rgba(16,185,129,0.5)] transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <RotateCcw className="w-4 h-4" />
            <span>QUAY CHỌN TIẾP</span>
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
