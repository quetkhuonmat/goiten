import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
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
  Camera,
  Upload,
} from 'lucide-react';
import jsQR from 'jsqr';
import {
  isValidPhoneNumber,
  normalizePhoneNumber,
  ADMIN_ZALO_PHONE,
  apiCheckTeacherStatus,
  RegisterPhoneResult,
  getStoredLicense,
  saveStoredLicense,
  subscribeTeacherDoc,
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
  const [isSuccess, setIsSuccess] = useState(false);
  const [mismatchError, setMismatchError] = useState<string | null>(null);

  // QR Code on screen state for teacher
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [useCamera, setUseCamera] = useState(false);

  // Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Pending check status state
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [checkStatusMsg, setCheckStatusMsg] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pollIntervalRef = useRef<any>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

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

  const stopListening = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  const handleAuthSuccess = () => {
    stopListening();
    stopCamera();
    sound.playFanfare();
    setIsSuccess(true);
    setTimeout(() => {
      const activePhone = targetPhone || phone;
      const approvedLic: TeacherLicense = {
        ...(targetLicense || {}),
        phone: activePhone,
        status: 'approved',
        registeredAt: targetLicense?.registeredAt || Date.now(),
        approvedAt: Date.now(),
        usedSpins: targetLicense?.usedSpins || 0,
        isKeyActive: targetLicense?.isKeyActive || false,
      };
      approvedLic.status = 'approved';
      saveStoredLicense(approvedLic);
      onApproved(approvedLic);
    }, 1200);
  };

  // Setup real-time QR code for teacher verification
  const setupTeacherQr = async (teacherPhone: string) => {
    stopListening();
    stopCamera();
    setUseCamera(false);
    setIsSuccess(false);
    setMismatchError(null);

    const randomPart = Math.random().toString(36).substring(2, 8);
    const topic = `ais_zalo_teacher_${teacherPhone}_${randomPart}_${Date.now()}`;
    const url = `https://ntfy.sh/${topic}/publish?message=CONFIRMED_${teacherPhone}&title=XAC_THUC_GIAO_VIEN`;

    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
        color: {
          dark: '#020617',
          light: '#ffffff',
        },
      });
      setQrDataUrl(dataUrl);
    } catch (e) {
      console.warn('Teacher QR generation error:', e);
    }

    // SSE listener
    try {
      const es = new EventSource(`https://ntfy.sh/${topic}/sse`);
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.message && (data.message.includes('CONFIRMED') || data.message.includes(teacherPhone))) {
            es.close();
            handleAuthSuccess();
          }
        } catch {}
      };
      eventSourceRef.current = es;
    } catch {}

    // Fast polling
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`https://ntfy.sh/${topic}/json?poll=1`);
        if (res.ok) {
          const text = await res.text();
          if (text.includes('CONFIRMED') || text.includes(teacherPhone)) {
            clearInterval(poll);
            handleAuthSuccess();
          }
        }
      } catch {}
    }, 800);

    pollIntervalRef.current = poll;
  };

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
      setCameraError('Chưa thể mở camera máy tính. Bạn có thể quét mã QR hiển thị trên màn hình.');
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
        const clean = text.replace(/[\s\-_.:]/g, '');
        if (clean.includes(targetPhone) || text.includes(`zalo.me/${targetPhone}`)) {
          stopCamera();
          handleAuthSuccess();
          return;
        } else {
          setMismatchError(`Mã QR không trùng khớp với Zalo số ${targetPhone} (${text.slice(0, 20)}...)`);
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
          const text = code.data.trim();
          const clean = text.replace(/[\s\-_.:]/g, '');
          if (clean.includes(targetPhone) || text.includes(`zalo.me/${targetPhone}`)) {
            stopCamera();
            handleAuthSuccess();
          } else {
            setMismatchError(`Mã QR trong ảnh không trùng khớp với Zalo số ${targetPhone}`);
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

  // Check stored license on modal open
  useEffect(() => {
    if (isOpen) {
      setIsSuccess(false);
      setMismatchError(null);
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
    } else {
      stopCamera();
      stopListening();
    }
    return () => {
      stopCamera();
      stopListening();
    };
  }, [isOpen]);

  useEffect(() => {
    if (viewState === 'qr-verify') {
      if (useCamera) {
        stopListening();
        startCamera();
      } else {
        stopCamera();
        if (targetPhone) {
          setupTeacherQr(targetPhone);
        }
      }
    } else {
      stopCamera();
      stopListening();
    }
  }, [viewState, useCamera, targetPhone]);

  // Real-time Cloud Firestore listener for instant admin approval
  useEffect(() => {
    if (viewState === 'pending' && targetPhone) {
      const unsub = subscribeTeacherDoc(targetPhone, (updated) => {
        if (updated.status === 'approved') {
          sound.playFanfare();
          setTargetLicense(updated);
          setViewState('qr-verify');
        }
      });
      return () => unsub();
    }
  }, [viewState, targetPhone]);

  if (!isOpen) return null;

  const norm = normalizePhoneNumber(phone);
  const isAdminPhone = norm === ADMIN_ZALO_PHONE;

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
        setTargetPhone(norm);
        setTargetLicense(res.license);
        setViewState('qr-verify');
      } else {
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
          setTargetPhone(targetPhone);
          setTargetLicense(statusRes.record!);
          setViewState('qr-verify');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-md bg-slate-900 border border-cyan-500/40 rounded-3xl p-6 sm:p-7 shadow-[0_0_50px_rgba(6,182,212,0.25)] text-white my-auto">
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

        {/* ================= VIEW 1: QR CODE ZALO LOGIN (INSTANT REAL-TIME - NO BYPASS) ================= */}
        {viewState === 'qr-verify' && (
          <div className="space-y-4 py-1 animate-in fade-in">
            {isSuccess ? (
              <div className="p-6 bg-emerald-950/80 border border-emerald-500/60 rounded-2xl space-y-3 text-center animate-in zoom-in-95">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-lg animate-bounce">
                  <Check className="w-9 h-9" />
                </div>
                <h3 className="text-base font-black font-cyber text-emerald-300">
                  XÁC THỰC ZALO THÀNH CÔNG!
                </h3>
                <p className="text-xs text-slate-200">
                  Đã xác thực mã QR trùng khớp với Zalo số <strong className="font-mono text-cyan-300">{targetPhone}</strong>. Đang mở lớp học...
                </p>
              </div>
            ) : useCamera ? (
              /* Camera option */
              <div className="space-y-3">
                <div className="relative aspect-video max-h-[220px] mx-auto w-full bg-slate-950 rounded-2xl overflow-hidden border-2 border-cyan-500/50 flex items-center justify-center shadow-inner">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                  />

                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-40 h-40 border-2 border-dashed border-cyan-400/90 rounded-2xl relative shadow-[0_0_25px_rgba(6,182,212,0.35)] animate-pulse">
                      <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-cyan-400" />
                      <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-cyan-400" />
                      <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-cyan-400" />
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-cyan-400" />
                    </div>
                  </div>

                  {!cameraActive && !cameraError && (
                    <div className="absolute inset-0 bg-slate-950/85 flex flex-col items-center justify-center p-4">
                      <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mb-2" />
                      <p className="text-xs text-slate-300">Đang bật camera máy tính...</p>
                    </div>
                  )}
                </div>

                <div className="p-2.5 bg-slate-950/80 border border-cyan-500/30 rounded-xl text-center">
                  <p className="text-xs text-cyan-300 font-cyber font-bold flex items-center justify-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-cyan-400" />
                    <span>HƯỚNG MÃ QR ZALO VÀO CAMERA</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Mở Zalo &gt; Trang cá nhân &gt; Mã QR của tôi và đưa trước camera máy tính.
                  </p>
                </div>

                {mismatchError && (
                  <div className="p-2.5 bg-rose-950/80 border border-rose-500/50 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{mismatchError}</span>
                  </div>
                )}

                <div className="pt-1 flex items-center justify-between gap-2">
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
                    <Upload className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Tải ảnh QR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUseCamera(false)}
                    className="py-2 px-3 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Quay lại mã QR trên màn hình</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Screen QR Code View (Default) */
              <div className="space-y-3 text-center">
                <div className="p-2.5 bg-cyan-950/60 border border-cyan-500/30 rounded-xl text-left">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Tài khoản giáo viên:</span>
                    <span className="font-mono font-bold text-cyan-300 text-sm">{targetPhone}</span>
                  </div>
                  <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Đã được Ban Quản Trị phê duyệt</span>
                  </div>
                </div>

                {/* QR Code Container */}
                <div className="relative mx-auto w-fit p-3 bg-white rounded-2xl shadow-[0_0_35px_rgba(6,182,212,0.25)] border-4 border-cyan-400/80">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={`Mã QR Zalo ${targetPhone}`}
                      className="w-48 h-48 sm:w-56 sm:h-56 object-contain rounded-lg"
                    />
                  ) : (
                    <div className="w-48 h-48 sm:w-56 sm:h-56 flex flex-col items-center justify-center bg-slate-100 rounded-lg text-slate-800">
                      <RefreshCw className="w-7 h-7 animate-spin text-cyan-600 mb-2" />
                      <span className="text-xs font-bold">Đang tạo mã QR...</span>
                    </div>
                  )}
                </div>

                {/* Waiting indicator */}
                <div className="p-2.5 bg-slate-950/80 border border-cyan-500/30 rounded-xl text-center space-y-1">
                  <div className="flex items-center justify-center gap-2 text-xs font-cyber font-bold text-cyan-300">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
                    </span>
                    <span>ĐANG CHỜ ZALO QUÉT MÃ ĐỂ VÀO LỚP...</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Mở Zalo trên điện thoại &gt; Dùng tính năng <strong>Quét mã QR</strong> quét mã trên.
                  </p>
                </div>

                {/* Secondary options */}
                <div className="pt-1 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => setUseCamera(true)}
                    className="text-slate-400 hover:text-cyan-300 transition-colors flex items-center gap-1 cursor-pointer underline text-[11px]"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Dùng Camera máy tính quét</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      stopListening();
                      stopCamera();
                      setViewState('input');
                    }}
                    className="text-slate-400 hover:text-white transition-colors flex items-center gap-1 cursor-pointer text-[11px]"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Đổi số</span>
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
                  <span>Khi Admin bấm <strong>Phê duyệt</strong>, hệ thống sẽ mở mã QR để Thầy/Cô quét mã Zalo vào lớp học.</span>
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
                  Nhập số điện thoại của Thầy/Cô. Sau khi được duyệt, hệ thống sẽ mở mã QR để quét bằng Zalo chính chủ xác thực danh tính.
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
