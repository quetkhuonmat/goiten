/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ScannerOverlay } from './components/ScannerOverlay';
import { ControlPanel } from './components/ControlPanel';
import { LockedStudentModal } from './components/LockedStudentModal';
import { FaceHistoryDrawer } from './components/FaceHistoryDrawer';
import { PhoneGuideModal } from './components/PhoneGuideModal';
import { DetectedFace, AppStage, CalledFaceRecord } from './types';
import { detectClassroomFaces } from './utils/faceDetector';
import { sound } from './utils/audio';
import { AlertCircle, History, Smartphone, RefreshCw, Camera, Upload } from 'lucide-react';

const DEV_APP_URL = 'https://ais-dev-3becnjuf7ng6rgghq67tzs-264511727123.asia-east1.run.app';

const getActiveAppUrl = (): string => {
  if (typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin;
    if (origin && origin !== 'null' && !origin.startsWith('blob:') && origin.includes('asia-east1.run.app')) {
      return origin;
    }
  }
  return DEV_APP_URL;
};

export default function App() {
  const [appStage, setAppStage] = useState<AppStage>('ready');
  const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([]);
  const [highlightedFaceId, setHighlightedFaceId] = useState<number | null>(null);
  const [lockedFace, setLockedFace] = useState<DetectedFace | null>(null);
  const [lockedFaceUrl, setLockedFaceUrl] = useState<string | null>(null);
  const [currentScore, setCurrentScore] = useState<number>(0);

  const [scanDuration, setScanDuration] = useState<number>(3);
  const [zoom, setZoom] = useState<number>(1.0);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [customPhotoUrl, setCustomPhotoUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isPhoneGuideOpen, setIsPhoneGuideOpen] = useState<boolean>(false);
  const [excludeCalled, setExcludeCalled] = useState<boolean>(true);
  const [callHistory, setCallHistory] = useState<CalledFaceRecord[]>([]);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [torchActive, setTorchActive] = useState<boolean>(false);

  // References
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pickTimeoutRef = useRef<number | null>(null);

  // Enumerate video devices
  const updateDeviceList = useCallback(async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setAvailableDevices(videoInputs);
      }
    } catch (err) {
      console.warn('Cannot enumerate devices:', err);
    }
  }, []);

  // Setup camera stream with robust fallback
  const startCamera = useCallback(
    async (facing: 'environment' | 'user', deviceId?: string) => {
      setCameraError(null);

      // Stop existing tracks completely
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Trình duyệt không hỗ trợ truy cập Camera.');
        }

        // Build video constraints
        const videoConstraints: MediaTrackConstraints = {};

        if (deviceId) {
          videoConstraints.deviceId = { exact: deviceId };
        } else {
          videoConstraints.facingMode = { ideal: facing };
        }

        let stream: MediaStream;
        try {
          // Attempt High-Def with ideal dimensions (no strict min to prevent OverconstrainedError)
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              ...videoConstraints,
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          });
        } catch {
          // Fallback to simple video constraint
          stream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints,
            audio: false,
          });
        }

        mediaStreamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        setCameraActive(true);
        updateDeviceList();

        // Check for torch capability
        const track = stream.getVideoTracks()[0];
        if (track) {
          const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as { torch?: boolean };
          setHasTorch(Boolean(capabilities && capabilities.torch));
        }

        // Run face detection on newly started stream
        setTimeout(() => {
          runFaceDetection();
        }, 500);
      } catch (err: unknown) {
        console.warn('Camera start error:', err);
        setCameraActive(false);
        setCameraError(
          'Chưa mở được camera. Vui lòng cho phép quyền truy cập camera trên trình duyệt hoặc tải ảnh lớp học.'
        );
      }
    },
    [updateDeviceList]
  );

  // Toggle Camera Facing (Front <-> Back)
  const handleToggleCameraFacing = () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextFacing);
    setSelectedDeviceId(''); // clear exact deviceId so facingMode applies
    setCustomPhotoUrl(null); // return to live camera
    startCamera(nextFacing);
  };

  // Switch to specific camera device
  const handleSelectDeviceId = (devId: string) => {
    setSelectedDeviceId(devId);
    setCustomPhotoUrl(null);
    startCamera(cameraFacing, devId);
  };

  // Start initial camera on mount
  useEffect(() => {
    startCamera(cameraFacing);

    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Torch toggle
  const handleToggleTorch = async () => {
    if (!mediaStreamRef.current) return;
    const track = mediaStreamRef.current.getVideoTracks()[0];
    if (track && hasTorch) {
      const nextTorch = !torchActive;
      try {
        await (track as unknown as { applyConstraints: (c: unknown) => Promise<void> }).applyConstraints({
          advanced: [{ torch: nextTorch }],
        });
        setTorchActive(nextTorch);
      } catch (e) {
        console.error('Torch error', e);
      }
    }
  };

  // Crop face from live video or uploaded photo
  const cropFaceFromFeed = useCallback((face: DetectedFace): string | null => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      let sourceEl: CanvasImageSource | null = null;
      let srcW = 0;
      let srcH = 0;

      if (customPhotoUrl && imgRef.current && imgRef.current.naturalWidth) {
        sourceEl = imgRef.current;
        srcW = imgRef.current.naturalWidth;
        srcH = imgRef.current.naturalHeight;
      } else if (videoRef.current && videoRef.current.readyState >= 2) {
        sourceEl = videoRef.current;
        srcW = videoRef.current.videoWidth;
        srcH = videoRef.current.videoHeight;
      }

      if (!sourceEl || srcW === 0 || srcH === 0) return null;

      const marginX = face.width * 0.15;
      const marginY = face.height * 0.15;

      const sx = Math.max(0, ((face.x - marginX) / 100) * srcW);
      const sy = Math.max(0, ((face.y - marginY) / 100) * srcH);
      const sw = Math.min(srcW - sx, ((face.width + marginX * 2) / 100) * srcW);
      const sh = Math.min(srcH - sy, ((face.height + marginY * 2) / 100) * srcH);

      canvas.width = 480;
      canvas.height = 480;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      ctx.drawImage(sourceEl, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.95);
    } catch (e) {
      console.error('Face crop error:', e);
      return null;
    }
  }, [customPhotoUrl]);

  // RUN FACE DETECTION ON CURRENT LIVE FEED OR USER PHOTO
  const runFaceDetection = useCallback(async (silent: boolean = false) => {
    if (!silent) {
      setAppStage('detecting');
      setLockedFace(null);
      setLockedFaceUrl(null);
      setHighlightedFaceId(null);
    }

    let faces: DetectedFace[] = [];

    if (customPhotoUrl && imgRef.current && imgRef.current.naturalWidth) {
      faces = await detectClassroomFaces(imgRef.current);
    } else if (videoRef.current && videoRef.current.readyState >= 2) {
      faces = await detectClassroomFaces(videoRef.current);
    }

    const calledIds = new Set(callHistory.map((h) => h.faceId));
    const finalized = faces.map((f) => ({
      ...f,
      called: calledIds.has(f.id),
    }));

    setDetectedFaces(finalized);
    if (!silent) {
      setAppStage('ready');
      if (finalized.length > 0) {
        sound.playScanBeep(0.8);
      }
    }
  }, [customPhotoUrl, callHistory]);

  // Periodic background check as teacher points camera around classroom
  useEffect(() => {
    if (!cameraActive || appStage !== 'ready') return;
    const interval = setInterval(() => {
      runFaceDetection(true);
    }, 2800);
    return () => clearInterval(interval);
  }, [cameraActive, appStage, runFaceDetection]);

  // Allow teacher to tap on screen to add a face box manually
  const handleTapToCreateFace = (clickX: number, clickY: number) => {
    const newFace: DetectedFace = {
      id: detectedFaces.length > 0 ? Math.max(...detectedFaces.map((f) => f.id)) + 1 : 1,
      x: Math.max(2, clickX - 6),
      y: Math.max(2, clickY - 9),
      width: 12,
      height: 18,
      called: false,
    };
    setDetectedFaces((prev) => [...prev, newFace]);
    sound.playClick();
  };

  // RANDOM PICK FROM DETECTED FACES
  const handleStartPick = () => {
    if (appStage === 'picking') return;
    if (detectedFaces.length === 0) {
      sound.playClick();
      setCameraError('Chưa phát hiện khuôn mặt nào trong khung hình. Vui lòng hướng camera về phía học sinh!');
      return;
    }

    setAppStage('picking');
    setLockedFace(null);
    setLockedFaceUrl(null);
    setIsModalOpen(false);
    setCurrentScore(0);

    let eligible = excludeCalled ? detectedFaces.filter((f) => !f.called) : detectedFaces;
    if (eligible.length === 0) {
      eligible = detectedFaces;
    }

    const winner = eligible[Math.floor(Math.random() * eligible.length)];

    const durationMs = scanDuration * 1000;
    const startTime = Date.now();
    let currentInterval = 70;

    const hopNext = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / durationMs);

      const randomFace = eligible[Math.floor(Math.random() * eligible.length)];
      setHighlightedFaceId(randomFace.id);

      sound.playScanBeep(progress);
      if (Math.random() > 0.6) {
        sound.playSuspensePulse(progress);
      }

      if (elapsed < durationMs) {
        if (progress > 0.65) {
          currentInterval = Math.floor(currentInterval * 1.25);
        }
        pickTimeoutRef.current = window.setTimeout(hopNext, currentInterval);
      } else {
        // Final Lock
        setHighlightedFaceId(winner.id);
        setLockedFace(winner);
        setAppStage('locked');
        sound.playTargetLocked();

        setDetectedFaces((prev) =>
          prev.map((f) => (f.id === winner.id ? { ...f, called: true } : f))
        );

        setTimeout(() => {
          const croppedUrl = cropFaceFromFeed(winner);
          setLockedFaceUrl(croppedUrl);

          if (croppedUrl) {
            const now = new Date();
            const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
            const newRecord: CalledFaceRecord = {
              id: Date.now().toString(),
              facePhotoUrl: croppedUrl,
              time: timeStr,
              faceId: winner.id,
              score: 0,
            };
            setCallHistory((prev) => [newRecord, ...prev]);
          }

          setIsModalOpen(true);
        }, 250);
      }
    };

    hopNext();
  };

  const handleStopPick = () => {
    if (pickTimeoutRef.current) {
      clearTimeout(pickTimeoutRef.current);
      pickTimeoutRef.current = null;
    }
    setAppStage('ready');
    setHighlightedFaceId(null);
  };

  // Upload custom photo from teacher's own classroom
  const handleUploadCustomPhoto = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result === 'string') {
        setCustomPhotoUrl(e.target.result);
        sound.playFanfare();
      }
    };
    reader.readAsDataURL(file);
  };

  // Reset back to live camera
  const handleResetToLiveCamera = () => {
    setCustomPhotoUrl(null);
    startCamera(cameraFacing, selectedDeviceId);
    sound.playClick();
  };

  // Fullscreen
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (appStage === 'picking') {
          handleStopPick();
        } else {
          handleStartPick();
        }
      } else if (e.key === 'f' || e.key === 'F') {
        handleToggleFullscreen();
      } else if (e.key === 'Escape') {
        setIsModalOpen(false);
        setIsHistoryOpen(false);
        setIsPhoneGuideOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appStage]);

  const handleAddScore = () => {
    setCurrentScore((prev) => prev + 1);
    setCallHistory((prev) => {
      if (prev.length === 0) return prev;
      const [latest, ...rest] = prev;
      return [{ ...latest, score: latest.score + 1 }, ...rest];
    });
  };

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-screen w-screen bg-[#050b14] text-slate-100 overflow-hidden font-sans"
    >
      {/* Main Grid */}
      <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden">
        {/* Left/Center Stage: CAMERA FEED WITH HUD FACE SCANNER */}
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
          {/* Zoom wrapper */}
          <div
            className="relative w-full h-full flex items-center justify-center transition-transform duration-200"
            style={{ transform: `scale(${zoom})` }}
          >
            {customPhotoUrl ? (
              // Teacher's uploaded classroom photo
              <img
                ref={imgRef}
                src={customPhotoUrl}
                alt="Lớp học của bạn"
                referrerPolicy="no-referrer"
                onLoad={() => runFaceDetection()}
                className="w-full h-full object-contain"
              />
            ) : cameraActive ? (
              // Real Live camera stream
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                onLoadedMetadata={() => runFaceDetection()}
                className="w-full h-full object-contain"
              />
            ) : (
              // Clean empty state when camera not yet allowed
              <div className="flex flex-col items-center justify-center text-center p-6 max-w-sm">
                <div className="w-16 h-16 rounded-2xl bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-cyan-400 mb-4 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                  <Camera className="w-8 h-8" />
                </div>
                <h3 className="font-cyber font-bold text-white text-base mb-1">
                  CAMERA ĐANG CHỜ BẬT
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Bấm nút bên dưới để cấp quyền mở Camera trực tiếp hoặc tải ảnh lớp học.
                </p>
                <div className="flex flex-col sm:flex-row gap-2 w-full">
                  <button
                    onClick={() => startCamera(cameraFacing)}
                    className="flex-1 py-2 px-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-cyber font-bold text-xs rounded-xl shadow-lg transition-all"
                  >
                    Bật Camera
                  </button>
                  <label className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl cursor-pointer text-center transition-all flex items-center justify-center gap-1">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Tải ảnh lớp</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadCustomPhoto(file);
                      }}
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* HUD Cyber Scanner Overlay */}
          <ScannerOverlay
            appStage={appStage}
            detectedFaces={detectedFaces}
            highlightedFaceId={highlightedFaceId}
            lockedFace={lockedFace}
            onTapToCreateFace={handleTapToCreateFace}
          />

          {/* Floating Flip Camera button directly on video screen */}
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
            <button
              onClick={handleToggleCameraFacing}
              title="Đổi Camera Trước / Sau"
              className="flex items-center gap-1.5 bg-slate-950/80 hover:bg-slate-900 border border-cyan-500/40 text-cyan-300 hover:text-white px-3 py-1.5 rounded-full text-xs font-cyber backdrop-blur-md transition-all shadow-lg"
            >
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
              <span>Đổi Camera ({cameraFacing === 'environment' ? 'Sau' : 'Trước'})</span>
            </button>
          </div>

          {/* History trigger button floating in top right */}
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="flex items-center gap-1.5 bg-slate-950/80 hover:bg-slate-900 border border-cyan-500/30 text-cyan-300 hover:text-white px-3 py-1.5 rounded-full text-xs font-cyber backdrop-blur-md transition-all shadow-lg"
            >
              <History className="w-3.5 h-3.5" />
              <span>Đã gọi ({callHistory.length})</span>
            </button>
          </div>

          {/* Camera status badge bottom left */}
          <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 pointer-events-none">
            <div className="flex items-center gap-1.5 bg-slate-950/80 border border-cyan-500/30 px-3 py-1.5 rounded-full text-[11px] font-cyber text-cyan-400 backdrop-blur-md">
              <span className={`w-2 h-2 rounded-full ${cameraActive || customPhotoUrl ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span>
                {customPhotoUrl
                  ? 'ẢNH LỚP HỌC TẢI LÊN'
                  : cameraFacing === 'environment'
                  ? 'CAMERA SAU (LIVE)'
                  : 'CAMERA TRƯỚC (LIVE)'}
              </span>
            </div>
          </div>
        </div>

        {/* Right / Bottom: CONTROL PANEL */}
        <div className="w-full lg:w-96 shrink-0 h-auto lg:h-full max-h-[48vh] lg:max-h-full">
          <ControlPanel
            appStage={appStage}
            onDetectFaces={runFaceDetection}
            onStartPick={handleStartPick}
            onStopPick={handleStopPick}
            detectedFaces={detectedFaces}
            scanDuration={scanDuration}
            onDurationChange={setScanDuration}
            zoom={zoom}
            onZoomChange={setZoom}
            cameraFacing={cameraFacing}
            onToggleCameraFacing={handleToggleCameraFacing}
            availableDevices={availableDevices}
            selectedDeviceId={selectedDeviceId}
            onSelectDeviceId={handleSelectDeviceId}
            isMuted={isMuted}
            onToggleMute={() => {
              const nextMuted = !isMuted;
              setIsMuted(nextMuted);
              sound.setMuted(nextMuted);
            }}
            isFullscreen={isFullscreen}
            onToggleFullscreen={handleToggleFullscreen}
            callHistory={callHistory}
            onOpenHistory={() => setIsHistoryOpen(true)}
            onOpenPhoneGuide={() => setIsPhoneGuideOpen(true)}
            onUploadCustomPhoto={handleUploadCustomPhoto}
            onResetToLiveCamera={handleResetToLiveCamera}
            hasCustomPhoto={Boolean(customPhotoUrl)}
            excludeCalled={excludeCalled}
            onToggleExcludeCalled={setExcludeCalled}
            hasTorch={hasTorch}
            torchActive={torchActive}
            onToggleTorch={handleToggleTorch}
          />
        </div>
      </div>

      {/* Face History Drawer */}
      <FaceHistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={callHistory}
        onResetHistory={() => {
          setCallHistory([]);
          setDetectedFaces((prev) => prev.map((f) => ({ ...f, called: false })));
        }}
      />

      {/* Phone Guide & 403 Explanation Modal */}
      <PhoneGuideModal
        isOpen={isPhoneGuideOpen}
        onClose={() => setIsPhoneGuideOpen(false)}
        appUrl={getActiveAppUrl()}
      />

      {/* Celebration Target Locked Modal (ONLY STUDENT FACE PHOTO - NO NAME) */}
      <LockedStudentModal
        isOpen={isModalOpen}
        facePhotoUrl={lockedFaceUrl}
        targetBox={lockedFace}
        score={currentScore}
        onClose={() => setIsModalOpen(false)}
        onScanAgain={() => {
          setIsModalOpen(false);
          handleStartPick();
        }}
        onAddScore={handleAddScore}
      />
    </div>
  );
}
