import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Smartphone,
  Lock,
  Sparkles,
  AlertCircle,
  Check,
} from 'lucide-react';
import { sound } from '../utils/audio';

interface QrZaloConfirmViewProps {
  sessionId: string;
  phone: string;
  role: 'teacher' | 'admin';
}

export const QrZaloConfirmView: React.FC<QrZaloConfirmViewProps> = ({
  sessionId,
  phone,
  role,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    sound.playClick();

    try {
      const res = await fetch('/api/auth/qr-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, phone }),
      });

      if (res.ok) {
        sound.playFanfare();
        setIsConfirmed(true);
      } else {
        const err = await res.json();
        setError(err.error || 'Phiên xác thực đã hết hạn hoặc không hợp lệ.');
      }
    } catch {
      setError('Không thể kết nối máy chủ, vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAdmin = role === 'admin';

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-cyan-500/50 rounded-3xl p-6 shadow-[0_0_50px_rgba(6,182,212,0.25)] text-center space-y-5 animate-in fade-in">
        {/* Logo / Badge */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 via-teal-400 to-emerald-500 flex items-center justify-center text-slate-950 shadow-xl">
          <ShieldCheck className="w-9 h-9" />
        </div>

        <div>
          <div className="text-[10px] font-cyber text-cyan-400 tracking-wider uppercase font-bold">
            XÁC THỰC QUA ZALO
          </div>
          <h1 className="text-xl font-black font-cyber text-white mt-0.5">
            AI SMARTBOARD LỚP HỌC
          </h1>
        </div>

        {isConfirmed ? (
          /* CONFIRMED SUCCESS VIEW */
          <div className="p-5 bg-emerald-950/70 border border-emerald-500/60 rounded-2xl space-y-3 animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-lg animate-bounce">
              <Check className="w-8 h-8" />
            </div>
            <h2 className="text-base font-black font-cyber text-emerald-300">
              ĐÃ XÁC NHẬN THÀNH CÔNG!
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Màn hình máy tính / bảng thông minh đã được đăng nhập với số{' '}
              <strong className="text-emerald-300 font-mono text-sm">{phone}</strong>.
            </p>
            <p className="text-[11px] text-slate-400 pt-1">
              Thầy/Cô có thể đóng trang này và bắt đầu giờ dạy trên màn hình lớp học!
            </p>
          </div>
        ) : (
          /* CONFIRMATION CHALLENGE */
          <div className="space-y-4">
            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl text-left space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Số điện thoại:</span>
                <span className="font-mono font-bold text-cyan-300 text-sm">{phone}</span>
              </div>
              <div className="flex items-center justify-between text-xs border-t border-slate-800/80 pt-2">
                <span className="text-slate-400">Quyền truy cập:</span>
                <span className={`font-cyber font-bold ${isAdmin ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {isAdmin ? 'Quản trị viên (Admin)' : 'Giáo viên lớp học'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs border-t border-slate-800/80 pt-2">
                <span className="text-slate-400">Yêu cầu từ:</span>
                <span className="text-slate-300 font-mono text-[11px]">Màn hình lớp học / Máy tính</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed px-1">
              Thầy/Cô có đồng ý cho phép màn hình máy tính đang hiển thị mã QR đăng nhập vào hệ thống bằng tài khoản này không?
            </p>

            {error && (
              <div className="p-3 bg-rose-950/80 border border-rose-500/50 rounded-xl text-rose-300 text-xs flex items-center gap-2 text-left">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleConfirm}
              className="w-full py-4 px-4 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-cyber font-black text-sm uppercase tracking-wider rounded-2xl shadow-[0_0_30px_rgba(16,185,129,0.35)] transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>{isSubmitting ? 'Đang xác thực...' : 'CHO PHÉP ĐĂNG NHẬP NGAY'}</span>
            </button>

            <p className="text-[11px] text-slate-500 text-center">
              Chỉ xác nhận khi Thầy/Cô đang trực tiếp quét mã QR trên màn hình trước mặt.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
