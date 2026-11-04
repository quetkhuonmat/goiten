import React from 'react';
import { Camera } from 'lucide-react';
import { DetectedFace, AppStage } from '../types';

interface ScannerOverlayProps {
  appStage: AppStage;
  detectedFaces: DetectedFace[];
  highlightedFaceId: number | null;
  lockedFace: DetectedFace | null;
  onTapToCreateFace?: (x: number, y: number) => void;
  isShutterFlashing?: boolean;
}

export const ScannerOverlay: React.FC<ScannerOverlayProps> = ({
  appStage,
  detectedFaces,
  highlightedFaceId,
  lockedFace,
  onTapToCreateFace,
  isShutterFlashing = false,
}) => {
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
      {/* Real Camera Shutter Flash (when taking classroom snapshot) */}
      {isShutterFlashing && (
        <div className="absolute inset-0 bg-white animate-shutter-flash z-50 pointer-events-none" />
      )}

      {/* Status indicator during picking or locked */}
      {(appStage === 'picking' || appStage === 'locked') && (
        <div className="absolute top-4 left-4 z-20 pointer-events-none animate-fadeIn">
          <div className="flex items-center gap-2 bg-slate-950/90 px-3.5 py-1.5 rounded-full border border-amber-400/60 backdrop-blur-md shadow-xl text-amber-300 text-xs font-bold font-cyber">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <span>{appStage === 'picking' ? 'ĐANG QUAY CHỌN...' : 'ĐÃ KHÓA HỌC SINH!'}</span>
          </div>
        </div>
      )}

      {/* DETECTED FACES: Clean green rounded rectangle bounding boxes exactly matching reference image */}
      {detectedFaces.map((face) => {
        const isHighlighted = appStage === 'picking' && highlightedFaceId === face.id;
        const isLocked = appStage === 'locked' && lockedFace?.id === face.id;

        return (
          <div
            key={face.id}
            className={`absolute pointer-events-none transition-all duration-150 rounded-xl sm:rounded-2xl ${
              isLocked
                ? 'border-[3.5px] border-amber-400 bg-amber-400/20 shadow-[0_0_30px_rgba(251,191,36,0.9)] scale-[1.03] z-30'
                : isHighlighted
                ? 'border-[3.5px] border-yellow-300 bg-yellow-400/20 shadow-[0_0_20px_rgba(253,224,71,0.85)] scale-[1.03] z-20'
                : face.called
                ? 'border-2 border-emerald-700/60 bg-black/30 opacity-40'
                : 'border-[3px] border-[#22c55e] bg-emerald-500/5 shadow-[0_0_10px_rgba(34,197,94,0.35)]'
            }`}
            style={{
              left: `${face.x}%`,
              top: `${face.y}%`,
              width: `${face.width}%`,
              height: `${face.height}%`,
            }}
          >
            {/* Minimal clean index badge */}
            <div
              className={`absolute -top-4 left-1 px-1.5 py-0.2 rounded-md text-[9px] font-sans font-bold whitespace-nowrap shadow-sm ${
                isLocked
                  ? 'bg-amber-400 text-slate-950 scale-105'
                  : isHighlighted
                  ? 'bg-yellow-300 text-slate-950 font-bold'
                  : face.called
                  ? 'bg-slate-800 text-slate-400'
                  : 'bg-emerald-600/90 text-white'
              }`}
            >
              {isLocked
                ? '★ ĐƯỢC CHỌN'
                : isHighlighted
                ? 'CHỌN'
                : face.called
                ? `#${face.id} (đã gọi)`
                : `#${face.id}`}
            </div>
          </div>
        );
      })}
    </div>
  );
};
