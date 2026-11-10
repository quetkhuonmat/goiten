import React, { useState } from 'react';
import { KeyRound, ShieldCheck, Smartphone, Check, AlertCircle, X, Sparkles, MessageCircle, Copy, HelpCircle, LogOut } from 'lucide-react';
import { TeacherLicense } from '../types';
import { ADMIN_ZALO_PHONE, FREE_TRIAL_SPINS, normalizePhoneNumber, isValidPhoneNumber } from '../utils/licenseManager';
import { sound } from '../utils/audio';

interface LicenseKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  license: TeacherLicense | null;
  onActivateKey: (phone: string, key: string) => Promise<{ success: boolean; message: string }>;
  onChangePhone: (newPhone: string) => Promise<void>;
  onOpenAdmin: () => void;
  onLogout: () => void;
  isAdminLoggedIn?: boolean;
}

export const LicenseKeyModal: React.FC<LicenseKeyModalProps> = ({
  isOpen,
  onClose,
  license,
  onActivateKey,
  onChangePhone,
  onOpenAdmin,
  onLogout,
  isAdminLoggedIn = false,
}) => {
  const [keyInput, setKeyInput] = useState('');
  const [isChangingPhone, setIsChangingPhone] = useState(false);
  const [newPhoneInput, setNewPhoneInput] = useState(license?.phone || '');
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const currentPhone = license?.phone || '';
  const usedSpins = license?.usedSpins || 0;
  const isKeyActive = Boolean(license?.isKeyActive);
  const isUnlimited = license?.keyType === 'unlimited';
  const remaining = isKeyActive
    ? (isUnlimited ? 'Không giới hạn' : Math.max(0, (license?.grantedSpins || 500) - usedSpins))
    : Math.max(0, FREE_TRIAL_SPINS - usedSpins);

  const handleCopyZalo = () => {
    navigator.clipboard.writeText(ADMIN_ZALO_PHONE);
    setCopied(true);
    sound.playClick();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!currentPhone) {
      setError('Vui lòng đăng ký số điện thoại trước khi nhập key.');
      return;
    }

    if (!keyInput.trim()) {
      setError('Vui lòng nhập mã key do Admin cấp qua Zalo.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onActivateKey(currentPhone, keyInput.trim());
      if (res.success) {
        sound.playFanfare();
        setSuccessMsg(res.message);
        setKeyInput('');
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

  const handleSaveNewPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    const norm = normalizePhoneNumber(newPhoneInput);
    if (!isValidPhoneNumber(norm)) {
      setError('Vui lòng nhập đúng số điện thoại (10 chữ số).');
      return;
    }
    sound.playClick();
    await onChangePhone(norm);
    setIsChangingPhone(false);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-md bg-slate-900 border border-cyan-500/40 rounded-3xl p-6 sm:p-7 shadow-[0_0_50px_rgba(6,182,212,0.2)] text-white my-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center text-slate-950 shadow-lg shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-cyber text-cyan-400 tracking-wider uppercase font-semibold">
              BẢN QUYỀN HỆ THỐNG
            </div>
            <h2 className="text-lg font-black font-cyber text-white">
              THÔNG TIN TÀI KHOẢN
            </h2>
          </div>
        </div>

        {/* Current Info Card */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 mb-5 space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Smartphone className="w-4 h-4 text-cyan-400" />
              <span>Số điện thoại:</span>
            </div>
            {isChangingPhone ? (
              <form onSubmit={handleSaveNewPhone} className="flex items-center gap-1.5">
                <input
                  type="tel"
                  value={newPhoneInput}
                  onChange={(e) => setNewPhoneInput(e.target.value)}
                  placeholder="0973..."
                  maxLength={12}
                  className="px-2 py-1 bg-slate-900 border border-cyan-500 rounded text-xs font-mono text-white w-28 text-center"
                />
                <button
                  type="submit"
                  className="px-2 py-1 bg-cyan-500 text-slate-950 rounded text-xs font-bold"
                >
                  Lưu
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-white text-sm">
                  {currentPhone || 'Chưa đăng ký'}
                </span>
                <button
                  onClick={() => {
                    setIsChangingPhone(true);
                    setNewPhoneInput(currentPhone);
                  }}
                  className="text-[10px] text-cyan-400 hover:underline"
                >
                  Đổi
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Trạng thái:</span>
            </div>
            <div>
              {isKeyActive ? (
                <span className="px-2.5 py-1 bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-cyber font-bold rounded-full">
                  ⭐ {isUnlimited ? 'Bản quyền Vĩnh viễn' : `Gói ${license?.grantedSpins} lượt`}
                </span>
              ) : (
                <span className="px-2.5 py-1 bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 text-xs font-cyber font-bold rounded-full">
                  {(license?.usedSpins || 0) >= FREE_TRIAL_SPINS ? 'Cần kích hoạt bản quyền' : 'Tài khoản Tiêu chuẩn'}
                </span>
              )}
            </div>
          </div>

          {isKeyActive && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Lượt quay khả dụng:</span>
              <span className="text-sm font-cyber font-bold text-cyan-300">
                {isUnlimited ? 'Không giới hạn' : `${Math.max(0, (license?.grantedSpins || (license?.keyType ? Number(license.keyType) : 500)) - usedSpins)} lượt`}
              </span>
            </div>
          )}

          {license?.activeKey && (
            <div className="pt-2 text-[11px] text-slate-400 font-mono break-all bg-slate-900/60 p-2 rounded-lg">
              Key: <span className="text-emerald-400 font-bold">{license.activeKey}</span>
            </div>
          )}

          {/* Dedicated Logout Action Button with reliable inline confirmation */}
          <div className="pt-2.5 border-t border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Tùy chọn:</span>
            {!confirmingLogout ? (
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  setConfirmingLogout(true);
                }}
                className="py-1 px-3 bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm active:scale-95"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Đăng xuất tài khoản này</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 animate-in fade-in">
                <span className="text-[11px] text-rose-300 font-bold">Xác nhận thoát?</span>
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setConfirmingLogout(false);
                    onLogout();
                  }}
                  className="py-1 px-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-bold cursor-pointer transition-all active:scale-95 shadow"
                >
                  Đăng xuất ngay
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingLogout(false)}
                  className="py-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors cursor-pointer"
                >
                  Hủy
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Enter Key Section */}
        <form onSubmit={handleActivate} className="space-y-3 mb-5">
          <label className="block text-xs font-cyber font-bold text-slate-200 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
            <span>NHẬP MÃ BẢN QUYỀN ĐỂ KÍCH HOẠT:</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={keyInput}
              onChange={(e) => {
                setKeyInput(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Ví dụ: AI-0973834541-UNL-8E3A1C"
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-cyan-500/50 text-white font-mono text-xs uppercase placeholder-slate-600 focus:outline-none focus:border-cyan-400 tracking-wider"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-cyber font-bold text-xs uppercase rounded-xl transition-all shadow-md shrink-0 cursor-pointer active:scale-95"
            >
              Áp dụng
            </button>
          </div>

          {error && (
            <div className="p-2 bg-rose-950/70 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-2 bg-emerald-950/70 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
        </form>

        {/* Zalo Info Card */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-xs">
              Zalo
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">
                Admin Zalo cấp mã key:
              </div>
              <div className="text-xs font-mono font-bold text-white tracking-wider">
                {ADMIN_ZALO_PHONE}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopyZalo}
              className="py-1 px-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-[11px] text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              {copied ? 'Đã chép' : 'Sao chép'}
            </button>
            <button
              type="button"
              onClick={() => window.open(`https://zalo.me/${ADMIN_ZALO_PHONE}`, '_blank')}
              className="py-1 px-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-[11px] font-bold text-white transition-colors flex items-center gap-1 cursor-pointer"
            >
              <MessageCircle className="w-3 h-3" />
              <span>Chat Zalo</span>
            </button>
          </div>
        </div>

        {/* Admin Portal Gateway - ONLY VISIBLE IF ADMIN IS LOGGED IN */}
        {isAdminLoggedIn && (
          <div className="pt-3 border-t border-slate-800/80 mt-3 space-y-1.5 text-center">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAdmin();
              }}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-cyan-500/20 hover:from-amber-500/30 hover:to-cyan-500/30 border border-amber-500/50 hover:border-amber-400 text-amber-300 hover:text-amber-200 rounded-xl text-xs font-cyber font-bold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer active:scale-95"
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>MỞ BẢNG QUẢN TRỊ VIÊN (ADMIN)</span>
            </button>
            <p className="text-[10px] text-slate-400 font-sans">
              Quản trị viên đã đăng nhập thành công
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
