import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  Sun,
  Play,
  Wifi,
  Sparkles,
  ZoomIn,
  RotateCw,
  Maximize,
  Minimize,
  Sliders,
  ChevronDown,
  Check,
  CheckCircle2,
} from 'lucide-react';
import { DetectedFace, AppStage } from '../types';
import { detectClassroomFaces } from '../utils/faceDetector';
import { cropStudentFacePortrait } from '../utils/faceCropUtils';
import { sound } from '../utils/audio';
import {
  classifyCameraDevice,
  getSortedCameraDevices,
  CameraDeviceInfo,
  lockOrientationLandscape,
  unlockOrientation,
} from '../utils/cameraUtils';

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
  const [classifiedCameras, setClassifiedCameras] = useState<CameraDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(() => {
    return localStorage.getItem('preferred_mobile_cam_id') || '';
  });
  const [activeCameraInfo, setActiveCameraInfo] = useState<CameraDeviceInfo | null>(null);
  const [showDeviceSelector, setShowDeviceSelector] = useState<boolean>(false);

  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [torchActive, setTorchActive] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [videoAspectRatio, setVideoAspectRatio] = useState<number | null>(null);

  // Landscape & Rotation Modes
  // rotationAngle: 0, 90, 180, 270 (software rotation)
  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const [isPhysicalLandscape, setIsPhysicalLandscape] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth > window.innerHeight;
    }
    return false;
  });

  const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([]);
  const [highlightedFaceId, setHighlightedFaceId] = useState<number | null>(null);
  const [appStage, setAppStage] = useState<AppStage>('ready');
  const [lockedFace, setLockedFace] = useState<DetectedFace | null>(null);
  const [lockedFaceUrl, setLockedFaceUrl] = useState<string | null>(null);
  const [lockedOverviewUrl, setLockedOverviewUrl] = useState<string | null>(null);
  const [cameraStatusMsg, setCameraStatusMsg] = useState<string>('Đang mở Camera Sau...');
  const [isShutterFlashing, setIsShutterFlashing] = useState<boolean>(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const pickTimeoutRef = useRef<number | null>(null);
  const isSwitchingRef = useRef<boolean>(false);

  // Detect physical orientation changes
  useEffect(() => {
    const handleOrientationOrResize = () => {
      const isLandscape = window.innerWidth > window.innerHeight;
      setIsPhysicalLandscape(isLandscape);
    };

    window.addEventListener('resize', handleOrientationOrResize);
    window.addEventListener('orientationchange', handleOrientationOrResize);
    return () => {
      window.removeEventListener('resize', handleOrientationOrResize);
      window.removeEventListener('orientationchange', handleOrientationOrResize);
    };
  }, []);

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

  // Manual or auto classroom snapshot scan
  const handleTriggerSnapshot = useCallback(async () => {
    sound.playCameraShutter();
    setIsShutterFlashing(true);
    setTimeout(() => setIsShutterFlashing(false), 350);

    if (videoRef.current && videoRef.current.readyState >= 2) {
      setAppStage('detecting');
      const faces = await detectClassroomFaces(videoRef.current);
      const mapped = faces.map((f, i) => ({ ...f, id: i + 1 }));
      setDetectedFaces(mapped);
      sendRoomEvent('faces-updated', { faces: mapped });
      setAppStage('ready');
    }
  }, [sendRoomEvent]);

  // Crop face from full uncompressed feed with balanced magnification & clarity
  const cropFace = useCallback((face: DetectedFace): { faceUrl: string; overviewUrl: string | null } | null => {
    try {
      if (!videoRef.current || videoRef.current.readyState < 2) return null;
      const res = cropStudentFacePortrait(videoRef.current, face);
      if (!res) return null;
      return {
        faceUrl: res.facePhotoUrl,
        overviewUrl: res.classroomOverviewUrl,
      };
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

  // START CAMERA STREAM WITH GUARANTEED REAR CAMERA IDENTIFICATION
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
        if (targetDeviceId) {
          // Specific device requested
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: targetDeviceId },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          });
        } else if (preferFacing === 'environment') {
          // Robust rear camera request: try ideal environment
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
              },
              audio: false,
            });
          } catch {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: 'environment',
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
        console.warn('Initial getUserMedia error, fallback to video:true:', err);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        } catch (fatal) {
          console.error('Fatal camera error:', fatal);
          setCameraStatusMsg('Không thể mở camera. Vui lòng cấp quyền truy cập camera trên điện thoại.');
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
        const rawDevices = await navigator.mediaDevices.enumerateDevices();
        const sorted = getSortedCameraDevices(rawDevices);
        setClassifiedCameras(sorted);

        const activeTrack = stream.getVideoTracks()[0];
        if (activeTrack) {
          const settings = activeTrack.getSettings ? activeTrack.getSettings() : {};
          const activeTrackLabel = activeTrack.label || '';
          const currentId = settings.deviceId || '';
          setSelectedDeviceId(currentId);

          const activeInfo =
            sorted.find((c) => c.deviceId === currentId) ||
            classifyCameraDevice(
              {
                deviceId: currentId,
                label: activeTrackLabel,
                kind: 'videoinput',
                groupId: '',
                toJSON: () => ({}),
              },
              0
            );

          // CHECK: Did user want Rear camera, but the active stream is FRONT camera?
          if (preferFacing === 'environment' && activeInfo.isFront && !targetDeviceId) {
            const firstRear = sorted.find((c) => c.isRear);
            if (firstRear && firstRear.deviceId && firstRear.deviceId !== currentId) {
              console.log('Detected front camera opened instead of rear, auto-switching to rear:', firstRear);
              localStorage.setItem('preferred_mobile_cam_id', firstRear.deviceId);
              isSwitchingRef.current = false;
              startCameraStream('environment', firstRear.deviceId);
              return;
            }
          }

          setActiveCameraInfo(activeInfo);
          setCameraFacing(activeInfo.isFront ? 'user' : 'environment');

          // Store preference
          if (currentId) {
            localStorage.setItem('preferred_mobile_cam_id', currentId);
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

  // Initial connect & camera start (prefer saved rear camera or environment)
  useEffect(() => {
    sendRoomEvent('phone-connected', { time: Date.now() });

    const savedId = localStorage.getItem('preferred_mobile_cam_id');
    startCameraStream('environment', savedId || undefined);

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

    // Continuous automatic face detection every 500ms
    let isDetectingBusy = false;
    const faceInterval = setInterval(async () => {
      if (isDetectingBusy) return;
      if (videoRef.current && videoRef.current.readyState >= 2 && appStage === 'ready') {
        isDetectingBusy = true;
        try {
          const faces = await detectClassroomFaces(videoRef.current);
          setDetectedFaces(faces);
          sendRoomEvent('faces-updated', { faces });
        } catch {
          // ignore detection glitch
        } finally {
          isDetectingBusy = false;
        }
      }
    }, 500);

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

  // Toggle Camera Facing / Device
  const handleToggleFacing = () => {
    sound.playClick();
    if (classifiedCameras.length > 2) {
      // Cycle through classified cameras
      const currentIndex = classifiedCameras.findIndex((d) => d.deviceId === selectedDeviceId);
      const nextIndex = (currentIndex + 1) % classifiedCameras.length;
      const nextCam = classifiedCameras[nextIndex];
      startCameraStream(nextCam.isFront ? 'user' : 'environment', nextCam.deviceId);
    } else {
      // Flip between environment & user
      const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
      startCameraStream(nextFacing);
    }
  };

  // Select a specific camera directly
  const handleSelectCameraDevice = (cam: CameraDeviceInfo) => {
    sound.playClick();
    setShowDeviceSelector(false);
    startCameraStream(cam.isFront ? 'user' : 'environment', cam.deviceId);
  };

  // Toggle Landscape Orientation / Software Rotation
  const handleToggleLandscape = async () => {
    sound.playClick();
    if (!isPhysicalLandscape && rotationAngle === 0) {
      // Try hardware screen orientation lock first
      const locked = await lockOrientationLandscape(rootRef.current);
      if (!locked) {
        // If browser refused or unsupported (iOS Safari), toggle 90-degree software rotation!
        setRotationAngle(90);
      }
    } else if (rotationAngle === 90) {
      setRotationAngle(0);
      unlockOrientation();
    } else {
      // Cycle software rotation: 0 -> 90 -> 180 -> 270 -> 0
      setRotationAngle((prev) => (prev + 90) % 360);
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
          // ignore hardware zoom failure
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

        const cropRes = cropFace(winner);
        if (cropRes) {
          setLockedFaceUrl(cropRes.faceUrl);
          setLockedOverviewUrl(cropRes.overviewUrl);

          // Notify Desktop PC immediately with both faceUrl and overviewUrl!
          sendRoomEvent('face-locked', {
            face: winner,
            faceUrl: cropRes.faceUrl,
            overviewUrl: cropRes.overviewUrl,
          });
        }
      }
    };

    hopNext();
  };

  const isWideMode = isPhysicalLandscape || rotationAngle === 90 || rotationAngle === 270;

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-50 bg-black text-white flex flex-col justify-between overflow-hidden select-none"
    >
      {/* Top Mobile Cyber Bar: Ultra-compact, especially in landscape mode */}
      <div className={`absolute top-0 inset-x-0 z-30 bg-gradient-to-b from-black/95 via-black/80 to-transparent flex items-center justify-between backdrop-blur-md ${isWideMode ? 'p-2 pt-2' : 'p-3 pt-3.5'}`}>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Room ID Badge */}
          <div className="flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-[10px] font-cyber font-bold shadow-lg">
            <Wifi className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span>PHÒNG: {roomId}</span>
          </div>

          {/* Active Camera Selector Pill */}
          <button
            onClick={() => {
              sound.playClick();
              setShowDeviceSelector((prev) => !prev);
            }}
            className="flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-400/60 text-cyan-300 text-[10px] font-cyber font-bold transition-all shadow-lg"
            title="Bấm để chọn camera khác"
          >
            <Camera className="w-3 h-3 text-cyan-400" />
            <span className="max-w-[120px] sm:max-w-[160px] truncate">
              {activeCameraInfo?.isRear ? 'CAM SAU' : 'CAM TRƯỚC'}
            </span>
            <ChevronDown className="w-3 h-3 text-cyan-400" />
          </button>
        </div>

        {/* Right Action Icons Toolbar */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* HORIZONTAL / LANDSCAPE ROTATE BUTTON (Xoay điện thoại chiều ngang) */}
          <button
            onClick={handleToggleLandscape}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-cyber font-bold transition-all ${
              isWideMode
                ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-[0_0_15px_#fbbf24]'
                : 'bg-slate-900 hover:bg-slate-800 text-amber-300 border-amber-400/60'
            }`}
            title="Xoay điện thoại chiều ngang (Toàn cảnh lớp)"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="hidden xs:inline sm:inline">
              {rotationAngle !== 0 ? `${rotationAngle}°` : isWideMode ? 'Ngang' : 'Xoay Ngang'}
            </span>
          </button>

          {/* Zoom toggle button */}
          <button
            onClick={handleCycleZoom}
            className="flex items-center gap-1 px-2 py-1 rounded-full bg-slate-900 border border-cyan-500/40 text-cyan-300 text-xs font-cyber font-bold"
            title="Độ thu phóng"
          >
            <ZoomIn className="w-3.5 h-3.5" />
            <span>{zoomLevel}x</span>
          </button>

          {/* Flashlight/Torch toggle if supported */}
          {hasTorch && (
            <button
              onClick={handleToggleTorch}
              className={`p-1.5 rounded-full border ${
                torchActive
                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-[0_0_15px_#fbbf24]'
                  : 'bg-slate-900 text-slate-300 border-white/20'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Flip Camera Button */}
          <button
            onClick={handleToggleFacing}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400 text-cyan-300 text-xs font-cyber font-bold"
            title="Đổi camera"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Đổi Cam</span>
          </button>

          {/* Exit button */}
          <button
            onClick={onExitMobileMode}
            className="px-2 py-1 rounded-full bg-slate-800 border border-slate-600 text-xs text-slate-300 font-semibold"
          >
            Thoát
          </button>
        </div>
      </div>

      {/* DROPDOWN SELECTOR: Tap to explicitly select any rear or front camera */}
      {showDeviceSelector && (
        <div className="absolute top-14 left-3 right-3 z-40 bg-slate-900/95 border-2 border-cyan-400 rounded-2xl p-3 shadow-2xl backdrop-blur-lg animate-fadeIn max-h-[70vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-cyan-500/30">
            <span className="text-xs font-cyber text-cyan-300 font-bold">
              CHỌN CAMERA QUÉT CHO ĐIỆN THOẠI:
            </span>
            <button
              onClick={() => setShowDeviceSelector(false)}
              className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800"
            >
              Đóng
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            {classifiedCameras.map((cam, idx) => {
              const isSelected = cam.deviceId === selectedDeviceId;
              return (
                <button
                  key={cam.deviceId || idx}
                  onClick={() => handleSelectCameraDevice(cam)}
                  className={`w-full p-2.5 rounded-xl text-left text-xs font-cyber flex items-center justify-between transition-all ${
                    isSelected
                      ? 'bg-cyan-500/30 border border-cyan-400 text-white font-bold shadow-md'
                      : 'bg-slate-950/70 hover:bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Camera className={`w-4 h-4 ${cam.isRear ? 'text-emerald-400' : 'text-cyan-400'}`} />
                    <div>
                      <div className="font-bold">{cam.displayLabel}</div>
                      <div className="text-[10px] text-slate-400">
                        {cam.isUltraWide
                          ? 'Góc rộng bao quát toàn lớp'
                          : cam.isRear
                          ? 'Camera sau nét chuẩn'
                          : 'Camera trước'}
                      </div>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-emerald-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Viewfinder Stage: Full Viewport with Precision Aspect Ratio & Software Rotation */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden bg-black">
        {cameraStatusMsg && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/85 p-6 text-center">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
            <p className="text-sm font-cyber text-cyan-300">{cameraStatusMsg}</p>
          </div>
        )}

        {/* Rotatable Video Wrapper */}
        <div
          className="relative flex items-center justify-center overflow-hidden transition-transform duration-300"
          style={{
            transform: `rotate(${rotationAngle}deg)`,
            aspectRatio:
              rotationAngle === 90 || rotationAngle === 270
                ? videoAspectRatio
                  ? `${1 / videoAspectRatio}`
                  : undefined
                : videoAspectRatio
                ? `${videoAspectRatio}`
                : undefined,
            width: rotationAngle === 90 || rotationAngle === 270 ? '100vh' : '100%',
            height: rotationAngle === 90 || rotationAngle === 270 ? '100vw' : '100%',
            maxWidth: '100%',
            maxHeight: '100%',
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

          {/* Camera Shutter Flash on Snapshot */}
          {isShutterFlashing && (
            <div className="absolute inset-0 bg-white animate-shutter-flash z-50 pointer-events-none" />
          )}

          {/* Clean Face Bounding Boxes Overlay: Vivid green rounded rectangles matching reference image */}
          <div className="absolute inset-0 pointer-events-none">
            {detectedFaces.map((face) => {
              const isTarget = face.id === highlightedFaceId;
              const isLocked = lockedFace && face.id === lockedFace.id;

              return (
                <div
                  key={face.id}
                  className={`absolute rounded-xl sm:rounded-2xl transition-all ${
                    isLocked
                      ? 'border-[3.5px] border-amber-400 bg-amber-400/20 shadow-[0_0_25px_rgba(251,191,36,0.9)] scale-[1.03] z-30'
                      : isTarget
                      ? 'border-[3.5px] border-yellow-300 bg-yellow-400/20 shadow-[0_0_20px_rgba(250,204,21,0.85)] scale-[1.03] z-20'
                      : 'border-[3px] border-[#22c55e] bg-emerald-500/5 shadow-[0_0_10px_rgba(34,197,94,0.35)]'
                  }`}
                  style={{
                    left: `${face.x}%`,
                    top: `${face.y}%`,
                    width: `${face.width}%`,
                    height: `${face.height}%`,
                  }}
                >
                  {/* Clean student badge */}
                  <div
                    className={`absolute -top-4 left-1 px-1.5 py-0.2 rounded-md text-[9px] font-sans font-bold whitespace-nowrap shadow-sm ${
                      isLocked
                        ? 'bg-amber-400 text-slate-950 font-black'
                        : isTarget
                        ? 'bg-yellow-300 text-slate-950 font-black'
                        : 'bg-emerald-600/90 text-white'
                    }`}
                  >
                    {isLocked ? '★ ĐƯỢC CHỌN' : isTarget ? 'CHỌN' : `#${face.id}`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Floating Detection Status Bar */}
        <div
          className={`absolute z-20 flex items-center justify-between pointer-events-none ${
            isWideMode ? 'bottom-3 left-4 right-4' : 'bottom-24 left-4 right-4'
          }`}
        >
          <div className="bg-black/85 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-cyan-500/50 text-xs font-cyber text-cyan-300 shadow-lg">
            {detectedFaces.length > 0
              ? `AI ĐÃ PHÁT HIỆN: ${detectedFaces.length} HỌC SINH`
              : 'ĐANG QUÉT TÌM HỌC SINH...'}
          </div>

          <div className="bg-black/85 backdrop-blur-md px-3 py-1.5 rounded-full border border-emerald-500/50 text-xs font-cyber text-emerald-400 shadow-lg flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>ĐỒNG BỘ PC ✓</span>
          </div>
        </div>

        {/* Floating Shutter / Pick Button in Landscape Mode (Positioned on the Right Edge for Easy Thumb Access) */}
        {isWideMode && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-2">
            <button
              onClick={() => {
                sound.playClick();
                handleStartPick();
              }}
              disabled={detectedFaces.length === 0 || appStage === 'picking'}
              className="w-16 h-16 rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 border-4 border-white/80 shadow-[0_0_30px_rgba(16,185,129,0.8)] active:scale-90 transition-all flex flex-col items-center justify-center text-slate-950 font-black"
              title="Quay chọn học sinh"
            >
              <Play className="w-6 h-6 fill-slate-950 ml-0.5" />
              <span className="text-[9px] font-cyber font-black">QUAY</span>
            </button>
            <div className="text-[10px] font-cyber text-cyan-300 font-bold bg-black/80 px-2 py-0.5 rounded-full border border-cyan-500/40">
              {detectedFaces.length} MẶT
            </div>
          </div>
        )}
      </div>

      {/* Bottom Control Bar: Normal for Portrait, Hidden/Minimized for Wide Mode */}
      {!isWideMode && (
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
      )}
    </div>
  );
};
