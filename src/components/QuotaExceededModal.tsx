import React, { useState } from 'react';
import { Lock, Sparkles, MessageCircle, Copy, Check, KeyRound, Smartphone, AlertCircle, X } from 'lucide-react';
import { ADMIN_ZALO_PHONE, normalizePhoneNumber, isValidPhoneNumber } from '../utils/licenseManager';
import { sound } from '../utils/audio';

interface QuotaExceededModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPhone: string;
  usedSpins: number;
  onActivateKey: (phone: string, key: string) => Promise<{ success: boolean; message: string }>;
}

export const QuotaExceededModal: React.FC<QuotaExceededModalProps> = ({
  isOpen,
  onClose,
  currentPhone,
  usedSpins,
  onActivateKey,
}) => {
  const [phoneInput, setPhoneInput] = useState(currentPhone);
  const [keyInput, setKeyInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleCopyZalo = () => {
    navigator.clipboard.writeText(ADMIN_ZALO_PHONE);
    setCopied(true);
    sound.playClick();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenZalo = () => {
    sound.playClick();
    window.open(`https://zalo.me/${ADMIN_ZALO_PHONE}`, '_blank');
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const normPhone = normalizePhoneNumber(phoneInput || currentPhone);
    if (!isValidPhoneNumber(normPhone)) {
      setError('Vui lòng nhập đúng số điện thoại (10 chữ số).');
      return;
    }

    if (!keyInput.trim()) {
      setError('Vui lòng nhập mã key do Admin cấp qua Zalo.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onActivateKey(normPhone, keyInput.trim());
      if (res.success) {
        sound.playFanfare();
        setSuccessMsg(res.message);
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        sound.playClick();
        setError(res.message);
      }
    } catch {
      setError('Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-amber-500/40 rounded-3xl p-6 sm:p-7 shadow-[0_0_60px_rgba(245,158,11,0.25)] text-white my-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Lock header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center text-slate-950 shadow-lg shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-cyber text-amber-400 tracking-wider uppercase font-bold">
              THÔNG BÁO BẢN QUYỀN
            </div>
            <h2 className="text-lg sm:text-xl font-black font-cyber text-white">
              HẾT LƯỢT QUAY MIỄN PHÍ
            </h2>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4">
          Thầy/Cô đã hoàn thành các lượt quay khởi đầu cho số điện thoại <strong className="text-cyan-300">{currentPhone || phoneInput}</strong>. Để tiếp tục sử dụng không giới hạn trong giảng dạy, Thầy/Cô vui lòng liên hệ Admin qua Zalo để nhận mã kích hoạt bản quyền.
        </p>

        {/* Zalo Contact Card */}
        <div className="bg-slate-950/80 border border-cyan-500/30 rounded-2xl p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-cyber font-bold text-cyan-300 uppercase">
                LIÊN HỆ ADMIN CẤP KEY
              </span>
            </div>
            <span className="text-[11px] font-mono font-semibold text-slate-400">
              Hỗ trợ 24/7
            </span>
          </div>

          <div className="flex items-center justify-between bg-slate-900 border border-slate-700/80 rounded-xl p-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-sm shrink-0">
                Zalo
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">
                  Số Zalo cá nhân:
                </div>
                <div className="text-base font-mono font-bold text-white tracking-wider">
                  {ADMIN_ZALO_PHONE}
                </div>
              </div>
            </div>

            <button
              onClick={handleCopyZalo}
              className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-medium text-cyan-300 hover:text-white flex items-center gap-1.5 transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
            </button>
          </div>

          <button
            onClick={handleOpenZalo}
            className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white font-cyber font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            <span>MỞ ZALO NHẮN ADMIN NHẬN KEY (0973834541)</span>
          </button>
        </div>

        {/* Form to enter license key */}
        <form onSubmit={handleActivate} className="space-y-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-1.5 text-xs font-cyber font-bold text-emerald-400 mb-1">
            <KeyRound className="w-3.5 h-3.5" />
            <span>ĐÃ CÓ MÃ KEY? NHẬP VÀO ĐÂY ĐỂ DÙNG TIẾP:</span>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
              <Smartphone className="w-3 h-3 text-cyan-400" />
              <span>Số điện thoại:</span>
            </label>
            <input
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="0973834541"
              maxLength={12}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
              <KeyRound className="w-3 h-3 text-amber-400" />
              <span>Mã bản quyền (Key do Admin cấp):</span>
            </label>
            <input
              type="text"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Ví dụ: AI-0973834541-UNL-8E3A1C"
              className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-amber-500/50 text-amber-300 font-mono text-sm font-bold uppercase placeholder-slate-600 focus:outline-none focus:border-amber-400 tracking-wider"
            />
          </div>

          {error && (
            <div className="p-2.5 bg-rose-950/70 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-2.5 bg-emerald-950/70 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-cyber font-black text-xs uppercase tracking-wider rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            <Sparkles className="w-4 h-4" />
            <span>KÍCH HOẠT BẢN QUYỀN NGAY</span>
          </button>
        </form>
      </div>
    </div>
  );
};
