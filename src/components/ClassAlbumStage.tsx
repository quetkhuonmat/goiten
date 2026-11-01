import React, { useEffect, useRef } from 'react';
import { StudentPhotoItem, AppStage } from '../types';
import { Sparkles, Users, Crown } from 'lucide-react';

interface ClassAlbumStageProps {
  students: StudentPhotoItem[];
  highlightedStudentId: string | null;
  appStage: AppStage;
  onOpenAlbumModal: () => void;
}

export const ClassAlbumStage: React.FC<ClassAlbumStageProps> = ({
  students,
  highlightedStudentId,
  appStage,
  onOpenAlbumModal,
}) => {
  const isPicking = appStage === 'picking';
  const highlightedRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll highlighted card into view during spin
  useEffect(() => {
    if (isPicking && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [highlightedStudentId, isPicking]);

  const activeStudent = students.find((s) => s.id === highlightedStudentId);

  return (
    <div className="relative w-full h-full bg-[#050b14] flex flex-col justify-between p-4 sm:p-6 overflow-hidden">
      {/* Background Matrix Grid */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(6,182,212,0.15) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(6,182,212,0.15) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Top Banner */}
      <div className="relative z-10 flex items-center justify-between pb-3 border-b border-cyan-500/20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-400/50 flex items-center justify-center text-cyan-400">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-cyber tracking-widest text-cyan-400 uppercase">
              CHẾ ĐỘ VÒNG QUAY ALBUM ẢNH
            </span>
            <h2 className="text-sm sm:text-base font-bold font-cyber text-white">
              DANH SÁCH ẢNH CẢ LỚP ({students.length} HỌC SINH)
            </h2>
          </div>
        </div>

        <button
          onClick={onOpenAlbumModal}
          className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 border border-cyan-500/40 rounded-xl text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
          <span>Quản lý ảnh cả lớp</span>
        </button>
      </div>

      {/* Center Hero Roulette Spotlight if spinning or focused */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center py-4">
        {activeStudent ? (
          <div className="relative flex flex-col items-center">
            {/* Spinning Glow */}
            <div className="absolute -inset-6 rounded-3xl bg-gradient-to-tr from-cyan-400 via-emerald-400 to-amber-400 opacity-60 blur-xl animate-pulse" />

            <div className="relative w-44 h-44 sm:w-56 sm:h-56 rounded-3xl overflow-hidden border-4 border-cyan-400 shadow-[0_0_40px_rgba(6,182,212,0.6)] bg-slate-900 group">
              <img
                src={activeStudent.photoUrl}
                alt={activeStudent.name}
                className="w-full h-full object-cover"
              />

              {/* Sci-fi Overlay */}
              <div className="absolute inset-0 pointer-events-none border-2 border-cyan-300/40 rounded-2xl" />

              {/* Center crosshair */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 border border-cyan-400/50 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping" />
              </div>

              {/* Status pill */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-slate-950/90 border border-cyan-400 px-3 py-1 rounded-full text-[11px] font-cyber text-cyan-300 font-bold tracking-wider shadow-lg whitespace-nowrap">
                {isPicking ? '● SCANNING...' : '★ MỤC TIÊU ĐANG CHỌN'}
              </div>
            </div>

            <div className="mt-3 text-center">
              <div className="text-lg sm:text-xl font-black font-cyber text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-cyan-300 to-white">
                {activeStudent.name}
              </div>
              <span className="text-xs font-mono text-cyan-400">
                {isPicking ? 'Đang quay chọn...' : 'Sẵn sàng lên bảng'}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center p-6 max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-cyan-950/70 border border-cyan-400/50 flex items-center justify-center text-cyan-400 mb-3 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
              <Crown className="w-8 h-8 text-yellow-400" />
            </div>
            <h3 className="font-cyber font-bold text-white text-base mb-1">
              BỘ ẢNH CẢ LỚP ĐÃ SẴN SÀNG!
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Bấm nút <strong>"QUAY CHỌN NGẪU NHIÊN"</strong> bên cạnh để hệ thống bắt đầu quét qua từng khuôn mặt học sinh với hiệu ứng âm thanh kịch tính.
            </p>
          </div>
        )}
      </div>

      {/* Bottom Horizontal Student Filmstrip */}
      <div className="relative z-10 shrink-0 pt-3 border-t border-cyan-500/20">
        <div className="flex items-center justify-between text-xs font-cyber text-slate-400 mb-2">
          <span>HỌC SINH TRONG LỚP ({students.filter((s) => !s.called).length} chưa gọi)</span>
          <span className="text-[11px] font-mono text-cyan-400">Bấm Space để quay</span>
        </div>

        <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-cyan-500/30">
          {students.map((student) => {
            const isTarget = student.id === highlightedStudentId;
            return (
              <div
                key={student.id}
                ref={isTarget ? highlightedRef : null}
                className={`shrink-0 w-20 sm:w-24 rounded-xl border p-1.5 flex flex-col items-center text-center transition-all ${
                  isTarget
                    ? 'border-yellow-400 bg-yellow-950/40 scale-105 shadow-[0_0_20px_rgba(250,204,21,0.5)] ring-2 ring-yellow-400'
                    : student.called
                    ? 'border-slate-800 bg-slate-950/40 opacity-40'
                    : 'border-cyan-500/30 bg-slate-950/60 hover:border-cyan-400'
                }`}
              >
                <div className="w-full aspect-square rounded-lg overflow-hidden bg-slate-900 mb-1">
                  <img
                    src={student.photoUrl}
                    alt={student.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="text-[10px] font-semibold text-slate-200 truncate w-full">
                  {student.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
