import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Sparkles,
  CheckCircle2,
  QrCode,
  Clock,
  RefreshCw,
  MessageCircle,
  AlertCircle,
  ArrowLeft,
  Check,
  ExternalLink,
} from 'lucide-react';
import QRCode from 'qrcode';
import {
  isValidPhoneNumber,
  normalizePhoneNumber,
  ADMIN_ZALO_PHONE,
  apiCheckTeacherStatus,
  RegisterPhoneResult,
  getStoredLicense,
} from '../utils/licenseManager';
import { sound } from '../utils/audio';
import { TeacherLicense } from '../types';

interface PhoneRegisterModalProps {
  isOpen: boolean;
  onRegister: (phone: string) => Promise<RegisterPhoneResult>;
  onApproved: (license: TeacherLicense) => void;
  onOpenAdminQr: () => void;
}

export const PhoneRegisterModal: React.FC<PhoneRegisterModalProps> = ({
  isOpen,
  onRegister,
  onApproved,
  onOpenAdminQr,
}) => {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // States: 'input' | 'pending' | 'qr-verify'
  const [viewState, setViewState] = useState<'input' | 'pending' | 'qr-verify'>('input');
  const [targetPhone, setTargetPhone] = useState('');
  const [targetLicense, setTargetLicense] = useState<TeacherLicense | null>(null);
  const [teacherQrUrl, setTeacherQrUrl] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Pending check status state
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [checkStatusMsg, setCheckStatusMsg] = useState<string | null>(null);

  // Check stored license on modal open
  useEffect(() => {
    if (isOpen) {
      setIsSuccess(false);
      const stored = getStoredLicense();
      if (stored && stored.phone) {
        setPhone(stored.phone);
        setTargetPhone(stored.phone);
        if (stored.status === 'pending') {
          setViewState('pending');
        } else if (stored.status === 'approved') {
          setTargetLicense(stored);
        }
      }
    }
  }, [isOpen]);

  // Generate QR for teacher Zalo when entering 'qr-verify'
  const showTeacherQr = async (approvedPhone: string, license: TeacherLicense) => {
    setTargetPhone(approvedPhone);
    setTargetLicense(license);
    setViewState('qr-verify');
    setIsSuccess(false);

    try {
      const qrTarget = `https://zalo.me/${approvedPhone}`;
      const url = await QRCode.toDataURL(qrTarget, {
        width: 280,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
      setTeacherQrUrl(url);
    } catch (e) {
      console.warn('Cannot generate teacher QR:', e);
    }
  };

  const handleConfirmTeacherLogin = () => {
    if (!targetLicense) return;
    sound.playFanfare();
    setIsSuccess(true);
    setTimeout(() => {
      onApproved(targetLicense);
    }, 900);
  };

  if (!isOpen) return null;

  const norm = normalizePhoneNumber(phone);
  const isAdminPhone = norm === ADMIN_ZALO_PHONE;

  // Submit phone form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCheckStatusMsg(null);

    if (isAdminPhone) {
      sound.playClick();
      setError(
        'Số điện thoại 0973834541 thuộc Ban Quản Trị hệ thống. Giáo viên không thể sử dụng số này để đăng ký. Quản trị viên vui lòng bấm nút "Quét mã QR Zalo đăng nhập" bên dưới!'
      );
      return;
    }

    if (!isValidPhoneNumber(norm)) {
      setError('Vui lòng nhập đúng số điện thoại (10 chữ số, ví dụ: 0912345678).');
      return;
    }

    setIsSubmitting(true);
    try {
      sound.playClick();
      const res = await onRegister(norm);

      if (res.success && res.license.status === 'approved') {
        // Teacher is approved -> Display Zalo QR code to scan and verify
        await showTeacherQr(norm, res.license);
      } else {
        // Pending approval by admin
        sound.playClick();
        setTargetPhone(norm);
        setViewState('pending');
        setError(null);
      }
    } catch {
      setError('Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if admin approved the pending phone number
  const handleManualCheckStatus = async () => {
    if (!targetPhone) return;
    setIsCheckingStatus(true);
    setCheckStatusMsg(null);
    sound.playClick();

    try {
      const statusRes = await apiCheckTeacherStatus(targetPhone);
      if (statusRes.isApproved && statusRes.record) {
        sound.playFanfare();
        setCheckStatusMsg('Chúc mừng Thầy/Cô! Tài khoản đã được Admin phê duyệt. Đang mở mã QR xác thực...');
        setTimeout(() => {
          showTeacherQr(targetPhone, statusRes.record!);
        }, 800);
      } else {
        setCheckStatusMsg('Tài khoản vẫn đang chờ Ban Quản Trị nhấn duyệt. Vui lòng liên hệ Admin qua Zalo để duyệt nhanh!');
      }
    } catch {
      setCheckStatusMsg('Chưa thể kiểm tra máy chủ, vui lòng thử lại sau.');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-cyan-500/40 rounded-3xl p-6 sm:p-7 shadow-[0_0_50px_rgba(6,182,212,0.25)] text-white">
        {/* Glow corner */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Header */}
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

        {/* ================= VIEW 1: QR CODE ZALO LOGIN (APPROVED TEACHER) ================= */}
        {viewState === 'qr-verify' && (
          <div className="space-y-4 py-1 text-center animate-in fade-in">
            {isSuccess ? (
              <div className="p-6 bg-emerald-950/80 border border-emerald-500/60 rounded-2xl space-y-3 animate-in zoom-in-95">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-lg animate-bounce">
                  <Check className="w-9 h-9" />
                </div>
                <h3 className="text-base font-black font-cyber text-emerald-300">
                  XÁC THỰC ZALO THÀNH CÔNG!
                </h3>
                <p className="text-xs text-slate-200">
                  Chào mừng Thầy/Cô! Đang mở ứng dụng Smartboard Lớp học...
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-cyan-950/60 border border-cyan-500/30 rounded-xl text-left">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Tài khoản giáo viên:</span>
                    <span className="font-mono font-bold text-cyan-300 text-sm">{targetPhone}</span>
                  </div>
                  <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Đã được Ban Quản Trị phê duyệt</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold font-cyber text-white">
                    QUÉT MÃ QR ZALO ĐỂ ĐĂNG NHẬP
                  </h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Mở Zalo trên điện thoại quét mã QR số <strong className="text-cyan-300 font-mono">{targetPhone}</strong>:
                  </p>
                </div>

                {/* QR Code Container */}
                <div className="inline-flex p-3 bg-white rounded-2xl shadow-xl border-4 border-cyan-400/50 relative">
                  {teacherQrUrl ? (
                    <img
                      src={teacherQrUrl}
                      alt={`Zalo QR ${targetPhone}`}
                      className="w-48 h-48 sm:w-52 sm:h-52 object-contain"
                    />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center">
                      <RefreshCw className="w-8 h-8 text-cyan-600 animate-spin" />
                    </div>
                  )}
                </div>

                {/* Confirmation Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleConfirmTeacherLogin}
                    className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-cyber font-black text-xs uppercase tracking-wider rounded-xl shadow-[0_0_25px_rgba(16,185,129,0.35)] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Check className="w-4 h-4" />
                    <span>XÁC NHẬN MÃ QR ZALO ĐỂ VÀO LỚP HỌC</span>
                  </button>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setViewState('input');
                    }}
                    className="w-full py-1.5 text-xs text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Đổi số điện thoại khác</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= VIEW 2: PENDING APPROVAL ================= */}
        {viewState === 'pending' && (
          <div className="space-y-4 py-2 animate-in fade-in">
            <div className="bg-amber-950/60 border border-amber-500/50 rounded-2xl p-4 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-md">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>

              <div>
                <span className="px-2.5 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded-full text-[11px] font-cyber font-bold">
                  ĐANG CHỜ PHÊ DUYỆT
                </span>
                <h3 className="text-base font-bold font-cyber text-white mt-2">
                  TÀI KHOẢN CHỜ ADMIN KÍCH HOẠT
                </h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Số điện thoại <strong className="text-amber-300 font-mono text-sm">{targetPhone}</strong> đã được gửi lên hệ thống.
                </p>
              </div>

              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-left text-xs text-slate-300 space-y-1.5">
                <p className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Chỉ giáo viên trong danh sách hoặc được Admin phê duyệt mới được cấp quyền sử dụng.</span>
                </p>
                <p className="flex items-start gap-1.5">
                  <MessageCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>Khi Admin bấm <strong>Phê duyệt</strong>, hệ thống sẽ mở mã QR Zalo để Thầy/Cô xác nhận vào lớp học.</span>
                </p>
              </div>

              {checkStatusMsg && (
                <div className="p-2.5 bg-slate-900 border border-cyan-500/40 rounded-xl text-xs text-cyan-300 font-medium animate-in fade-in">
                  {checkStatusMsg}
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleManualCheckStatus}
                  disabled={isCheckingStatus}
                  className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 text-slate-950 font-cyber font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <RefreshCw className={`w-4 h-4 ${isCheckingStatus ? 'animate-spin' : ''}`} />
                  <span>{isCheckingStatus ? 'Đang kiểm tra...' : 'Kiểm tra trạng thái duyệt ngay'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.open(`https://zalo.me/${ADMIN_ZALO_PHONE}`, '_blank')}
                  className="w-full py-2.5 px-4 bg-blue-600/90 hover:bg-blue-600 text-white font-cyber font-bold text-xs uppercase rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Nhắn Zalo Admin duyệt nhanh ({ADMIN_ZALO_PHONE})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setViewState('input');
                    setError(null);
                    setCheckStatusMsg(null);
                  }}
                  className="w-full py-2 text-xs text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer pt-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Đổi số điện thoại khác</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= VIEW 3: PHONE INPUT FORM ================= */}
        {viewState === 'input' && (
          <div>
            <div className="mb-5 bg-gradient-to-r from-cyan-950/70 to-slate-950/80 border border-cyan-500/30 rounded-xl p-3.5 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-cyan-300 font-cyber mb-0.5">
                  ĐĂNG KÝ & XÁC THỰC QUA ZALO
                </p>
                <p className="text-slate-300 leading-relaxed">
                  Nhập số điện thoại của Thầy/Cô. Sau khi được duyệt, hệ thống sẽ mở mã QR để Thầy/Cô quét bằng app Zalo trên điện thoại xác thực danh tính.
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
                  placeholder="Ví dụ: 0912345678"
                  maxLength={12}
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-cyan-500/50 text-white font-mono text-base placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 transition-all tracking-wider text-center"
                />

                {isAdminPhone && (
                  <div className="mt-2 p-2.5 bg-rose-950/80 border border-rose-500/50 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>Số điện thoại này thuộc Ban Quản Trị. Giáo viên không thể sử dụng số này.</span>
                  </div>
                )}

                {error && !isAdminPhone && (
                  <p className="text-rose-400 text-xs mt-1.5 font-medium flex items-center gap-1">
                    <span>⚠️</span> {error}
                  </p>
                )}
                <p className="text-[11px] text-slate-400 mt-1.5 text-center">
                  Bảo vệ chống mạo danh: Đăng nhập bằng quét mã QR qua Zalo chính chủ.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || isAdminPhone}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 disabled:opacity-40 text-slate-950 font-cyber font-black text-sm uppercase tracking-wider rounded-xl shadow-[0_0_25px_rgba(6,182,212,0.4)] transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>XÁC NHẬN SỐ ĐIỆN THOẠI</span>
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-slate-800 text-center">
              {/* Admin Secure Login via QR only */}
              <button
                type="button"
                onClick={onOpenAdminQr}
                className="text-[11px] text-slate-500 hover:text-amber-400 font-cyber flex items-center justify-center gap-1.5 mx-auto transition-colors cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5 text-amber-400" />
                <span>Quản trị viên: Quét mã QR Zalo đăng nhập</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
