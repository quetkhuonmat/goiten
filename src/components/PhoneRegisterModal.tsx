import React, { useState } from 'react';
import { Smartphone, Sparkles, KeyRound, CheckCircle2, ShieldCheck, QrCode } from 'lucide-react';
import { isValidPhoneNumber, normalizePhoneNumber, ADMIN_ZALO_PHONE } from '../utils/licenseManager';
import { sound } from '../utils/audio';

interface PhoneRegisterModalProps {
  isOpen: boolean;
  onRegister: (phone: string) => Promise<void>;
  onOpenKeyModal: () => void;
  onOpenAdminQr: () => void;
}

export const PhoneRegisterModal: React.FC<PhoneRegisterModalProps> = ({
  isOpen,
  onRegister,
  onOpenKeyModal,
  onOpenAdminQr,
}) => {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const norm = normalizePhoneNumber(phone);
  const isAdminPhone = norm === ADMIN_ZALO_PHONE;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isAdminPhone) {
      sound.playClick();
      onOpenAdminQr();
      return;
    }

    if (!isValidPhoneNumber(norm)) {
      setError('Vui lòng nhập đúng số điện thoại (10 chữ số, ví dụ: 0973834541).');
      return;
    }

    setIsSubmitting(true);
    try {
      sound.playClick();
      await onRegister(norm);
      sound.playFanfare();
    } catch {
      setError('Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-cyan-500/40 rounded-2xl p-6 sm:p-7 shadow-[0_0_50px_rgba(6,182,212,0.25)] text-white">
        {/* Glow corner */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center text-slate-950 shadow-lg shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-cyber text-cyan-400 tracking-wider uppercase font-semibold">
              XÁC THỰC GIÁO VIÊN
            </div>
            <h2 className="text-xl font-black font-cyber text-white">
              AI SMARTBOARD LỚP HỌC
            </h2>
          </div>
        </div>

        {/* Welcome card without trial text */}
        <div className="mb-5 bg-gradient-to-r from-cyan-950/70 to-slate-950/80 border border-cyan-500/30 rounded-xl p-3.5 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="text-xs">
            <p className="font-bold text-cyan-300 font-cyber mb-0.5">
              ĐĂNG KÝ SỬ DỤNG HỆ THỐNG
            </p>
            <p className="text-slate-300 leading-relaxed">
              Chào mừng Thầy/Cô! Vui lòng nhập số điện thoại để kết nối tài khoản và đồng bộ dữ liệu gọi tên học sinh trong lớp học.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
              <span>Số điện thoại của Thầy/Cô:</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Ví dụ: 0973834541"
              maxLength={12}
              autoFocus
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-cyan-500/50 text-white font-mono text-base placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 transition-all tracking-wider text-center"
            />
            {error && (
              <p className="text-rose-400 text-xs mt-1.5 font-medium flex items-center gap-1">
                <span>⚠️</span> {error}
              </p>
            )}
            <p className="text-[11px] text-slate-400 mt-1.5 text-center">
              Dữ liệu danh sách lớp và lượt quay sẽ được lưu trữ an toàn theo số điện thoại này.
            </p>
          </div>

          {isAdminPhone ? (
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 via-orange-400 to-cyan-500 hover:from-amber-400 text-slate-950 font-cyber font-black text-sm uppercase tracking-wider rounded-xl shadow-[0_0_25px_rgba(245,158,11,0.5)] transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] animate-pulse"
            >
              <QrCode className="w-5 h-5 text-slate-950" />
              <span>QUÉT MÃ QR ZALO ĐĂNG NHẬP ADMIN</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-cyber font-black text-sm uppercase tracking-wider rounded-xl shadow-[0_0_25px_rgba(6,182,212,0.4)] transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>XÁC NHẬN & BẮT ĐẦU SỬ DỤNG</span>
            </button>
          )}
        </form>

        <div className="mt-5 pt-4 border-t border-slate-800 text-center space-y-2.5">
          <button
            type="button"
            onClick={() => {
              onOpenKeyModal();
            }}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center justify-center gap-1.5 mx-auto transition-colors cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Thầy/Cô đã có mã bản quyền? Bấm vào đây để nhập key</span>
          </button>

          <button
            type="button"
            onClick={onOpenAdminQr}
            className="text-xs text-amber-400/90 hover:text-amber-300 font-cyber flex items-center justify-center gap-1.5 mx-auto transition-colors pt-0.5 cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5 text-amber-400" />
            <span>Quét mã QR Zalo Quản trị viên (0973834541)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
