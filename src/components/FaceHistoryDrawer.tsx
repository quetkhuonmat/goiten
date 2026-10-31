import React from 'react';
import { CalledFaceRecord } from '../types';
import { X, History, RotateCcw, Star, Download } from 'lucide-react';
import { sound } from '../utils/audio';

interface FaceHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: CalledFaceRecord[];
  onResetHistory: () => void;
}

export const FaceHistoryDrawer: React.FC<FaceHistoryDrawerProps> = ({
  isOpen,
  onClose,
  history,
  onResetHistory,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md h-full bg-slate-900 border-l border-cyan-500/30 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-cyan-400" />
            <h3 className="font-cyber font-bold text-white text-base tracking-wide">
              LỊCH SỬ KHUÔN MẶT ĐÃ GỌI
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action strip */}
        <div className="px-4 py-2.5 bg-slate-950/40 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300">
          <span>
            Đã gọi: <strong className="text-cyan-400 font-mono text-sm">{history.length}</strong> học sinh
          </span>

          {history.length > 0 && (
            <button
              onClick={() => {
                onResetHistory();
                sound.playClick();
              }}
              className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/60 px-2.5 py-1 rounded-lg border border-cyan-800/50 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Xóa lịch sử</span>
            </button>
          )}
        </div>

        {/* Face Cards Grid */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {history.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-xs flex flex-col items-center">
              <History className="w-10 h-10 text-slate-600 mb-2 stroke-1" />
              <span>Chưa có khuôn mặt học sinh nào được gọi.</span>
              <span className="text-[11px] text-slate-600 mt-1">Bấm &quot;Bắt đầu quét&quot; để chọn học sinh lên bảng!</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {history.map((record, index) => (
                <div
                  key={record.id}
                  className="bg-slate-950/80 border border-slate-800 hover:border-cyan-500/50 rounded-xl p-2.5 flex flex-col items-center text-center group transition-all"
                >
                  {/* Cropped Face Thumbnail */}
                  <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-cyan-500/40 mb-2 shadow-md">
                    <img
                      src={record.facePhotoUrl}
                      alt={`Học sinh #${index + 1}`}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute top-1 left-1 bg-slate-950/80 px-1.5 py-0.5 rounded text-[9px] font-mono text-cyan-300 font-bold">
                      #{history.length - index}
                    </div>
                  </div>

                  <div className="text-[11px] font-mono text-slate-400 mb-1">
                    {record.time}
                  </div>

                  {record.score > 0 && (
                    <div className="flex items-center gap-1 text-amber-400 text-[11px] font-semibold mb-2">
                      <Star className="w-3 h-3 fill-amber-400" />
                      <span>{record.score} sao</span>
                    </div>
                  )}

                  <a
                    href={record.facePhotoUrl}
                    download={`hoc-sinh-${index + 1}.jpg`}
                    className="w-full py-1 text-[10px] bg-slate-800 hover:bg-cyan-950 text-slate-300 hover:text-cyan-300 rounded flex items-center justify-center gap-1 transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    <span>Tải ảnh</span>
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 text-center text-[11px] text-slate-500 font-mono">
          Lịch sử khuôn mặt trong buổi học
        </div>
      </div>
    </div>
  );
};
