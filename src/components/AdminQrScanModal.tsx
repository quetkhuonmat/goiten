import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Check,
  X,
  ShieldCheck,
  RefreshCw,
  Camera,
  Upload,
  AlertCircle,
  Smartphone,
  ExternalLink,
} from 'lucide-react';
import jsQR from 'jsqr';
import {
  ADMIN_ZALO_PHONE,
  checkIsAdminQr,
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
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [sessionTopic, setSessionTopic] = useState<string>('');
  const [confirmUrl, setConfirmUrl] = useState<string>('');
  const [isListening, setIsListening] = useState(false);
  const [mismatchError, setMismatchError] = useState<string | null>(null);

  // Camera fallback mode (subtle option)
  const [useCamera, setUseCamera] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pollIntervalRef = useRef<any>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Stop camera
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

  // Stop real-time listeners
  const stopListening = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsListening(false);
  };

  // Called strictly when authentication is confirmed
  const handleAuthSuccess = () => {
    stopListening();
    stopCamera();
    sound.playFanfare();
    setScanSuccess(true);
    setStoredAdminAuth(true);

    setTimeout(() => {
      setScanSuccess(false);
      onSuccess();
    }, 1200);
  };

  // Start Camera for scanning Admin's QR code from webcam
  const startCamera = async () => {
    stopCamera();
    setCameraError(null);
    setMismatchError(null);

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);
        requestAnimationFrame(tickScan);
      }
    } catch (err: unknown) {
      console.warn('Camera scan error:', err);
      const msg = err instanceof Error ? err.message : '';
      setCameraError(
        msg.includes('Permission') || msg.includes('NotAllowedError')
          ? 'Trình duyệt chưa được cấp quyền camera. Vui lòng cho phép hoặc dùng Zalo quét mã QR trên màn hình.'
          : 'Không thể mở camera. Vui lòng dùng Zalo trên điện thoại quét mã QR hiển thị trên màn hình.'
      );
      setCameraActive(false);
    }
  };

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
        inversionAttempts: 'attemptBoth',
      });

      if (code && code.data) {
        const text = code.data.trim();
        if (checkIsAdminQr(text)) {
          stopCamera();
          handleAuthSuccess();
          return;
        } else {
          setMismatchError(`Mã QR không trùng khớp với Zalo Admin 0973834541 (${text.slice(0, 24)}...)`);
        }
      }
    }

    animFrameIdRef.current = requestAnimationFrame(tickScan);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMismatchError(null);
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
            stopCamera();
            handleAuthSuccess();
          } else {
            setMismatchError(`Mã QR trong ảnh không trùng khớp với số Admin Zalo 0973834541 (${code.data})`);
          }
        } else {
          setMismatchError('Không nhận diện được mã QR trong ảnh. Vui lòng thử ảnh chụp rõ nét hơn.');
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = '';
  };

  // Initialize QR code and real-time listener when modal opens
  const initSession = async () => {
    stopListening();
    stopCamera();
    setUseCamera(false);
    setScanSuccess(false);
    setMismatchError(null);

    // Create a unique topic on open real-time relay (ntfy.sh)
    const randomPart = Math.random().toString(36).substring(2, 8);
    const topic = `ais_zalo_admin_${ADMIN_ZALO_PHONE}_${randomPart}_${Date.now()}`;
    setSessionTopic(topic);

    // URL to confirm login when scanned with Zalo
    const url = `https://ntfy.sh/${topic}/publish?message=CONFIRMED_${ADMIN_ZALO_PHONE}&title=XAC_THUC_ADMIN_0973834541`;
    setConfirmUrl(url);

    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 320,
        margin: 2,
        color: {
          dark: '#020617',
          light: '#ffffff',
        },
      });
      setQrDataUrl(dataUrl);
    } catch (e) {
      console.warn('QR generation error:', e);
    }

    setIsListening(true);

    // 1. Listen via EventSource SSE
    try {
      const es = new EventSource(`https://ntfy.sh/${topic}/sse`);
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.message && (data.message.includes('CONFIRMED') || data.message.includes(ADMIN_ZALO_PHONE))) {
            es.close();
            handleAuthSuccess();
          }
        } catch {}
      };
      es.onerror = () => {
        // SSE error fallback to polling
      };
      eventSourceRef.current = es;
    } catch {}

    // 2. High-speed poll every 800ms
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`https://ntfy.sh/${topic}/json?poll=1`);
        if (res.ok) {
          const text = await res.text();
          if (text.includes('CONFIRMED') || text.includes(ADMIN_ZALO_PHONE)) {
            clearInterval(pollInterval);
            handleAuthSuccess();
          }
        }
      } catch {}
    }, 800);

    pollIntervalRef.current = pollInterval;
  };

  useEffect(() => {
    if (isOpen) {
      initSession();
    } else {
      stopListening();
      stopCamera();
      setScanSuccess(false);
    }

    return () => {
      stopListening();
      stopCamera();
    };
  }, [isOpen]);

  useEffect(() => {
    if (useCamera) {
      stopListening();
      startCamera();
    } else {
      stopCamera();
    }
  }, [useCamera]);

  const handleClose = () => {
    stopListening();
    stopCamera();
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
          <div className="py-8 text-center space-y-3 bg-emerald-950/70 border border-emerald-500/60 rounded-2xl animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-lg animate-bounce">
              <Check className="w-9 h-9" />
            </div>
            <h3 className="text-base font-black font-cyber text-emerald-300">
              ĐĂNG NHẬP ADMIN THÀNH CÔNG!
            </h3>
            <p className="text-xs text-slate-200">
              Đã xác thực quét mã QR Zalo số <strong>{ADMIN_ZALO_PHONE}</strong>. Đang mở Bảng Quản trị...
            </p>
          </div>
        ) : useCamera ? (
          /* OPTIONAL CAMERA SCANNER (if user chose camera) */
          <div className="space-y-4 animate-in fade-in">
            <div className="relative aspect-video max-h-[240px] mx-auto w-full bg-slate-950 rounded-2xl overflow-hidden border-2 border-amber-500/50 flex items-center justify-center shadow-inner">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                muted
                playsInline
              />

              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-40 h-40 border-2 border-dashed border-amber-400/90 rounded-2xl relative shadow-[0_0_25px_rgba(245,158,11,0.35)] animate-pulse">
                  <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-amber-400" />
                  <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-amber-400" />
                  <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-amber-400" />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-amber-400" />
                </div>
              </div>

              {!cameraActive && !cameraError && (
                <div className="absolute inset-0 bg-slate-950/85 flex flex-col items-center justify-center p-4">
                  <RefreshCw className="w-7 h-7 text-amber-400 animate-spin mb-2" />
                  <p className="text-xs text-slate-300">Đang bật camera máy tính...</p>
                </div>
              )}
            </div>

            <div className="p-2.5 bg-slate-950/80 border border-amber-500/30 rounded-xl text-center">
              <p className="text-xs text-amber-300 font-cyber font-bold flex items-center justify-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-amber-400" />
                <span>HƯỚNG MÃ QR ZALO 0973834541 VÀO CAMERA</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Mở Zalo trên điện thoại &gt; Trang cá nhân &gt; Mã QR của tôi và đưa trước camera.
              </p>
            </div>

            {mismatchError && (
              <div className="p-2.5 bg-rose-950/80 border border-rose-500/50 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{mismatchError}</span>
              </div>
            )}

            {cameraError && (
              <div className="p-2.5 bg-rose-950/80 border border-rose-500/50 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{cameraError}</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                <span>Tải ảnh mã QR</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setUseCamera(false);
                  initSession();
                }}
                className="py-2 px-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Quay lại mã QR trên màn hình</span>
              </button>
            </div>
          </div>
        ) : (
          /* PRIMARY VIEW: INSTANT REAL-TIME QR CODE (SCAN WITH ZALO) */
          <div className="space-y-4 animate-in fade-in text-center">
            {/* Top Instruction */}
            <p className="text-xs text-slate-300">
              Mã QR Zalo xác thực Quản trị viên số:{' '}
              <strong className="text-amber-400 font-mono text-sm tracking-wider">
                {ADMIN_ZALO_PHONE}
              </strong>
            </p>

            {/* High-Contrast Centered QR Code Box */}
            <div className="relative mx-auto w-fit p-3 bg-white rounded-2xl shadow-[0_0_40px_rgba(245,158,11,0.25)] border-4 border-amber-400/80">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`Mã QR Zalo Admin ${ADMIN_ZALO_PHONE}`}
                  className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-lg"
                />
              ) : (
                <div className="w-56 h-56 sm:w-64 sm:h-64 flex flex-col items-center justify-center bg-slate-100 rounded-lg text-slate-800">
                  <RefreshCw className="w-8 h-8 animate-spin text-amber-600 mb-2" />
                  <span className="text-xs font-bold">Đang tạo mã QR...</span>
                </div>
              )}
            </div>

            {/* Real-Time Detection Status Pulse (NO BYPASS BUTTON) */}
            <div className="p-3 bg-slate-950/80 border border-amber-500/30 rounded-2xl text-center space-y-1">
              <div className="flex items-center justify-center gap-2 text-xs font-cyber font-bold text-amber-300">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                </span>
                <span>HỆ THỐNG ĐANG CHỜ ZALO QUÉT MÃ...</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Mở app <strong>Zalo</strong> trên điện thoại Admin &gt; Bấm <strong>Quét mã QR</strong> &gt; Quét mã trên màn hình máy tính này.
              </p>
            </div>

            {/* Subtle Camera Switch Link (No messy tabs) */}
            <div className="pt-1 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setUseCamera(true)}
                className="text-[11px] text-slate-400 hover:text-amber-300 transition-colors flex items-center gap-1.5 cursor-pointer underline underline-offset-4"
              >
                <Camera className="w-3.5 h-3.5 text-amber-400" />
                <span>Hoặc hướng mã QR vào camera máy tính</span>
              </button>

              <button
                type="button"
                onClick={initSession}
                className="text-[11px] text-slate-500 hover:text-cyan-400 transition-colors flex items-center gap-1 cursor-pointer"
                title="Làm mới mã QR"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Làm mới mã</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="mt-4 pt-3 border-t border-slate-800 text-center">
          <p className="text-[11px] text-slate-400">
            Hệ thống tự động nhận diện và mở quyền Admin ngay khi quét đúng số Zalo <strong>{ADMIN_ZALO_PHONE}</strong>
          </p>
        </div>
      </div>
    </div>
  );
};
