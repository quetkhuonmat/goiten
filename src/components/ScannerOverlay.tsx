import React, { useEffect, useState } from 'react';
import { DetectedFace, AppStage } from '../types';

interface ScannerOverlayProps {
  appStage: AppStage;
  detectedFaces: DetectedFace[];
  highlightedFaceId: number | null;
  lockedFace: DetectedFace | null;
  onTapToCreateFace?: (x: number, y: number) => void;
}

export const ScannerOverlay: React.FC<ScannerOverlayProps> = ({
  appStage,
  detectedFaces,
  highlightedFaceId,
  lockedFace,
  onTapToCreateFace,
}) => {
  const [flicker, setFlicker] = useState(false);

  useEffect(() => {
    if (appStage === 'picking') {
      const interval = setInterval(() => {
        setFlicker((prev) => !prev);
      }, 120);
      return () => clearInterval(interval);
    }
  }, [appStage]);

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (appStage === 'picking' || appStage === 'locked') return;
    if (!onTapToCreateFace) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;
    onTapToCreateFace(clickX, clickY);
  };

  return (
    <div
      onClick={handleContainerClick}
      className={`absolute inset-0 select-none overflow-hidden ${
        appStage === 'ready' || appStage === 'detecting' ? 'cursor-crosshair' : 'pointer-events-none'
      }`}
    >
      {/* Sci-fi HUD Corner Brackets */}
      <div className="absolute top-3 left-3 w-8 h-8 border-t-2 border-l-2 border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.8)] pointer-events-none" />
      <div className="absolute top-3 right-3 w-8 h-8 border-t-2 border-r-2 border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.8)] pointer-events-none" />
      <div className="absolute bottom-3 left-3 w-8 h-8 border-b-2 border-l-2 border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.8)] pointer-events-none" />
      <div className="absolute bottom-3 right-3 w-8 h-8 border-b-2 border-r-2 border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.8)] pointer-events-none" />

      {/* Cyber Grid background (subtle) */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(6, 182, 212, 0.2) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(6, 182, 212, 0.2) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Status HUD Header Overlay inside camera */}
      <div className="absolute top-4 left-6 right-6 flex items-center justify-between text-[11px] font-cyber text-cyan-400/90 tracking-wider pointer-events-none">
        <div className="flex items-center gap-2 bg-slate-950/80 px-2.5 py-1 rounded border border-cyan-500/30 backdrop-blur-sm">
          <span
            className={`w-2 h-2 rounded-full inline-block ${
              appStage === 'picking'
                ? 'bg-amber-400 animate-ping'
                : appStage === 'locked'
                ? 'bg-emerald-400'
                : 'bg-cyan-400'
            }`}
          />
          <span>
            {appStage === 'detecting'
              ? 'ĐANG QUÉT TÌM HỌC SINH...'
              : appStage === 'picking'
              ? 'ĐANG QUAY CHỌN NGẪU NHIÊN...'
              : appStage === 'locked'
              ? 'ĐÃ KHÓA MỤC TIÊU'
              : detectedFaces.length > 0
              ? `ĐÃ NHẬN DIỆN ${detectedFaces.length} HỌC SINH`
              : 'CHƯA PHÁT HIỆN KHUÔN MẶT'}
          </span>
        </div>
        <div className="bg-slate-950/80 px-2.5 py-1 rounded border border-cyan-500/30 backdrop-blur-sm">
          <span>AI VISION</span>
        </div>
      </div>

      {/* Laser Scanning Line when detecting or picking */}
      {(appStage === 'detecting' || appStage === 'picking') && (
        <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_20px_#06b6d4] animate-laser pointer-events-none" />
      )}

      {/* Empty State Banner when no faces detected */}
      {appStage === 'ready' && detectedFaces.length === 0 && (
        <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center text-center pointer-events-none">
          <div className="bg-slate-950/80 border border-cyan-500/40 rounded-2xl p-4 backdrop-blur-md max-w-sm shadow-xl">
            <div className="text-2xl mb-1.5">👀</div>
            <div className="font-cyber font-bold text-white text-xs mb-1">
              CHƯA PHÁT HIỆN KHUÔN MẶT NÀO
            </div>
            <div className="text-[11px] text-slate-400 leading-relaxed">
              Hướng camera về phía học sinh trong lớp, hoặc chạm vào màn hình để chọn vị trí học sinh.
            </div>
          </div>
        </div>
      )}

      {/* ALL DETECTED FACES (Green/Cyan sci-fi boxes around every student's face) */}
      {detectedFaces.map((face) => {
        const isHighlighted = appStage === 'picking' && highlightedFaceId === face.id;
        const isLocked = appStage === 'locked' && lockedFace?.id === face.id;

        return (
          <div
            key={face.id}
            className={`absolute transition-all duration-100 rounded-lg pointer-events-none ${
              isLocked
                ? 'border-3 border-amber-400 bg-amber-400/30 shadow-[0_0_35px_rgba(251,191,36,0.9)] scale-105 z-30'
                : isHighlighted
                ? 'border-2 border-yellow-300 bg-yellow-400/25 shadow-[0_0_25px_rgba(253,224,71,0.8)] scale-110 z-20'
                : face.called
                ? 'border border-slate-600/50 bg-slate-900/30 opacity-40'
                : 'border border-cyan-400/70 bg-cyan-500/10 hover:border-cyan-300'
            }`}
            style={{
              left: `${face.x}%`,
              top: `${face.y}%`,
              width: `${face.width}%`,
              height: `${face.height}%`,
            }}
          >
            {/* Corner brackets */}
            <div
              className={`absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 ${
                isLocked || isHighlighted ? 'border-amber-300' : 'border-cyan-400'
              }`}
            />
            <div
              className={`absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 ${
                isLocked || isHighlighted ? 'border-amber-300' : 'border-cyan-400'
              }`}
            />
            <div
              className={`absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 ${
                isLocked || isHighlighted ? 'border-amber-300' : 'border-cyan-400'
              }`}
            />
            <div
              className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 ${
                isLocked || isHighlighted ? 'border-amber-300' : 'border-cyan-400'
              }`}
            />

            {/* Target tag with Face ID (No Name) */}
            <div
              className={`absolute -top-5 left-0 px-1.5 py-0.2 text-[9px] font-cyber font-bold whitespace-nowrap rounded ${
                isLocked
                  ? 'bg-amber-400 text-slate-950 font-black animate-bounce shadow-md'
                  : isHighlighted
                  ? 'bg-yellow-300 text-slate-950 font-black'
                  : face.called
                  ? 'bg-slate-800 text-slate-400'
                  : 'bg-cyan-500/90 text-slate-950'
              }`}
            >
              {isLocked
                ? '★ ĐƯỢC CHỌN'
                : isHighlighted
                ? 'AIM...'
                : `MẶT #${face.id}`}
            </div>

            {/* Reticle inside highlighted or locked face */}
            {(isHighlighted || isLocked) && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-6 h-6 border border-amber-300/80 rounded-full animate-ping" />
                <div className="w-2 h-2 bg-amber-400 rounded-full shadow-[0_0_10px_#fbbf24]" />
              </div>
            )}
          </div>
        );
      })}

      {/* Tap hint when ready */}
      {appStage === 'ready' && detectedFaces.length > 0 && (
        <div className="absolute bottom-4 right-4 bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-xl text-[11px] text-slate-400 pointer-events-none backdrop-blur-sm hidden sm:block">
          💡 Chạm vào học sinh trên màn hình để thêm/chỉnh vị trí mặt
        </div>
      )}
    </div>
  );
};
