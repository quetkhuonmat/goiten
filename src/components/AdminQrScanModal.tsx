import React, { useState, useEffect, useRef } from 'react';
import {
  QrCode,
  Camera,
  Upload,
  Check,
  AlertCircle,
  X,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Smartphone,
  RotateCcw,
} from 'lucide-react';
import jsQR from 'jsqr';
import QRCode from 'qrcode';
import { ADMIN_ZALO_PHONE, checkIsAdminQr, setStoredAdminAuth } from '../utils/licenseManager';
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
  const [activeTab, setActiveTab] = useState<'scan' | 'upload' | 'qr-view'>('scan');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [zaloQrUrl, setZaloQrUrl] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

    if (qrCanvasRef.current) {
      QRCode.toCanvas(qrCanvasRef.current, rawQrTarget, {
        width: 240,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      }).catch((e) => console.warn('Canvas render error:', e));
    }
  }, []);

  // Reset state whenever modal is opened
  useEffect(() => {
    if (isOpen) {
      setScanSuccess(false);
      setCameraError(null);
      setScanMessage(null);
      if (activeTab === 'scan') {
        startCamera();
      }
    } else {
      stopCamera();
      setScanSuccess(false);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  // Handle successful Admin authentication
  const handleAuthSuccess = () => {
    setScanSuccess(true);
    sound.playFanfare();
    setStoredAdminAuth(true);
    setTimeout(() => {
      setScanSuccess(false);
      onSuccess();
    }, 1100);
  };

  const handleClose = () => {
    stopCamera();
    setScanSuccess(false);
    setCameraError(null);
    setScanMessage(null);
    onClose();
  };

  const handleSwitchTab = (tab: 'scan' | 'upload' | 'qr-view') => {
    sound.playClick();
    setScanSuccess(false);
    setCameraError(null);
    setScanMessage(null);
    setActiveTab(tab);

    if (tab === 'scan') {
      startCamera();
    } else {
      stopCamera();
    }
  };

  // Start Camera for live QR scanning
  const startCamera = async () => {
    stopCamera();
    setCameraError(null);
    setScanMessage('Đang khởi động camera...');

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);
        setScanMessage('Hướng camera vào mã QR Zalo của số 0973834541...');
        requestAnimationFrame(tickScan);
      }
    } catch (err: any) {
      console.warn('Camera scan error:', err);
      setCameraError('Không thể mở camera. Bạn có thể chọn cách tải ảnh mã QR lên.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // Frame processing loop with jsQR
  const tickScan = () => {
    if (!videoRef.current || videoRef.current.readyState < 2) {
      animFrameIdRef.current = requestAnimationFrame(tickScan);
      return;
    }

    const video = videoRef.current;
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        const text = code.data.trim();
        if (checkIsAdminQr(text)) {
          stopCamera();
          handleAuthSuccess();
          return;
        } else {
          setScanMessage(`Mã QR không khớp với số Admin Zalo 0973834541 (${text.slice(0, 24)}...)`);
        }
      }
    }

    animFrameIdRef.current = requestAnimationFrame(tickScan);
  };

  // Handle Image File Upload for QR Scan
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanMessage('Đang giải mã ảnh mã QR...');
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height, {
          inversionAttempts: 'attemptBoth',
        });

        if (code && code.data) {
          if (checkIsAdminQr(code.data)) {
            handleAuthSuccess();
          } else {
            setCameraError(`Mã QR không khớp số Admin Zalo 0973834541 (Nội dung: ${code.data})`);
          }
        } else {
          setCameraError('Không tìm thấy mã QR trong ảnh. Vui lòng thử ảnh rõ nét hơn.');
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-amber-500/50 rounded-3xl p-5 sm:p-6 shadow-[0_0_60px_rgba(245,158,11,0.25)] text-white my-auto">
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

        {/* Tab Selector */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800 mb-4 text-xs font-cyber font-bold">
          <button
            type="button"
            onClick={() => handleSwitchTab('scan')}
            className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'scan'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Quét Camera</span>
          </button>
          <button
            type="button"
            onClick={() => handleSwitchTab('upload')}
            className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Tải Ảnh QR</span>
          </button>
          <button
            type="button"
            onClick={() => handleSwitchTab('qr-view')}
            className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'qr-view'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Xem Mã QR</span>
          </button>
        </div>

        {/* SUCCESS NOTIFICATION OVERLAY (Only temporarily when scan just finished) */}
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
            <button
              type="button"
              onClick={() => setScanSuccess(false)}
              className="text-[11px] text-slate-400 hover:text-white underline mt-2"
            >
              Quay lại
            </button>
          </div>
        ) : (
          <div>
            {/* TAB 1: LIVE CAMERA QR SCANNER */}
            {activeTab === 'scan' && (
              <div className="space-y-3">
                <div className="relative aspect-square max-h-[300px] mx-auto w-full bg-slate-950 rounded-2xl overflow-hidden border border-cyan-500/40 flex items-center justify-center">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                  />

                  {/* Aim target overlay */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-48 h-48 border-2 border-dashed border-amber-400/80 rounded-2xl relative shadow-[0_0_20px_rgba(245,158,11,0.3)] animate-pulse">
                      <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-amber-400" />
                      <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-amber-400" />
                      <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-amber-400" />
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-amber-400" />
                    </div>
                  </div>

                  {!cameraActive && !cameraError && (
                    <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center p-4">
                      <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mb-2" />
                      <p className="text-xs text-slate-300">Đang bật camera quét QR...</p>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-center">
                  <p className="text-xs text-amber-300 font-medium">
                    {scanMessage || `Đưa camera về phía mã QR Zalo của số ${ADMIN_ZALO_PHONE}`}
                  </p>
                </div>

                {cameraError && (
                  <div className="p-2.5 bg-rose-950/70 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{cameraError}</span>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: UPLOAD IMAGE QR */}
            {activeTab === 'upload' && (
              <div className="space-y-4 py-4 text-center">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-amber-500/50 hover:border-amber-400 rounded-2xl p-8 bg-slate-950/60 hover:bg-slate-950/90 transition-all cursor-pointer flex flex-col items-center justify-center gap-3"
                >
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Upload className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="font-cyber font-bold text-sm text-white mb-1">
                      CHỌN ẢNH MÃ QR ZALO
                    </h4>
                    <p className="text-xs text-slate-400">
                      Bấm vào đây để tải ảnh chụp màn hình mã QR Zalo của số <strong>{ADMIN_ZALO_PHONE}</strong>
                    </p>
                  </div>
                  <span className="py-2 px-4 bg-amber-500/20 border border-amber-500/50 text-amber-300 font-cyber font-bold text-xs rounded-xl mt-2">
                    Duyệt ảnh từ thiết bị
                  </span>
                </div>

                {cameraError && (
                  <div className="p-2.5 bg-rose-950/70 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center gap-2 text-left">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{cameraError}</span>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: DISPLAY ZALO QR CODE */}
            {activeTab === 'qr-view' && (
              <div className="py-2 text-center space-y-3 animate-in fade-in">
                <div>
                  <p className="text-xs text-slate-300 mb-1">
                    Mã QR Zalo chính thức của Quản trị viên:
                  </p>
                  <p className="font-mono text-amber-300 font-bold text-sm">
                    {ADMIN_ZALO_PHONE}
                  </p>
                </div>

                <div className="inline-flex p-3 bg-white rounded-2xl shadow-2xl border-4 border-amber-400/40">
                  {zaloQrUrl ? (
                    <img
                      src={zaloQrUrl}
                      alt={`Zalo QR ${ADMIN_ZALO_PHONE}`}
                      className="w-52 h-52 object-contain"
                    />
                  ) : (
                    <canvas ref={qrCanvasRef} className="w-52 h-52" />
                  )}
                </div>

                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Dùng điện thoại quét mã QR Zalo trên hoặc bấm nút dưới để xác thực tài khoản Admin:
                </p>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleAuthSuccess}
                    className="py-3 px-6 bg-gradient-to-r from-amber-500 via-orange-400 to-cyan-500 hover:from-amber-400 text-slate-950 font-cyber font-black text-xs uppercase rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.4)] cursor-pointer active:scale-95 flex items-center justify-center gap-2 mx-auto"
                  >
                    <Check className="w-4 h-4" />
                    <span>XÁC NHẬN MÃ QR NÀY ĐỂ VÀO ADMIN</span>
                  </button>
                </div>
              </div>
            )}
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
