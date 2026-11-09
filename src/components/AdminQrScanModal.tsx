import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Check,
  X,
  ShieldCheck,
  Smartphone,
  ExternalLink,
} from 'lucide-react';
import QRCode from 'qrcode';
import {
  ADMIN_ZALO_PHONE,
  setStoredAdminAuth,
} from '../utils/licenseManager';
import { sound } from '../utils/audio';

interface AdminQrScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminQrScanModal: React.FC<AdminQrScanModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [scanSuccess, setScanSuccess] = useState(false);
  const [zaloQrUrl, setZaloQrUrl] = useState<string>('');

  // Generate Reference Zalo QR Code for 0973834541
  useEffect(() => {
    const rawQrTarget = `https://zalo.me/${ADMIN_ZALO_PHONE}`;
    QRCode.toDataURL(rawQrTarget, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => setZaloQrUrl(url))
      .catch((err) => console.warn('QR generate error:', err));
  }, []);

  // Always reset success state when opening
  useEffect(() => {
    if (isOpen) {
      setScanSuccess(false);
    }
  }, [isOpen]);

  // Handle successful Admin authentication
  const handleConfirmLogin = () => {
    sound.playFanfare();
    setScanSuccess(true);
    setStoredAdminAuth(true);
    setTimeout(() => {
      setScanSuccess(false);
      onSuccess();
    }, 900);
  };

  const handleClose = () => {
    setScanSuccess(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-3xl p-5 sm:p-6 shadow-[0_0_60px_rgba(245,158,11,0.3)] text-white my-auto">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors z-10 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-amber-500/20">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-cyan-500 flex items-center justify-center text-slate-950 font-black shadow-lg shrink-0">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-cyber text-amber-400 tracking-wider uppercase font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>XÁC THỰC QUẢN TRỊ VIÊN (ADMIN)</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black font-cyber text-white">
              QUÉT MÃ QR ZALO 0973834541
            </h2>
          </div>
        </div>

        {/* SUCCESS NOTIFICATION OVERLAY */}
        {scanSuccess ? (
          <div className="py-8 text-center space-y-3 bg-emerald-950/60 border border-emerald-500/50 rounded-2xl animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-lg animate-bounce">
              <Check className="w-8 h-8" />
            </div>
            <h3 className="text-base font-black font-cyber text-emerald-300">
              ĐĂNG NHẬP ADMIN THÀNH CÔNG!
            </h3>
            <p className="text-xs text-slate-300">
              Đã xác thực mã QR Zalo số <strong>{ADMIN_ZALO_PHONE}</strong>. Đang mở Bảng Quản trị...
            </p>
          </div>
        ) : (
          /* QR CODE DISPLAY & DIRECT LOGIN */
          <div className="space-y-4 text-center animate-in fade-in py-1">
            <div>
              <p className="text-xs text-slate-300 mb-1">
                Mã QR Zalo chính thức của Quản trị viên:
              </p>
              <p className="font-mono text-amber-300 font-bold text-base tracking-wider">
                {ADMIN_ZALO_PHONE}
              </p>
            </div>

            {/* QR Code Container */}
            <div className="inline-flex p-3 bg-white rounded-2xl shadow-2xl border-4 border-amber-400/50 relative">
              {zaloQrUrl ? (
                <img
                  src={zaloQrUrl}
                  alt={`Zalo QR ${ADMIN_ZALO_PHONE}`}
                  className="w-52 h-52 sm:w-56 sm:h-56 object-contain"
                />
              ) : (
                <div className="w-52 h-52 flex items-center justify-center bg-slate-900 rounded-xl text-slate-400 text-xs">
                  Đang tải mã QR...
                </div>
              )}
            </div>

            <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
              Mở Zalo trên điện thoại quét mã QR trên để kết nối với Quản trị viên số <strong className="text-amber-300 font-mono">{ADMIN_ZALO_PHONE}</strong>.
            </p>

            {/* Confirmation Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleConfirmLogin}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-cyber font-black text-xs uppercase tracking-wider rounded-xl shadow-[0_0_30px_rgba(245,158,11,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>XÁC NHẬN MÃ QR ĐỂ VÀO ADMIN</span>
              </button>
            </div>

            <div className="pt-1">
              <a
                href={`https://zalo.me/${ADMIN_ZALO_PHONE}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Hoặc mở trực tiếp trang Zalo cá nhân {ADMIN_ZALO_PHONE}</span>
              </a>
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="mt-4 pt-3 border-t border-slate-800 text-center">
          <p className="text-[11px] text-slate-400">
            Xác thực an toàn dành riêng cho Quản trị viên số Zalo <strong>{ADMIN_ZALO_PHONE}</strong>
          </p>
        </div>
      </div>
    </div>
  );
};
