import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Smartphone,
  Copy,
  Check,
  ExternalLink,
  Wifi,
  Sparkles,
  Camera,
  CheckCircle2,
} from 'lucide-react';
import { sound } from '../utils/audio';

interface RemoteCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
  isPhoneConnected: boolean;
  onSwitchToRemoteMode: () => void;
  isRemoteActive: boolean;
}

export const RemoteCameraModal: React.FC<RemoteCameraModalProps> = ({
  isOpen,
  onClose,
  roomCode,
  isPhoneConnected,
  onSwitchToRemoteMode,
  isRemoteActive,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const getPhoneConnectUrl = () => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      return `${origin}/?room=${roomCode}&mode=phone-cam`;
    }
    return `https://ais-dev-3becnjuf7ng6rgghq67tzs-264511727123.asia-east1.run.app/?room=${roomCode}&mode=phone-cam`;
  };

  const phoneUrl = getPhoneConnectUrl();

  useEffect(() => {
    if (phoneUrl) {
      QRCode.toDataURL(phoneUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#050b14',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('QR code error', err));
    }
  }, [phoneUrl]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(phoneUrl);
    setCopied(true);
    sound.playClick();
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-xl bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-cyan-400/80 rounded-3xl p-6 shadow-[0_0_60px_rgba(6,182,212,0.4)] text-slate-100 overflow-hidden max-h-[92vh] overflow-y-auto">
        {/* Glow ambient */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-36 bg-cyan-500/25 rounded-full blur-3xl pointer-events-none" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors p-1.5 rounded-full hover:bg-slate-800"
          aria-label="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-1 text-cyan-400">
          <Smartphone className="w-5 h-5 text-emerald-400 animate-bounce" />
          <span className="text-xs font-cyber tracking-widest uppercase">
            GIẢI PHÁP CHO MÁY TÍNH BÀN (KHÔNG CÓ WEBCAM)
          </span>
        </div>
        <h2 className="text-xl sm:text-2xl font-black font-cyber text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-teal-200 to-emerald-300 mb-2">
          BIẾN ĐIỆN THOẠI THÀNH CAMERA QUÉT CHO MÁY TÍNH
        </h2>
        <p className="text-xs text-slate-300 mb-4 leading-relaxed">
          Thầy/Cô chỉ cần quét mã QR bằng điện thoại. Điện thoại sẽ biến thành camera quét không dây, đi quanh lớp ghi nhận khuôn mặt học sinh và đồng bộ trực tiếp lên màn hình máy tính bàn!
        </p>

        {/* Connection Status Badge */}
        <div
          className={`mb-4 p-3 rounded-2xl border flex items-center justify-between transition-colors ${
            isPhoneConnected
              ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
              : 'bg-amber-950/60 border-amber-500/50 text-amber-200'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            <Wifi className={`w-4 h-4 ${isPhoneConnected ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
            <span>
              {isPhoneConnected
                ? 'ĐIỆN THOẠI ĐÃ KẾT NỐI! Camera điện thoại đang truyền tín hiệu sang máy tính.'
                : 'ĐANG CHỜ ĐIỆN THOẠI QUÉT MÃ... (Chưa có thiết bị kết nối)'}
            </span>
          </div>
          <span className="font-mono text-xs px-2 py-0.5 rounded bg-black/40 border border-white/20 font-bold">
            PHÒNG: {roomCode}
          </span>
        </div>

        {/* QR Code and Quick Scan Section */}
        <div className="bg-slate-950/90 border border-cyan-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-5 mb-4">
          <div className="p-2 bg-white rounded-2xl shadow-xl shrink-0">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR Code kết nối phòng ${roomCode}`}
                className="w-36 h-36 sm:w-40 sm:h-40"
              />
            ) : (
              <div className="w-36 h-36 bg-slate-200 animate-pulse rounded-lg" />
            )}
          </div>

          <div className="flex-1 text-center sm:text-left">
            <div className="text-xs font-bold text-white mb-1 flex items-center gap-1.5 justify-center sm:justify-start">
              <Camera className="w-4 h-4 text-cyan-400" />
              <span>Hướng camera điện thoại vào mã QR để mở</span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              Mã kết nối tự động đưa điện thoại vào chế độ Camera Sau quét lớp học.
            </p>

            <div className="p-2 bg-slate-900 border border-slate-700 rounded-lg text-[10px] font-mono text-cyan-300 break-all mb-3 select-all">
              {phoneUrl}
            </div>

            <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
              <button
                onClick={handleCopyLink}
                className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 rounded-xl text-cyan-300 text-xs font-semibold transition-all"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Đã sao chép link!' : 'Sao chép link'}</span>
              </button>

              <a
                href={phoneUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs font-semibold transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Thử mở tab điện thoại</span>
              </a>
            </div>
          </div>
        </div>

        {/* 3 Step Instruction */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-5 text-[11px]">
          <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-xl">
            <div className="font-bold text-cyan-400 mb-0.5">1. Quét mã QR</div>
            <p className="text-slate-400">Dùng Zalo hoặc Camera điện thoại quét mã QR ở trên.</p>
          </div>
          <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-xl">
            <div className="font-bold text-teal-400 mb-0.5">2. Quét quanh lớp</div>
            <p className="text-slate-400">Cầm điện thoại lia qua học sinh, AI sẽ tự động khoanh vùng mặt.</p>
          </div>
          <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-xl">
            <div className="font-bold text-emerald-400 mb-0.5">3. Chốt học sinh</div>
            <p className="text-slate-400">Bấm nút Quay trên điện thoại, máy tính sẽ phát loa và hiện ảnh!</p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <button
            onClick={() => {
              onSwitchToRemoteMode();
              sound.playFanfare();
              onClose();
            }}
            className={`py-2 px-4 rounded-xl text-xs font-cyber font-bold flex items-center gap-2 transition-all shadow-md ${
              isRemoteActive
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isRemoteActive ? 'ĐANG HIỂN THỊ CAMERA ĐIỆN THOẠI' : 'HIỂN THỊ MÀN HÌNH ĐIỆN THOẠI TRÊN MÁY TÍNH'}</span>
          </button>

          <button
            onClick={onClose}
            className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
