import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Smartphone, Copy, Check, ExternalLink, Sparkles, AlertTriangle, ShieldCheck } from 'lucide-react';
import { sound } from '../utils/audio';

interface PhoneGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  appUrl: string;
}

export const PhoneGuideModal: React.FC<PhoneGuideModalProps> = ({
  isOpen,
  onClose,
  appUrl,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (appUrl) {
      QRCode.toDataURL(appUrl, {
        width: 280,
        margin: 2,
        color: {
          dark: '#050b14',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('QR code error', err));
    }
  }, [appUrl]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(appUrl);
    setCopied(true);
    sound.playClick();
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-cyan-400/80 rounded-3xl p-6 shadow-[0_0_50px_rgba(6,182,212,0.4)] text-slate-100 overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Glow ambient */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-36 bg-cyan-500/25 rounded-full blur-3xl pointer-events-none" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors p-1.5 rounded-full hover:bg-slate-800"
          aria-label="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-2 text-cyan-400">
          <Smartphone className="w-5 h-5" />
          <span className="text-xs font-cyber tracking-widest uppercase">KẾT NỐI CAMERA ĐIỆN THOẠI</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-black font-cyber text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-cyan-300 to-emerald-300 mb-3">
          MỞ TRÊN ĐIỆN THOẠI & XỬ LÝ LỖI 403
        </h2>

        {/* 403 Explanation Alert */}
        <div className="mb-4 bg-amber-950/60 border border-amber-500/60 rounded-2xl p-3.5 text-xs text-amber-200">
          <div className="flex items-center gap-2 font-bold text-amber-300 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Tại sao điện thoại quét mã bị báo lỗi 403?</span>
          </div>
          <p className="text-slate-300 leading-relaxed">
            Link phát triển của Google AI Studio (<code>ais-dev-...</code>) được Google bảo mật chặt chẽ bằng tài khoản của thầy. Khi mở bằng Zalo hoặc trình duyệt trên điện thoại chưa đăng nhập tài khoản Google của thầy, máy chủ Google Cloud sẽ từ chối và báo lỗi <strong>403 Forbidden</strong>.
          </p>
        </div>

        {/* 2 Ways to Fix */}
        <div className="space-y-3 mb-5 text-xs">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-xl p-3.5">
            <div className="flex items-center gap-2 font-bold text-cyan-300 mb-1">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>Cách 1: Đăng nhập Google trên điện thoại (Mở ngay)</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-slate-300 pl-1">
              <li>Mở trình duyệt <strong>Google Chrome</strong> hoặc <strong>Safari</strong> trên điện thoại.</li>
              <li>Đăng nhập tài khoản Google của thầy: <strong className="text-white">haitv.c2lang@nghean.edu.vn</strong></li>
              <li>Quét mã QR bên dưới hoặc dán đường link vào trình duyệt.</li>
            </ol>
          </div>

          <div className="bg-slate-900 border border-emerald-500/40 rounded-xl p-3.5">
            <div className="flex items-center gap-2 font-bold text-emerald-300 mb-1">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Cách 2: Đưa lên Vercel (Khuyên dùng - Không bao giờ lỗi 403)</span>
            </div>
            <p className="text-slate-300 leading-relaxed mb-2">
              Chỉ mất 1 phút đưa mã nguồn lên <strong>Vercel</strong>, thầy sẽ nhận được link vĩnh viễn dạng <code>https://goi-ten.vercel.app</code>. Link này công khai 100%, không cần đăng nhập Google, bất kỳ ai cũng quét mã mở được ngay!
            </p>
          </div>
        </div>

        {/* QR Code and Quick Scan */}
        <div className="bg-slate-950/90 border border-cyan-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4 mb-4">
          <div className="p-2 bg-white rounded-xl shadow-lg shrink-0">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR Code mở ứng dụng trên điện thoại" className="w-32 h-32 sm:w-36 sm:h-36" />
            ) : (
              <div className="w-32 h-32 bg-slate-200 animate-pulse rounded-lg" />
            )}
          </div>

          <div className="flex-1 text-center sm:text-left">
            <div className="text-xs font-bold text-white mb-1">
              Đường link trực tiếp hiện tại:
            </div>
            <div className="p-2 bg-slate-900 border border-slate-700 rounded-lg text-[10px] font-mono text-cyan-300 break-all mb-3 select-all">
              {appUrl}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleCopyLink}
                className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 rounded-xl text-cyan-300 text-xs font-semibold transition-all"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Đã sao chép link!' : 'Sao chép link'}</span>
              </button>

              <a
                href={appUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs font-semibold transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Mở tab mới</span>
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end">
          <button
            onClick={onClose}
            className="py-2 px-5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
