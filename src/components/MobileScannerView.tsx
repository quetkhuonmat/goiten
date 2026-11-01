import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  Sun,
  Play,
  RotateCcw,
  Wifi,
  Sparkles,
  CheckCircle2,
  Maximize,
  Minimize,
} from 'lucide-react';
import { DetectedFace, AppStage } from '../types';
import { detectClassroomFaces } from '../utils/faceDetector';
import { sound } from '../utils/audio';

interface MobileScannerViewProps {
  roomId: string;
  onExitMobileMode: () => void;
}

export const MobileScannerView: React.FC<MobileScannerViewProps> = ({
  roomId,
  onExitMobileMode,
}) => {
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [torchActive, setTorchActive] = useState<boolean>(false);
  const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([]);
  const [highlightedFaceId, setHighlightedFaceId] = useState<number | null>(null);
  const [appStage, setAppStage] = useState<AppStage>('ready');
  const [lockedFace, setLockedFace] = useState<DetectedFace | null>(null);
  const [lockedFaceUrl, setLockedFaceUrl] = useState<string | null>(null);
  const [isSynced, setIsSynced] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<string>('Đang kết nối tới máy tính...');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const pickTimeoutRef = useRef<number | null>(null);
  const frameIntervalRef = useRef<number | null>(null);

  // Send event to server room
  const sendRoomEvent = useCallback(
    async (type: string, payload: any) => {
      try {
        await fetch(`/api/room/${roomId}/event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, payload }),
        });
      } catch (err) {
        console.warn('Failed to send room event:', err);
      }
    },
    [roomId]
  );

  // Crop face from feed
  const cropFace = useCallback((face: DetectedFace): string | null => {
    try {
      if (!videoRef.current || videoRef.current.readyState < 2) return null;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      const srcW = videoRef.current.videoWidth;
      const srcH = videoRef.current.videoHeight;
      if (!srcW || !srcH) return null;

      const facePxX = (face.x / 100) * srcW;
      const facePxY = (face.y / 100) * srcH;
      const facePxW = (face.width / 100) * srcW;
      const facePxH = (face.height / 100) * srcH;

      const cx = facePxX + facePxW / 2;
      const cy = facePxY + facePxH / 2;
      const cropSize = Math.max(facePxW, facePxH) * 1.35;

      let sx = cx - cropSize / 2;
      let sy = cy - cropSize * 0.48;
      let sw = cropSize;
      let sh = cropSize;

      if (sx < 0) sx = 0;
      if (sy < 0) sy = 0;
      if (sx + sw > srcW) sw = srcW - sx;
      if (sy + sh > srcH) sh = srcH - sy;

      const finalSize = Math.max(40, Math.min(sw, sh));
      canvas.width = 480;
      canvas.height = 480;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(videoRef.current, sx, sy, finalSize, finalSize, 0, 0, canvas.width, canvas.height);

      return canvas.toDataURL('image/jpeg', 0.92);
    } catch {
      return null;
    }
  }, []);

  // Capture low-res compressed snapshot to send to PC screen
  const captureFramePreview = useCallback((): string | null => {
    try {
      if (!videoRef.current || videoRef.current.readyState < 2) return null;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      canvas.width = 480;
      canvas.height = Math.round((480 * (videoRef.current.videoHeight || 360)) / (videoRef.current.videoWidth || 480));
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.65);
    } catch {
      return null;
    }
  }, []);

  // Start mobile rear camera
  const startMobileCamera = useCallback(async (facing: 'environment' | 'user') => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      setCameraActive(true);

      const track = stream.getVideoTracks()[0];
      if (track) {
        const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as { torch?: boolean };
        setHasTorch(Boolean(capabilities && capabilities.torch));
      }
    } catch (err) {
      console.warn('Mobile camera error:', err);
    }
  }, []);

  // Initial connect to room
  useEffect(() => {
    sendRoomEvent('phone-connected', { time: Date.now() });
    setIsSynced(true);
    setSyncStatus('Đã đồng bộ thời gian thực với Máy tính bàn!');
    startMobileCamera(cameraFacing);

    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
      }
    };
  }, [roomId, cameraFacing, sendRoomEvent, startMobileCamera]);

  // Periodic frame transmission & face detection
  useEffect(() => {
    if (!cameraActive) return;

    // Scan faces every 1.5 seconds
    const faceInterval = setInterval(async () => {
      if (videoRef.current && videoRef.current.readyState >= 2 && appStage === 'ready') {
        const faces = await detectClassroomFaces(videoRef.current);
        const mapped = faces.map((f, i) => ({ ...f, id: i + 1 }));
        setDetectedFaces(mapped);
        sendRoomEvent('faces-updated', { faces: mapped });
      }
    }, 1500);

    // Send video snapshot to desktop PC every 800ms
    const frameInterval = setInterval(() => {
      const frame = captureFramePreview();
      if (frame) {
        sendRoomEvent('frame-update', { frame });
      }
    }, 800);

    return () => {
      clearInterval(faceInterval);
      clearInterval(frameInterval);
    };
  }, [cameraActive, appStage, captureFramePreview, sendRoomEvent]);

  // Flip camera
  const handleToggleFacing = () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextFacing);
    startMobileCamera(nextFacing);
    sound.playClick();
  };

  // Torch
  const handleToggleTorch = async () => {
    if (!mediaStreamRef.current || !hasTorch) return;
    const track = mediaStreamRef.current.getVideoTracks()[0];
    if (track) {
      const nextTorch = !torchActive;
      try {
        await (track as unknown as { applyConstraints: (c: unknown) => Promise<void> }).applyConstraints({
          advanced: [{ torch: nextTorch }],
        });
        setTorchActive(nextTorch);
      } catch (err) {
        console.warn('Torch error', err);
      }
    }
  };

  // Start Pick from Phone
  const handleStartPick = () => {
    if (detectedFaces.length === 0 || appStage === 'picking') return;

    setAppStage('picking');
    setLockedFace(null);
    setLockedFaceUrl(null);
    sendRoomEvent('stage-change', { stage: 'picking' });

    const winner = detectedFaces[Math.floor(Math.random() * detectedFaces.length)];
    const durationMs = 3000;
    const startTime = Date.now();
    let currentInterval = 80;

    const hopNext = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / durationMs);

      const randomFace = detectedFaces[Math.floor(Math.random() * detectedFaces.length)];
      setHighlightedFaceId(randomFace.id);
      sound.playScanBeep(progress);

      if (elapsed < durationMs) {
        if (progress > 0.6) currentInterval = Math.floor(currentInterval * 1.25);
        pickTimeoutRef.current = window.setTimeout(hopNext, currentInterval);
      } else {
        setHighlightedFaceId(winner.id);
        setLockedFace(winner);
        setAppStage('locked');
        sound.playTargetLocked();

        const croppedUrl = cropFace(winner);
        setLockedFaceUrl(croppedUrl);

        // Notify Desktop PC immediately!
        sendRoomEvent('face-locked', {
          face: winner,
          faceUrl: croppedUrl,
        });
      }
    };

    hopNext();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col justify-between overflow-hidden select-none">
      {/* Top Mobile Bar */}
      <div className="absolute top-0 inset-x-0 z-30 bg-gradient-to-b from-black/90 via-black/60 to-transparent p-3 flex items-center justify-between backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-[10px] font-cyber font-bold">
            <Wifi className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span>KẾT NỐI MÁY TÍNH: PHÒNG {roomId}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {hasTorch && (
            <button
              onClick={handleToggleTorch}
              className={`p-2 rounded-full border ${
                torchActive
                  ? 'bg-amber-400 text-slate-950 border-amber-300'
                  : 'bg-black/60 text-slate-300 border-white/20'
              }`}
            >
              <Sun className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={handleToggleFacing}
            className="p-2 rounded-full bg-black/60 border border-white/20 text-cyan-300"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={onExitMobileMode}
            className="px-2.5 py-1 rounded-full bg-slate-800 border border-slate-600 text-xs text-slate-300 font-semibold"
          >
            Thoát
          </button>
        </div>
      </div>

      {/* Viewfinder Video Stream */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="w-full h-full object-cover"
        />

        {/* HUD Face Scanning Overlay */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Cyber scan lines */}
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, rgba(6,182,212,0.1) 0px, transparent 2px)',
              backgroundSize: '100% 4px',
            }}
          />

          {detectedFaces.map((face) => {
            const isTarget = face.id === highlightedFaceId;
            const isLocked = lockedFace && face.id === lockedFace.id;

            return (
              <div
                key={face.id}
                className="absolute transition-all duration-150"
                style={{
                  left: `${face.x}%`,
                  top: `${face.y}%`,
                  width: `${face.width}%`,
                  height: `${face.height}%`,
                }}
              >
                <div
                  className={`relative w-full h-full rounded-lg transition-all ${
                    isLocked
                      ? 'border-3 border-amber-400 bg-amber-400/20 shadow-[0_0_20px_rgba(251,191,36,0.8)]'
                      : isTarget
                      ? 'border-2 border-yellow-400 bg-yellow-400/25 shadow-[0_0_15px_rgba(250,204,21,0.6)]'
                      : 'border-2 border-cyan-400/70 bg-cyan-400/10'
                  }`}
                >
                  {/* Badge */}
                  <div
                    className={`absolute -top-6 left-0 px-1.5 py-0.5 rounded text-[10px] font-cyber font-bold tracking-wider ${
                      isLocked
                        ? 'bg-amber-400 text-slate-950'
                        : isTarget
                        ? 'bg-yellow-400 text-slate-950'
                        : 'bg-cyan-950/80 text-cyan-300 border border-cyan-400/50'
                    }`}
                  >
                    {isLocked ? '★ CHỌN' : `MẶT #${face.id}`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Floating Status Bar */}
        <div className="absolute bottom-28 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
          <div className="bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-full border border-cyan-500/40 text-xs font-cyber text-cyan-300">
            {detectedFaces.length > 0
              ? `AI ĐÃ PHÁT HIỆN: ${detectedFaces.length} HỌC SINH`
              : 'ĐANG QUÉT TÌM HỌC SINH...'}
          </div>

          <div className="bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-full border border-emerald-500/40 text-xs font-cyber text-emerald-400">
            ĐỒNG BỘ PC ✓
          </div>
        </div>
      </div>

      {/* Bottom Big Action Control Bar */}
      <div className="relative z-30 bg-gradient-to-t from-black via-black/95 to-black/60 p-4 pb-6 flex flex-col gap-2.5">
        {lockedFace && lockedFaceUrl ? (
          <div className="flex items-center justify-between gap-3 bg-slate-900 border border-amber-400/60 p-3 rounded-2xl">
            <img
              src={lockedFaceUrl}
              alt="Học sinh được chọn"
              className="w-12 h-12 rounded-xl object-cover border-2 border-amber-400"
            />
            <div className="flex-1 text-left">
              <div className="text-amber-300 font-cyber font-bold text-xs">★ ĐÃ CHỌN HỌC SINH</div>
              <div className="text-[11px] text-slate-300">Màn hình máy tính đã hiện ảnh em lên bảng!</div>
            </div>
            <button
              onClick={() => {
                setLockedFace(null);
                setLockedFaceUrl(null);
                setAppStage('ready');
                handleStartPick();
              }}
              className="py-2 px-3 bg-emerald-500 text-slate-950 font-cyber font-bold text-xs rounded-xl shadow-md"
            >
              Quay tiếp
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              sound.playClick();
              handleStartPick();
            }}
            disabled={detectedFaces.length === 0 || appStage === 'picking'}
            className="w-full py-4 px-6 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-50 text-slate-950 font-black font-cyber text-base tracking-wider rounded-2xl shadow-[0_0_25px_rgba(16,185,129,0.7)] flex items-center justify-center gap-2.5 active:scale-95 transition-all"
          >
            <Play className="w-5 h-5 fill-slate-950" />
            <span>
              {appStage === 'picking'
                ? 'ĐANG QUAY CHỌN...'
                : `QUAY CHỌN (${detectedFaces.length} HỌC SINH)`}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
