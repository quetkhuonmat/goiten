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
  ZoomIn,
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
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [activeCameraLabel, setActiveCameraLabel] = useState<string>('Camera Sau');
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [torchActive, setTorchActive] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [videoAspectRatio, setVideoAspectRatio] = useState<number | null>(null);

  const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([]);
  const [highlightedFaceId, setHighlightedFaceId] = useState<number | null>(null);
  const [appStage, setAppStage] = useState<AppStage>('ready');
  const [lockedFace, setLockedFace] = useState<DetectedFace | null>(null);
  const [lockedFaceUrl, setLockedFaceUrl] = useState<string | null>(null);
  const [cameraStatusMsg, setCameraStatusMsg] = useState<string>('Đang mở Camera Sau...');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const pickTimeoutRef = useRef<number | null>(null);
  const isSwitchingRef = useRef<boolean>(false);

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

  // Crop face from feed with centered framing
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
      // Tight portrait crop centered on student's head
      const cropSize = Math.max(facePxW, facePxH) * 1.15;

      let sx = cx - cropSize / 2;
      let sy = cy - cropSize * 0.50;
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

      return canvas.toDataURL('image/jpeg', 0.95);
    } catch {
      return null;
    }
  }, []);

  // Capture frame preview to transmit to PC screen
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

  // START REAR CAMERA WITH COMPREHENSIVE FALLBACK AND DEVICE ENUMERATION
  const startCameraStream = useCallback(
    async (preferFacing: 'environment' | 'user' = 'environment', targetDeviceId?: string) => {
      if (isSwitchingRef.current) return;
      isSwitchingRef.current = true;

      // Stop previous tracks
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      setCameraStatusMsg(
        preferFacing === 'environment' ? 'Đang kích hoạt Camera Sau...' : 'Đang kích hoạt Camera Trước...'
      );

      let stream: MediaStream | null = null;

      try {
        // 1. If explicit device ID provided, use it
        if (targetDeviceId) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: targetDeviceId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } else if (preferFacing === 'environment') {
          // 2. Try exact environment constraint first for true rear camera
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: { exact: 'environment' },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
              audio: false,
            });
          } catch {
            // Fallback to ideal environment
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
              audio: false,
            });
          }
        } else {
          // Front camera
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: 'user' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        }
      } catch (err) {
        console.warn('Initial getUserMedia error, fallback to any camera:', err);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        } catch (fatal) {
          console.error('Fatal camera error:', fatal);
          setCameraStatusMsg('Không thể mở camera. Vui lòng cấp quyền camera trong cài đặt trình duyệt.');
          isSwitchingRef.current = false;
          return;
        }
      }

      if (!stream) {
        isSwitchingRef.current = false;
        return;
      }

      mediaStreamRef.current = stream;

      // Attach stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      setCameraActive(true);

      // Now query devices after permission is granted
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = allDevices.filter((d) => d.kind === 'videoinput');
        setAvailableDevices(videoInputs);

        const activeTrack = stream.getVideoTracks()[0];
        if (activeTrack) {
          const settings = activeTrack.getSettings ? activeTrack.getSettings() : {};
          const trackLabel = (activeTrack.label || '').toLowerCase();
          const currentId = settings.deviceId || '';
          setSelectedDeviceId(currentId);

          const isFront =
            settings.facingMode === 'user' ||
            /front|trước|selfie|face/i.test(trackLabel);

          // If user wanted rear camera, but browser handed front camera:
          if (preferFacing === 'environment' && isFront && !targetDeviceId && videoInputs.length > 1) {
            // Find rear device
            const rearDevice = videoInputs.find((d) => {
              const lbl = d.label.toLowerCase();
              return (
                /back|rear|sau|environment|cam.*1|0.*facing back|camera2 0/i.test(lbl) ||
                (!/front|trước|selfie|face/i.test(lbl) && d.deviceId !== currentId)
              );
            });

            if (rearDevice && rearDevice.deviceId && rearDevice.deviceId !== currentId) {
              // Switch immediately to true rear camera!
              isSwitchingRef.current = false;
              startCameraStream('environment', rearDevice.deviceId);
              return;
            }
          }

          // Update human-readable label
          if (isFront) {
            setCameraFacing('user');
            setActiveCameraLabel('Camera Trước');
          } else {
            setCameraFacing('environment');
            setActiveCameraLabel('Camera Sau');
          }

          // Check torch and hardware zoom capabilities
          const caps = (activeTrack.getCapabilities ? activeTrack.getCapabilities() : {}) as {
            torch?: boolean;
            zoom?: { min: number; max: number; step: number };
          };
          setHasTorch(Boolean(caps && caps.torch));
        }
      } catch (e) {
        console.warn('Device inspection error:', e);
      }

      setCameraStatusMsg('');
      isSwitchingRef.current = false;
    },
    []
  );

  // Initial connect & camera start
  useEffect(() => {
    sendRoomEvent('phone-connected', { time: Date.now() });
    startCameraStream('environment');

    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (pickTimeoutRef.current) {
        clearTimeout(pickTimeoutRef.current);
      }
    };
  }, [roomId, sendRoomEvent, startCameraStream]);

  // Periodic frame transmission & face detection
  useEffect(() => {
    if (!cameraActive) return;

    // Scan faces every 1.2 seconds
    const faceInterval = setInterval(async () => {
      if (videoRef.current && videoRef.current.readyState >= 2 && appStage === 'ready') {
        const faces = await detectClassroomFaces(videoRef.current);
        const mapped = faces.map((f, i) => ({ ...f, id: i + 1 }));
        setDetectedFaces(mapped);
        sendRoomEvent('faces-updated', { faces: mapped });
      }
    }, 1200);

    // Send video snapshot to desktop PC every 750ms
    const frameInterval = setInterval(() => {
      const frame = captureFramePreview();
      if (frame) {
        sendRoomEvent('frame-update', { frame });
      }
    }, 750);

    return () => {
      clearInterval(faceInterval);
      clearInterval(frameInterval);
    };
  }, [cameraActive, appStage, captureFramePreview, sendRoomEvent]);

  // Toggle Camera Front / Back / Next Device
  const handleToggleFacing = () => {
    sound.playClick();
    if (availableDevices.length > 2) {
      // Multiple cameras (e.g. Back wide, Back ultra-wide, Front): cycle through all
      const currentIndex = availableDevices.findIndex((d) => d.deviceId === selectedDeviceId);
      const nextIndex = (currentIndex + 1) % availableDevices.length;
      const nextDev = availableDevices[nextIndex];
      const isFront = /front|trước|selfie/i.test(nextDev.label);
      startCameraStream(isFront ? 'user' : 'environment', nextDev.deviceId);
    } else {
      // Flip between environment & user
      const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
      startCameraStream(nextFacing);
    }
  };

  // Zoom Toggle (1x -> 1.5x -> 2x -> 3x -> 1x)
  const handleCycleZoom = async () => {
    sound.playClick();
    const nextZoom = zoomLevel === 1.0 ? 1.5 : zoomLevel === 1.5 ? 2.0 : zoomLevel === 2.0 ? 3.0 : 1.0;
    setZoomLevel(nextZoom);

    // Try hardware zoom if supported
    if (mediaStreamRef.current) {
      const track = mediaStreamRef.current.getVideoTracks()[0];
      if (track) {
        try {
          const caps = (track.getCapabilities ? track.getCapabilities() : {}) as {
            zoom?: { min: number; max: number };
          };
          if (caps && caps.zoom) {
            const clamped = Math.max(caps.zoom.min, Math.min(caps.zoom.max, nextZoom));
            await (track as unknown as { applyConstraints: (c: unknown) => Promise<void> }).applyConstraints({
              advanced: [{ zoom: clamped }],
            });
          }
        } catch {
          // ignore hardware zoom failure, CSS zoom handles it
        }
      }
    }
  };

  // Torch Toggle
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
    let currentInterval = 75;

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
      {/* Top Mobile Cyber Bar */}
      <div className="absolute top-0 inset-x-0 z-30 bg-gradient-to-b from-black/95 via-black/75 to-transparent p-3 pt-4 flex items-center justify-between backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-[10px] font-cyber font-bold shadow-lg">
            <Wifi className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span>PHÒNG: {roomId}</span>
          </div>

          {/* Active Camera Indicator Badge */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-950/80 border border-cyan-400/50 text-cyan-300 text-[10px] font-cyber font-bold">
            <Camera className="w-3 h-3 text-cyan-400" />
            <span>{activeCameraLabel.toUpperCase()}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Zoom toggle button */}
          <button
            onClick={handleCycleZoom}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900 border border-cyan-500/40 text-cyan-300 text-xs font-cyber font-bold"
            title="Độ thu phóng"
          >
            <ZoomIn className="w-3.5 h-3.5" />
            <span>{zoomLevel}x</span>
          </button>

          {/* Flashlight/Torch toggle if supported */}
          {hasTorch && (
            <button
              onClick={handleToggleTorch}
              className={`p-2 rounded-full border ${
                torchActive
                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-[0_0_15px_#fbbf24]'
                  : 'bg-slate-900 text-slate-300 border-white/20'
              }`}
            >
              <Sun className="w-4 h-4" />
            </button>
          )}

          {/* Flip Camera Button */}
          <button
            onClick={handleToggleFacing}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400 text-cyan-300 text-xs font-cyber font-bold"
            title="Đổi camera trước / sau"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            <span>Đổi Cam</span>
          </button>

          {/* Exit button */}
          <button
            onClick={onExitMobileMode}
            className="px-2.5 py-1 rounded-full bg-slate-800 border border-slate-600 text-xs text-slate-300 font-semibold"
          >
            Thoát
          </button>
        </div>
      </div>

      {/* Main Viewfinder Stage: Exact Aspect-Ratio Fit to Guarantee 100% Alignment */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden bg-black">
        {cameraStatusMsg && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 p-6 text-center">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
            <p className="text-sm font-cyber text-cyan-300">{cameraStatusMsg}</p>
          </div>
        )}

        {/* Video Wrapper strictly locked to video aspect ratio */}
        <div
          className="relative max-w-full max-h-full flex items-center justify-center overflow-hidden"
          style={{
            aspectRatio: videoAspectRatio ? `${videoAspectRatio}` : undefined,
            width: videoAspectRatio ? undefined : '100%',
            height: videoAspectRatio ? undefined : '100%',
          }}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              if (v.videoWidth && v.videoHeight) {
                setVideoAspectRatio(v.videoWidth / v.videoHeight);
              }
            }}
            className="block max-w-full max-h-full object-contain"
          />

          {/* Precision Cyber Face Bounding Boxes Overlay (1:1 with Video Frame) */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Ambient subtle cyber scanlines */}
            <div
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{
                backgroundImage: 'repeating-linear-gradient(0deg, rgba(6,182,212,0.15) 0px, transparent 2px)',
                backgroundSize: '100% 4px',
              }}
            />

            {/* Scanning Laser Line */}
            {appStage !== 'locked' && (
              <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#06b6d4] animate-laser pointer-events-none opacity-75" />
            )}

            {/* Bounding box on each student's head */}
            {detectedFaces.map((face) => {
              const isTarget = face.id === highlightedFaceId;
              const isLocked = lockedFace && face.id === lockedFace.id;

              return (
                <div
                  key={face.id}
                  className="absolute transition-all duration-100"
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
                        ? 'border-3 border-amber-400 bg-amber-400/25 shadow-[0_0_25px_rgba(251,191,36,0.9)] scale-105 z-30'
                        : isTarget
                        ? 'border-2 border-yellow-300 bg-yellow-400/20 shadow-[0_0_20px_rgba(250,204,21,0.7)] scale-105 z-20'
                        : 'border-2 border-cyan-400/80 bg-cyan-400/10'
                    }`}
                  >
                    {/* Sci-fi Corner Brackets */}
                    <div
                      className={`absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 ${
                        isLocked || isTarget ? 'border-amber-300' : 'border-cyan-400'
                      }`}
                    />
                    <div
                      className={`absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 ${
                        isLocked || isTarget ? 'border-amber-300' : 'border-cyan-400'
                      }`}
                    />
                    <div
                      className={`absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 ${
                        isLocked || isTarget ? 'border-amber-300' : 'border-cyan-400'
                      }`}
                    />
                    <div
                      className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 ${
                        isLocked || isTarget ? 'border-amber-300' : 'border-cyan-400'
                      }`}
                    />

                    {/* Sequential Face Badge: MẶT #1, MẶT #2... */}
                    <div
                      className={`absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[9px] font-cyber font-bold tracking-wider whitespace-nowrap shadow-md ${
                        isLocked
                          ? 'bg-amber-400 text-slate-950 font-black animate-bounce'
                          : isTarget
                          ? 'bg-yellow-300 text-slate-950 font-black'
                          : 'bg-cyan-500 text-slate-950'
                      }`}
                    >
                      {isLocked ? '★ ĐƯỢC CHỌN' : isTarget ? 'AIM...' : `MẶT #${face.id}`}
                    </div>

                    {/* Centered Reticle */}
                    {(isTarget || isLocked) && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-5 h-5 border border-amber-300/80 rounded-full animate-ping" />
                        <div className="w-2 h-2 bg-amber-400 rounded-full shadow-[0_0_10px_#fbbf24]" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Floating Detection Status Bar */}
        <div className="absolute bottom-28 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
          <div className="bg-black/85 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-cyan-500/50 text-xs font-cyber text-cyan-300 shadow-lg">
            {detectedFaces.length > 0
              ? `AI ĐÃ PHÁT HIỆN: ${detectedFaces.length} HỌC SINH`
              : 'ĐANG QUÉT TÌM HỌC SINH...'}
          </div>

          <div className="bg-black/85 backdrop-blur-md px-3 py-1.5 rounded-full border border-emerald-500/50 text-xs font-cyber text-emerald-400 shadow-lg">
            ĐỒNG BỘ PC ✓
          </div>
        </div>
      </div>

      {/* Bottom Control Bar */}
      <div className="relative z-30 bg-gradient-to-t from-black via-black/95 to-black/60 p-4 pb-6 flex flex-col gap-2.5">
        {lockedFace && lockedFaceUrl ? (
          <div className="flex items-center justify-between gap-3 bg-slate-900 border-2 border-amber-400 p-3 rounded-2xl shadow-[0_0_20px_rgba(251,191,36,0.3)]">
            <img
              src={lockedFaceUrl}
              alt="Học sinh được chọn"
              className="w-14 h-14 rounded-xl object-cover border-2 border-amber-400"
            />
            <div className="flex-1 text-left">
              <div className="text-amber-300 font-cyber font-bold text-xs flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>ĐÃ CHỌN MẶT #{lockedFace.id}</span>
              </div>
              <div className="text-[11px] text-slate-300">
                Màn hình máy tính bàn đã hiển thị ảnh em học sinh này!
              </div>
            </div>
            <button
              onClick={() => {
                setLockedFace(null);
                setLockedFaceUrl(null);
                setAppStage('ready');
                handleStartPick();
              }}
              className="py-2.5 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-cyber font-bold text-xs rounded-xl shadow-md transition-all active:scale-95"
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
            className="w-full py-4 px-6 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-50 text-slate-950 font-black font-cyber text-base tracking-wider rounded-2xl shadow-[0_0_30px_rgba(16,185,129,0.7)] flex items-center justify-center gap-2.5 active:scale-95 transition-all"
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
