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
import { ClassAlbumModal } from './components/ClassAlbumModal';
import { ClassAlbumStage } from './components/ClassAlbumStage';
import { RemoteCameraModal } from './components/RemoteCameraModal';
import { MobileScannerView } from './components/MobileScannerView';
import {
  DetectedFace,
  AppStage,
  CalledFaceRecord,
  StudentPhotoItem,
  MainViewMode,
} from './types';
import { detectClassroomFaces } from './utils/faceDetector';
import { cropStudentFacePortrait } from './utils/faceCropUtils';
import { sound } from './utils/audio';
import {
  History,
  RefreshCw,
  Camera,
  Wifi,
  Users,
  Smartphone,
} from 'lucide-react';
import {
  classifyCameraDevice,
  getSortedCameraDevices,
  CameraDeviceInfo,
} from './utils/cameraUtils';

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

const isMobileDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return Boolean(
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    ((navigator.maxTouchPoints ?? 0) > 1 && window.innerWidth < 1024)
  );
};

export default function App() {
  // Check if opened as Mobile Camera Scanner from QR code
  const [isMobileScannerMode, setIsMobileScannerMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'phone-cam' && Boolean(params.get('room'));
  });

  const [activeRoomId] = useState<string>(() => {
    if (typeof window === 'undefined') return 'CLASS1';
    const params = new URLSearchParams(window.location.search);
    return (params.get('room') || Math.random().toString(36).substring(2, 6)).toUpperCase();
  });

  // App Modes: 'camera' | 'album' | 'remote-camera'
  const [mainViewMode, setMainViewMode] = useState<MainViewMode>('camera');

  // Stages & Face Detection
  const [appStage, setAppStage] = useState<AppStage>('ready');
  const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([]);
  const [highlightedFaceId, setHighlightedFaceId] = useState<number | null>(null);
  const [lockedFace, setLockedFace] = useState<DetectedFace | null>(null);
  const [lockedFaceUrl, setLockedFaceUrl] = useState<string | null>(null);
  const [lockedOverviewUrl, setLockedOverviewUrl] = useState<string | null>(null);
  const [lockedStudentName, setLockedStudentName] = useState<string | undefined>(undefined);
  const [currentScore, setCurrentScore] = useState<number>(0);

  // Bulk Student Album State (saved in localStorage)
  const [students, setStudents] = useState<StudentPhotoItem[]>(() => {
    try {
      const saved = localStorage.getItem('class_students_album_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [highlightedStudentId, setHighlightedStudentId] = useState<string | null>(null);

  // Remote Phone Camera Sync State
  const [isPhoneConnected, setIsPhoneConnected] = useState<boolean>(false);
  const [remoteFrame, setRemoteFrame] = useState<string | null>(null);

  // Camera Settings
  const [scanDuration, setScanDuration] = useState<number>(3);
  const [zoom, setZoom] = useState<number>(1.0);
  const [isHardwareZoom, setIsHardwareZoom] = useState<boolean>(false);
  const [mediaAspectRatio, setMediaAspectRatio] = useState<number | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>(() => {
    return isMobileDevice() ? 'environment' : 'user';
  });
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [classifiedDevices, setClassifiedDevices] = useState<CameraDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(() => {
    return localStorage.getItem('preferred_main_cam_id') || '';
  });
  const [cameraError, setCameraError] = useState<string | null>(null);
  const consecutiveEmptyRef = useRef<number>(0);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [excludeCalled, setExcludeCalled] = useState<boolean>(true);
  const [callHistory, setCallHistory] = useState<CalledFaceRecord[]>([]);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [torchActive, setTorchActive] = useState<boolean>(false);
  const [isShutterFlashing, setIsShutterFlashing] = useState<boolean>(false);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isPhoneGuideOpen, setIsPhoneGuideOpen] = useState<boolean>(false);
  const [isClassAlbumOpen, setIsClassAlbumOpen] = useState<boolean>(false);
  const [isRemoteModalOpen, setIsRemoteModalOpen] = useState<boolean>(false);

  // References
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pickTimeoutRef = useRef<number | null>(null);

  // Save student album to localStorage
  const handleSetStudents = (newStudents: StudentPhotoItem[]) => {
    setStudents(newStudents);
    try {
      localStorage.setItem('class_students_album_v1', JSON.stringify(newStudents));
    } catch (e) {
      console.warn('Cannot persist students to localStorage', e);
    }
  };

  // If mobile scanner mode, return specialized full-viewport scanner component
  if (isMobileScannerMode) {
    return (
      <MobileScannerView
        roomId={activeRoomId}
        onExitMobileMode={() => {
          setIsMobileScannerMode(false);
          if (typeof window !== 'undefined') {
            window.history.replaceState({}, '', window.location.pathname);
          }
        }}
      />
    );
  }

  // Enumerate video devices and classify them
  const updateDeviceList = useCallback(async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const rawDevices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = rawDevices.filter((d) => d.kind === 'videoinput');
        setAvailableDevices(videoInputs);
        const sorted = getSortedCameraDevices(rawDevices);
        setClassifiedDevices(sorted);
        return sorted;
      }
    } catch (err) {
      console.warn('Cannot enumerate devices:', err);
    }
    return [];
  }, []);

  // Hardware digital zoom controller
  const handleZoomChange = useCallback(
    async (newZoom: number) => {
      setZoom(newZoom);
      if (!mediaStreamRef.current) return;

      const track = mediaStreamRef.current.getVideoTracks()[0];
      if (!track) return;

      try {
        const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as {
          zoom?: { min: number; max: number; step: number };
        };

        if (capabilities && capabilities.zoom) {
          const minZ = capabilities.zoom.min || 1;
          const maxZ = capabilities.zoom.max || 5;
          const clamped = Math.max(minZ, Math.min(maxZ, newZoom));
          await (track as unknown as { applyConstraints: (c: unknown) => Promise<void> }).applyConstraints({
            advanced: [{ zoom: clamped }],
          });
          setIsHardwareZoom(true);
          return;
        }
      } catch (err) {
        console.warn('Hardware zoom not applicable:', err);
      }
      setIsHardwareZoom(false);
    },
    []
  );

  // Setup camera stream with prioritized rear camera on mobile
  const startCamera = useCallback(
    async (facing?: 'environment' | 'user', specificDeviceId?: string) => {
      setCameraError(null);

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      const isMobile = isMobileDevice();
      const targetFacing = facing || (isMobile ? 'environment' : 'user');
      setCameraFacing(targetFacing);

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Trình duyệt không hỗ trợ truy cập Camera.');
        }

        let deviceToUse = specificDeviceId;
        if (!deviceToUse) {
          const savedId = localStorage.getItem('preferred_main_cam_id');
          if (savedId) deviceToUse = savedId;
        }

        let stream: MediaStream | null = null;

        if (deviceToUse) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: { exact: deviceToUse },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
              audio: false,
            });
          } catch {
            deviceToUse = undefined;
            localStorage.removeItem('preferred_main_cam_id');
          }
        }

        if (!stream) {
          try {
            // First attempt: with facingMode and 720p ideal
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: { ideal: targetFacing },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
              audio: false,
            });
          } catch {
            try {
              // Second attempt: simple facingMode
              stream = await navigator.mediaDevices.getUserMedia({
                video: {
                  facingMode: targetFacing,
                },
                audio: false,
              });
            } catch {
              // Universal fallback: any video camera available (crucial for laptops/Vercel)
              stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false,
              });
            }
          }
        }

        mediaStreamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(() => {});
            if (videoRef.current?.videoWidth && videoRef.current?.videoHeight) {
              setMediaAspectRatio(videoRef.current.videoWidth / videoRef.current.videoHeight);
            }
            runFaceDetection();
          };
          await videoRef.current.play().catch(() => {});
        }

        setCameraActive(true);
        setCameraError(null);

        const sortedDevices = await updateDeviceList();
        const activeTrack = stream.getVideoTracks()[0];

        if (activeTrack) {
          const settings = (activeTrack.getSettings ? activeTrack.getSettings() : {}) as MediaTrackSettings;
          const trackLabel = activeTrack.label || '';
          const currentId = settings.deviceId || '';

          const activeInfo =
            sortedDevices.find((c) => c.deviceId === currentId) ||
            classifyCameraDevice(
              {
                deviceId: currentId,
                label: trackLabel,
                kind: 'videoinput',
                groupId: '',
                toJSON: () => ({}),
              },
              0
            );

          // AUTO-SWITCH TO REAR CAMERA ONLY IF RUNNING ON A MOBILE DEVICE
          if (isMobile && targetFacing === 'environment' && activeInfo.isFront && !specificDeviceId) {
            const firstRear = sortedDevices.find((d) => d.isRear);
            if (firstRear && firstRear.deviceId && firstRear.deviceId !== currentId) {
              console.log('Detected front camera opened on mobile, auto-switching to rear camera:', firstRear);
              localStorage.setItem('preferred_main_cam_id', firstRear.deviceId);
              startCamera('environment', firstRear.deviceId);
              return;
            }
          }

          if (currentId) {
            setSelectedDeviceId(currentId);
            localStorage.setItem('preferred_main_cam_id', currentId);
          }

          const capabilities = (activeTrack.getCapabilities ? activeTrack.getCapabilities() : {}) as {
            torch?: boolean;
            zoom?: { min: number; max: number; step: number };
          };

          setHasTorch(Boolean(capabilities && capabilities.torch));
          if (capabilities && capabilities.zoom) {
            setIsHardwareZoom(true);
            if (zoom > 1.0) {
              const clamped = Math.max(capabilities.zoom.min || 1, Math.min(capabilities.zoom.max || 5, zoom));
              await (activeTrack as unknown as { applyConstraints: (c: unknown) => Promise<void> }).applyConstraints({
                advanced: [{ zoom: clamped }],
              });
            }
          } else {
            setIsHardwareZoom(false);
          }
        }

        setTimeout(() => {
          runFaceDetection();
        }, 300);
      } catch (err: unknown) {
        console.warn('Camera start fallback:', err);
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          mediaStreamRef.current = fallbackStream;
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play().catch(() => {});
              runFaceDetection();
            };
            await videoRef.current.play().catch(() => {});
          }
          setCameraActive(true);
          setCameraError(null);
          updateDeviceList();
          setTimeout(() => runFaceDetection(), 300);
        } catch (finalErr: unknown) {
          setCameraActive(false);
          const errMsg = finalErr instanceof Error ? finalErr.message : '';
          setCameraError(
            errMsg.includes('Permission') || errMsg.includes('NotAllowedError')
              ? 'Trình duyệt chưa được cấp quyền Camera. Thầy/Cô hãy bấm "Bật Camera" bên dưới và chọn "Cho phép (Allow)".'
              : 'Chưa thể kết nối camera máy tính. Thầy/Cô vui lòng bấm nút "Bật Camera" bên dưới để cấp quyền!'
          );
        }
      }
    },
    [updateDeviceList, zoom]
  );

  // Toggle Camera Facing
  const handleToggleCameraFacing = () => {
    sound.playClick();
    if (classifiedDevices.length > 2) {
      const currentIndex = classifiedDevices.findIndex((d) => d.deviceId === selectedDeviceId);
      const nextIndex = (currentIndex + 1) % classifiedDevices.length;
      const nextDev = classifiedDevices[nextIndex];
      setSelectedDeviceId(nextDev.deviceId);
      startCamera(nextDev.isFront ? 'user' : 'environment', nextDev.deviceId);
    } else {
      const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
      setCameraFacing(nextFacing);
      setSelectedDeviceId('');
      startCamera(nextFacing);
    }
  };

  const handleSelectDeviceId = (devId: string) => {
    setSelectedDeviceId(devId);
    const chosen = classifiedDevices.find((d) => d.deviceId === devId);
    startCamera(chosen?.isFront ? 'user' : 'environment', devId);
  };

  useEffect(() => {
    const isMobile = isMobileDevice();
    const initialFacing = isMobile ? 'environment' : 'user';
    const savedId = localStorage.getItem('preferred_main_cam_id');
    startCamera(initialFacing, savedId || undefined);

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

  // High-resolution portrait crop and classroom overview locator
  const cropFaceFromFeed = useCallback(
    (face: DetectedFace): { faceUrl: string; overviewUrl: string | null } | null => {
      try {
        let sourceEl: HTMLVideoElement | HTMLImageElement | null = null;

        if (videoRef.current && videoRef.current.readyState >= 2) {
          sourceEl = videoRef.current;
        }

        if (!sourceEl) return null;

        const res = cropStudentFacePortrait(sourceEl, face);
        if (!res) return null;

        return {
          faceUrl: res.facePhotoUrl,
          overviewUrl: res.classroomOverviewUrl,
        };
      } catch (e) {
        console.error('Face crop error:', e);
        return null;
      }
    },
    []
  );

  // RUN FACE DETECTION ON CURRENT LIVE FEED OR CUSTOM PHOTO
  const runFaceDetection = useCallback(async (silent: boolean = false) => {
    if (!silent) {
      setAppStage('detecting');
      setLockedFace(null);
      setLockedFaceUrl(null);
      setHighlightedFaceId(null);
      setIsShutterFlashing(true);
      sound.playCameraShutter();
      setTimeout(() => setIsShutterFlashing(false), 350);
    }

    let faces: DetectedFace[] = [];

    if (videoRef.current && videoRef.current.readyState >= 2) {
      faces = await detectClassroomFaces(videoRef.current);
    }

    const calledIds = new Set(callHistory.map((h) => h.faceId));
    const finalized = faces.map((f) => ({
      ...f,
      called: calledIds.has(f.id),
    }));

    setDetectedFaces((prev) => {
      if (finalized.length === 0) {
        if (silent) {
          consecutiveEmptyRef.current++;
          if (consecutiveEmptyRef.current < 3 && prev.length > 0) {
            return prev;
          }
        }
        return [];
      }
      consecutiveEmptyRef.current = 0;

      return finalized.map((face, idx) => {
        const prevMatch = prev.find(
          (p) => Math.hypot(p.x - face.x, p.y - face.y) < 8
        );
        if (prevMatch) {
          return {
            ...face,
            id: idx + 1,
            x: prevMatch.x * 0.6 + face.x * 0.4,
            y: prevMatch.y * 0.6 + face.y * 0.4,
            width: prevMatch.width * 0.6 + face.width * 0.4,
            height: prevMatch.height * 0.6 + face.height * 0.4,
          };
        }
        return {
          ...face,
          id: idx + 1,
        };
      });
    });

    if (!silent) {
      setAppStage('ready');
      if (finalized.length > 0) {
        sound.playScanBeep(0.8);
      }
    }
  }, [callHistory]);

  // Continuous real-time automatic face detection (runs automatically every 200ms)
  useEffect(() => {
    if (!cameraActive || appStage !== 'ready' || mainViewMode !== 'camera') return;
    let isDetectingBusy = false;
    const interval = setInterval(async () => {
      if (isDetectingBusy || appStage !== 'ready') return;
      isDetectingBusy = true;
      try {
        await runFaceDetection(true);
      } finally {
        isDetectingBusy = false;
      }
    }, 200);
    return () => clearInterval(interval);
  }, [cameraActive, appStage, mainViewMode, runFaceDetection]);

  // REAL-TIME SERVER ROOM SYNC (CONNECT PHONE TO DESKTOP PC)
  useEffect(() => {
    if (!activeRoomId) return;

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`/api/room/${activeRoomId}/events`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'phone-connected') {
            setIsPhoneConnected(true);
            sound.playFanfare();
          } else if (data.type === 'frame-update' && data.payload?.frame) {
            setRemoteFrame(data.payload.frame);
            setIsPhoneConnected(true);
            if (mainViewMode === 'remote-camera' && appStage === 'ready') {
              const img = new Image();
              img.src = data.payload.frame;
              img.onload = async () => {
                const faces = await detectClassroomFaces(img);
                if (faces.length > 0) {
                  setDetectedFaces(faces);
                }
              };
            }
          } else if (data.type === 'faces-updated' && data.payload?.faces) {
            if (mainViewMode === 'remote-camera' && data.payload.faces.length > 0) {
              setDetectedFaces(data.payload.faces);
            }
          } else if (data.type === 'stage-change' && data.payload?.stage === 'picking') {
            handleStartPick();
          } else if (data.type === 'face-locked') {
            const { face, faceUrl, overviewUrl } = data.payload;
            setLockedFace(face);
            setLockedFaceUrl(faceUrl);
            setLockedOverviewUrl(overviewUrl || null);
            setLockedStudentName(undefined);
            setAppStage('locked');
            setIsModalOpen(true);
            sound.playTargetLocked();
          }
        } catch {
          // ignore parsing error
        }
      };
    } catch (err) {
      console.warn('SSE connection:', err);
    }

    // Polling fallback every 1200ms
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/room/${activeRoomId}/state`);
        if (res.ok) {
          const state = await res.json();
          if (state.phoneConnected) setIsPhoneConnected(true);
          if (state.latestFrame && mainViewMode === 'remote-camera') {
            setRemoteFrame(state.latestFrame);
          }
          if (state.detectedFaces && mainViewMode === 'remote-camera') {
            setDetectedFaces(state.detectedFaces);
          }
        }
      } catch {
        // quiet
      }
    }, 1200);

    return () => {
      eventSource?.close();
      clearInterval(pollInterval);
    };
  }, [activeRoomId, mainViewMode]);

  // Allow teacher to tap on screen to add a face box manually
  const handleTapToCreateFace = (clickX: number, clickY: number) => {
    const newFace: DetectedFace = {
      id: detectedFaces.length > 0 ? Math.max(...detectedFaces.map((f) => f.id)) + 1 : 1,
      x: Math.max(1, clickX - 7),
      y: Math.max(1, clickY - 10),
      width: 14,
      height: 20,
      called: false,
    };
    setDetectedFaces((prev) => [...prev, newFace]);
    sound.playClick();
  };

  // RANDOM PICK: SUPPORTS BOTH CAMERA FACES AND CLASS ALBUM ROSTER!
  const handleStartPick = () => {
    if (appStage === 'picking') return;

    // A) PICK FROM CLASS ALBUM ROSTER
    if (mainViewMode === 'album') {
      if (students.length === 0) {
        setIsClassAlbumOpen(true);
        return;
      }

      setAppStage('picking');
      setLockedFace(null);
      setLockedFaceUrl(null);
      setLockedStudentName(undefined);
      setIsModalOpen(false);
      setCurrentScore(0);

      let eligible = excludeCalled ? students.filter((s) => !s.called) : students;
      if (eligible.length === 0) {
        eligible = students;
      }

      const winner = eligible[Math.floor(Math.random() * eligible.length)];
      const durationMs = scanDuration * 1000;
      const startTime = Date.now();
      let currentInterval = 75;

      const hopNextAlbum = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / durationMs);

        const randomStudent = eligible[Math.floor(Math.random() * eligible.length)];
        setHighlightedStudentId(randomStudent.id);

        sound.playScanBeep(progress);
        if (Math.random() > 0.6) {
          sound.playSuspensePulse(progress);
        }

        if (elapsed < durationMs) {
          if (progress > 0.65) {
            currentInterval = Math.floor(currentInterval * 1.25);
          }
          pickTimeoutRef.current = window.setTimeout(hopNextAlbum, currentInterval);
        } else {
          // Final Lock for Album Student
          setHighlightedStudentId(winner.id);
          setLockedStudentName(winner.name);
          setLockedFaceUrl(winner.photoUrl);
          setAppStage('locked');
          sound.playTargetLocked();

          // Mark as called
          setStudents((prev) =>
            prev.map((s) => (s.id === winner.id ? { ...s, called: true } : s))
          );

          const now = new Date();
          const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
          const newRecord: CalledFaceRecord = {
            id: Date.now().toString(),
            facePhotoUrl: winner.photoUrl,
            studentName: winner.name,
            time: timeStr,
            faceId: 1,
            score: 0,
          };
          setCallHistory((prev) => [newRecord, ...prev]);

          setTimeout(() => {
            setIsModalOpen(true);
          }, 250);
        }
      };

      hopNextAlbum();
      return;
    }

    // B) PICK FROM CAMERA FACES (Live or Remote)
    if (detectedFaces.length === 0) {
      sound.playScanBeep(0.5);
      runFaceDetection(false);
      return;
    }

    setAppStage('picking');
    setLockedFace(null);
    setLockedFaceUrl(null);
    setLockedOverviewUrl(null);
    setLockedStudentName(undefined);
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
          const cropped = cropFaceFromFeed(winner);
          if (cropped) {
            setLockedFaceUrl(cropped.faceUrl);
            setLockedOverviewUrl(cropped.overviewUrl);

            const now = new Date();
            const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
            const newRecord: CalledFaceRecord = {
              id: Date.now().toString(),
              facePhotoUrl: cropped.faceUrl,
              time: timeStr,
              faceId: winner.id,
              score: 0,
            };
            setCallHistory((prev) => [newRecord, ...prev]);
          } else {
            setLockedFaceUrl(null);
            setLockedOverviewUrl(null);
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
    setHighlightedStudentId(null);
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
        setIsClassAlbumOpen(false);
        setIsRemoteModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appStage, mainViewMode, students, detectedFaces]);

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
        {/* Left/Center Stage: CAMERA FEED OR ALBUM STAGE */}
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden p-0 sm:p-2">
          {mainViewMode === 'album' ? (
            // 1. CLASS ALBUM STAGE (ROSTER GRID & ROULETTE)
            <ClassAlbumStage
              students={students}
              highlightedStudentId={highlightedStudentId}
              appStage={appStage}
              onOpenAlbumModal={() => setIsClassAlbumOpen(true)}
            />
          ) : mainViewMode === 'remote-camera' ? (
            // 2. REMOTE PHONE CAMERA STAGE
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black">
              {remoteFrame ? (
                <div className="relative max-w-full max-h-full">
                  <img
                    src={remoteFrame}
                    alt="Khung hình camera điện thoại"
                    className="max-w-full max-h-full object-contain block select-none"
                  />
                  <ScannerOverlay
                    appStage={appStage}
                    detectedFaces={detectedFaces}
                    highlightedFaceId={highlightedFaceId}
                    lockedFace={lockedFace}
                    onTapToCreateFace={handleTapToCreateFace}
                    isShutterFlashing={isShutterFlashing}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-6 max-w-md">
                  <div className="w-16 h-16 rounded-2xl bg-cyan-950/80 border border-cyan-400/50 flex items-center justify-center text-cyan-400 mb-4 animate-pulse">
                    <Wifi className="w-8 h-8 text-cyan-400" />
                  </div>
                  <h3 className="font-cyber font-bold text-white text-base mb-1">
                    CHẾ ĐỘ CAMERA ĐIỆN THOẠI (PHÒNG: {activeRoomId})
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">
                    {isPhoneConnected
                      ? 'Điện thoại đã kết nối! Đang nhận tín hiệu hình ảnh trực tiếp...'
                      : 'Đang chờ điện thoại kết nối. Thầy/Cô bấm nút bên dưới để mở mã QR và quét bằng điện thoại.'}
                  </p>
                  <button
                    onClick={() => setIsRemoteModalOpen(true)}
                    className="py-2.5 px-5 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 text-slate-950 font-cyber font-bold text-xs rounded-xl shadow-lg transition-all"
                  >
                    Xem mã QR kết nối điện thoại
                  </button>
                </div>
              )}

              {/* Floating Badge for Remote Mode */}
              <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-slate-950/80 border border-emerald-500/50 text-emerald-300 px-3 py-1.5 rounded-full text-xs font-cyber backdrop-blur-md shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>CAMERA ĐIỆN THOẠI KHÔNG DÂY (PHÒNG {activeRoomId})</span>
                </div>
              </div>
            </div>
          ) : (
            // 3. LOCAL CAMERA STAGE
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black">
              {cameraActive ? (
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  onLoadedMetadata={(e) => {
                    const v = e.currentTarget;
                    if (v.videoWidth && v.videoHeight) {
                      setMediaAspectRatio(v.videoWidth / v.videoHeight);
                    }
                    runFaceDetection();
                  }}
                  className="max-w-full max-h-full object-contain block select-none"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-6 max-w-sm">
                  <div className="w-16 h-16 rounded-2xl bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-cyan-400 mb-4 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                    <Camera className="w-8 h-8 animate-pulse" />
                  </div>
                  <h3 className="font-cyber font-bold text-white text-base mb-1">
                    SẴN SÀNG QUÉT CAMERA
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Bấm <strong>"Bật Camera"</strong> và chọn <strong>"Cho phép (Allow)"</strong> khi trình duyệt hỏi để bắt đầu quét lớp học!
                  </p>

                  {cameraError && (
                    <div className="w-full mb-4 p-2.5 bg-rose-950/70 border border-rose-500/40 text-rose-300 text-xs rounded-xl">
                      {cameraError}
                    </div>
                  )}

                  <div className="flex flex-col gap-2.5 w-full">
                    <button
                      onClick={() => {
                        sound.playClick();
                        startCamera(isMobileDevice() ? 'environment' : 'user');
                      }}
                      className="py-3 px-4 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-cyber font-bold text-xs uppercase tracking-wider rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>BẬT CAMERA NGAY</span>
                    </button>

                    <div className="flex items-center gap-2 my-1">
                      <div className="flex-1 h-px bg-slate-800" />
                      <span className="text-[10px] text-slate-500 font-cyber uppercase">hoặc tùy chọn</span>
                      <div className="flex-1 h-px bg-slate-800" />
                    </div>

                    <button
                      onClick={() => setIsRemoteModalOpen(true)}
                      className="py-2.5 px-3 bg-slate-800/80 hover:bg-slate-700/80 border border-emerald-500/30 text-emerald-300 font-cyber font-semibold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Smartphone className="w-4 h-4 text-emerald-400" />
                      <span>Dùng điện thoại làm camera (QR)</span>
                    </button>
                    <button
                      onClick={() => setIsClassAlbumOpen(true)}
                      className="py-2.5 px-3 bg-slate-800/80 hover:bg-slate-700/80 border border-cyan-500/30 text-cyan-300 font-cyber font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Users className="w-4 h-4 text-cyan-400" />
                      <span>Album học sinh cả lớp</span>
                    </button>
                  </div>
                </div>
              )}

              {/* HUD Cyber Scanner Overlay */}
              {cameraActive && (
                <ScannerOverlay
                  appStage={appStage}
                  detectedFaces={detectedFaces}
                  highlightedFaceId={highlightedFaceId}
                  lockedFace={lockedFace}
                  onTapToCreateFace={handleTapToCreateFace}
                  isShutterFlashing={isShutterFlashing}
                />
              )}
            </div>
          )}

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
        </div>

        {/* Right / Bottom: CONTROL PANEL */}
        <div className="w-full lg:w-96 shrink-0 h-auto lg:h-full max-h-[48vh] lg:max-h-full">
          <ControlPanel
            appStage={appStage}
            onStartPick={handleStartPick}
            onStopPick={handleStopPick}
            detectedFaces={detectedFaces}
            scanDuration={scanDuration}
            onDurationChange={setScanDuration}
            zoom={zoom}
            onZoomChange={handleZoomChange}
            cameraFacing={cameraFacing}
            onToggleCameraFacing={handleToggleCameraFacing}
            availableDevices={availableDevices}
            classifiedDevices={classifiedDevices}
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
            excludeCalled={excludeCalled}
            onToggleExcludeCalled={setExcludeCalled}
            hasTorch={hasTorch}
            torchActive={torchActive}
            onToggleTorch={handleToggleTorch}
            onOpenRemoteConnect={() => setIsRemoteModalOpen(true)}
            isPhoneConnected={isPhoneConnected}
            studentsCount={students.length}
            onOpenClassAlbum={() => setIsClassAlbumOpen(true)}
          />
        </div>
      </div>

      {/* Class Album Modal (Bulk Multiple Files Upload) */}
      <ClassAlbumModal
        isOpen={isClassAlbumOpen}
        onClose={() => setIsClassAlbumOpen(false)}
        students={students}
        onSetStudents={handleSetStudents}
        onSelectAlbumMode={() => setMainViewMode('album')}
        isAlbumModeActive={mainViewMode === 'album'}
      />

      {/* Remote Mobile Camera Bridge Modal (For Desktop PC without Webcam) */}
      <RemoteCameraModal
        isOpen={isRemoteModalOpen}
        onClose={() => setIsRemoteModalOpen(false)}
        roomCode={activeRoomId}
        isPhoneConnected={isPhoneConnected}
        onSwitchToRemoteMode={() => setMainViewMode('remote-camera')}
        isRemoteActive={mainViewMode === 'remote-camera'}
      />

      {/* Face History Drawer */}
      <FaceHistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={callHistory}
        onResetHistory={() => {
          setCallHistory([]);
          setDetectedFaces((prev) => prev.map((f) => ({ ...f, called: false })));
          setStudents((prev) => prev.map((s) => ({ ...s, called: false })));
        }}
      />

      {/* Phone Guide & 403 Explanation Modal */}
      <PhoneGuideModal
        isOpen={isPhoneGuideOpen}
        onClose={() => setIsPhoneGuideOpen(false)}
        appUrl={getActiveAppUrl()}
      />

      {/* Celebration Target Locked Modal */}
      <LockedStudentModal
        isOpen={isModalOpen}
        facePhotoUrl={lockedFaceUrl}
        overviewPhotoUrl={lockedOverviewUrl}
        targetBox={lockedFace}
        studentName={lockedStudentName}
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
