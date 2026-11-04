import React from 'react';
import {
  Play,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Camera,
  ZoomIn,
  Sparkles,
  Sun,
  Image as ImageIcon,
  History,
  ScanFace,
  Smartphone,
  RotateCcw,
  RotateCw,
  RefreshCw,
  Trash2,
  Users,
  Wifi,
} from 'lucide-react';
import { AppStage, CalledFaceRecord, DetectedFace, MainViewMode } from '../types';
import { CameraDeviceInfo } from '../utils/cameraUtils';
import { sound } from '../utils/audio';

interface ControlPanelProps {
  appStage: AppStage;
  onDetectFaces: () => void;
  onStartPick: () => void;
  onStopPick: () => void;
  detectedFaces: DetectedFace[];
  scanDuration: number;
  onDurationChange: (duration: number) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  cameraFacing: 'environment' | 'user';
  onToggleCameraFacing: () => void;
  availableDevices: MediaDeviceInfo[];
  classifiedDevices?: CameraDeviceInfo[];
  selectedDeviceId: string;
  onSelectDeviceId: (id: string) => void;
  rotationAngle?: number;
  onToggleRotation?: () => void;
  isLandscape?: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  callHistory: CalledFaceRecord[];
  onOpenHistory: () => void;
  onOpenPhoneGuide: () => void;
  onUploadCustomPhoto: (file: File) => void;
  onResetToLiveCamera: () => void;
  onLoadTestClassroomPhoto: () => void;
  hasCustomPhoto: boolean;
  excludeCalled: boolean;
  onToggleExcludeCalled: (val: boolean) => void;
  torchActive?: boolean;
  onToggleTorch?: () => void;
  hasTorch?: boolean;
  // MODES
  mainViewMode: MainViewMode;
  onSetMainViewMode: (mode: MainViewMode) => void;
  onOpenRemoteConnect: () => void;
  isPhoneConnected: boolean;
  studentsCount: number;
  onOpenClassAlbum: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  appStage,
  onDetectFaces,
  onStartPick,
  onStopPick,
  detectedFaces,
  scanDuration,
  onDurationChange,
  zoom,
  onZoomChange,
  cameraFacing,
  onToggleCameraFacing,
  availableDevices,
  classifiedDevices = [],
  selectedDeviceId,
  onSelectDeviceId,
  rotationAngle = 0,
  onToggleRotation,
  isLandscape = false,
  isMuted,
  onToggleMute,
  isFullscreen,
  onToggleFullscreen,
  callHistory,
  onOpenHistory,
  onOpenPhoneGuide,
  onUploadCustomPhoto,
  onResetToLiveCamera,
  onLoadTestClassroomPhoto,
  hasCustomPhoto,
  excludeCalled,
  onToggleExcludeCalled,
  torchActive,
  onToggleTorch,
  hasTorch,
  mainViewMode,
  onSetMainViewMode,
  onOpenRemoteConnect,
  isPhoneConnected,
  studentsCount,
  onOpenClassAlbum,
}) => {
  const isPicking = appStage === 'picking';
  const isDetecting = appStage === 'detecting';

  const isEligibleToPick =
    mainViewMode === 'album'
      ? studentsCount > 0
      : detectedFaces.length > 0;

  return (
    <div className="flex flex-col justify-between h-full bg-slate-900/95 border-l border-cyan-500/30 p-4 sm:p-5 backdrop-blur-md text-white select-none overflow-y-auto">
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-cyan-500/20">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-cyber text-cyan-400 tracking-widest uppercase">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />
              <span>HỆ THỐNG GỌI TÊN AI</span>
            </div>
            <h1 className="text-lg sm:text-xl font-black font-cyber text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 tracking-tight">
              GỌI TÊN SIÊU CẤP AI
            </h1>
          </div>

          <div className="flex items-center gap-1">
            {/* Horizontal / Landscape Rotate Button in header */}
            {onToggleRotation && (
              <button
                onClick={() => {
                  onToggleRotation();
                  sound.playClick();
                }}
                title="Xoay điện thoại chiều ngang (Toàn cảnh lớp)"
                className={`p-2 rounded-lg border transition-all ${
                  rotationAngle !== 0 || isLandscape
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.4)]'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-amber-300'
                }`}
              >
                <RotateCw className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => {
                onToggleMute();
                sound.playClick();
              }}
              title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-400 transition-colors"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
            </button>
            <button
              onClick={() => {
                onToggleFullscreen();
                sound.playClick();
              }}
              title="Toàn màn hình (Smartboard)"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-400 transition-colors"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Compact Quick Utilities in Header */}
        <div className="flex items-center gap-1.5 mb-3 bg-slate-950/60 p-1.5 rounded-xl border border-cyan-500/20">
          <button
            onClick={() => {
              onOpenRemoteConnect();
              sound.playClick();
            }}
            title="Kết nối camera điện thoại không dây qua mã QR"
            className="flex-1 py-1.5 px-2 bg-slate-800/80 hover:bg-slate-700 text-cyan-300 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all"
          >
            <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
            <span className="truncate">Kết nối ĐT</span>
            {isPhoneConnected && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
          </button>

          <button
            onClick={() => {
              onOpenClassAlbum();
              sound.playClick();
            }}
            title="Quản lý album ảnh học sinh"
            className="py-1.5 px-2.5 bg-slate-800/80 hover:bg-slate-700 text-indigo-300 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all"
          >
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span>Album ({studentsCount})</span>
          </button>
        </div>

        {/* Real-Time Automatic Face Detection Status */}
        <div className="mb-4 bg-slate-950/80 p-3.5 rounded-2xl border border-emerald-500/40 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-cyber text-slate-200">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
              <span className="font-bold text-emerald-400">TỰ ĐỘNG NHẬN DIỆN KHUÔN MẶT</span>
            </div>
            <span className="font-mono text-emerald-300 font-black text-sm px-2.5 py-0.5 rounded-lg bg-emerald-950/80 border border-emerald-500/40 shadow-sm">
              {detectedFaces.length} học sinh
            </span>
          </div>

          <p className="text-[11px] text-slate-400 mb-2.5 leading-relaxed">
            {detectedFaces.length > 0
              ? `Đang tự động đóng khung ${detectedFaces.length} học sinh trong lớp theo thời gian thực.`
              : 'Đang hướng camera về phía lớp học để tự động phát hiện và đóng khung khuôn mặt...'}
          </p>

          <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none py-1.5 px-2 rounded-lg bg-slate-900/70 hover:bg-slate-900 border border-slate-800 transition-colors">
            <input
              type="checkbox"
              checked={excludeCalled}
              onChange={(e) => onToggleExcludeCalled(e.target.checked)}
              className="rounded accent-emerald-400 w-3.5 h-3.5"
            />
            <span>Không gọi lại học sinh đã lên bảng</span>
          </label>
        </div>

        {/* Phase 2: MAIN BIG ACTION BUTTON - QUAY CHỌN NGẪU NHIÊN */}
        <div className="mb-4">
          {!isPicking ? (
            <button
              onClick={() => {
                sound.playClick();
                onStartPick();
              }}
              disabled={!isEligibleToPick}
              className="w-full py-4 px-6 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-50 text-slate-950 font-black font-cyber text-base sm:text-lg tracking-wider rounded-2xl shadow-[0_0_25px_rgba(16,185,129,0.6)] hover:shadow-[0_0_35px_rgba(6,182,212,0.8)] transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              <Play className="w-6 h-6 fill-slate-950" />
              <span>
                {mainViewMode === 'album'
                  ? `QUAY ALBUM (${studentsCount} HỌC SINH)`
                  : 'QUAY CHỌN NGẪU NHIÊN'}
              </span>
            </button>
          ) : (
            <button
              onClick={() => {
                sound.playClick();
                onStopPick();
              }}
              className="w-full py-4 px-6 bg-gradient-to-r from-rose-600 to-red-500 text-white font-black font-cyber text-base tracking-wider rounded-2xl shadow-[0_0_25px_rgba(244,63,94,0.6)] transition-all flex items-center justify-center gap-2 animate-pulse"
            >
              <span>DỪNG QUAY</span>
            </button>
          )}
        </div>

        {/* Duration Slider */}
        <div className="mb-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
          <div className="flex justify-between items-center text-xs mb-1.5 font-cyber">
            <span className="text-slate-400">Thời gian quay:</span>
            <span className="text-cyan-400 font-bold font-mono text-sm">{scanDuration}s</span>
          </div>
          <input
            type="range"
            min={1}
            max={8}
            step={1}
            value={scanDuration}
            onChange={(e) => onDurationChange(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>

        {/* Zoom Slider (for camera modes) */}
        {mainViewMode !== 'album' && (
          <div className="mb-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="flex justify-between items-center text-xs mb-1.5 font-cyber">
              <div className="flex items-center gap-1 text-slate-400">
                <ZoomIn className="w-3.5 h-3.5 text-cyan-400" />
                <span>Zoom kỹ thuật số:</span>
              </div>
              <span className="text-cyan-400 font-bold font-mono text-sm">{zoom.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min={1.0}
              max={3.0}
              step={0.1}
              value={zoom}
              onChange={(e) => onZoomChange(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>
        )}

        {/* CAMERA CONTROLS: Switch Camera, Device Selector, Torch, Rotation */}
        {mainViewMode === 'camera' && (
          <div className="mb-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-xs font-cyber text-slate-400 mb-2">
              <div className="flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-cyan-400" />
                <span>Cấu hình Camera:</span>
              </div>
              {hasTorch && onToggleTorch && (
                <button
                  onClick={onToggleTorch}
                  title="Bật/Tắt Flash"
                  className={`p-1 rounded text-xs transition-colors flex items-center gap-1 ${
                    torchActive ? 'text-amber-300 bg-amber-500/20' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>{torchActive ? 'Flash Bật' : 'Flash Tắt'}</span>
                </button>
              )}
            </div>

            {/* Quick Toggle Camera Button */}
            <button
              onClick={() => {
                onToggleCameraFacing();
                sound.playClick();
              }}
              className="w-full py-2 px-3 mb-2 bg-gradient-to-r from-cyan-600/30 to-blue-600/30 hover:from-cyan-600/40 hover:to-blue-600/40 border border-cyan-500/50 rounded-xl text-xs font-semibold text-cyan-200 flex items-center justify-center gap-2 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                Đổi Camera: {cameraFacing === 'environment' ? 'Camera Sau ➔ Trước' : 'Camera Trước ➔ Sau'}
              </span>
            </button>

            {/* Landscape / Rotation Quick Action Button */}
            {onToggleRotation && (
              <button
                onClick={() => {
                  onToggleRotation();
                  sound.playClick();
                }}
                className={`w-full py-2 px-3 mb-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all border ${
                  rotationAngle !== 0 || isLandscape
                    ? 'bg-amber-500/25 border-amber-400 text-amber-200 shadow-sm'
                    : 'bg-slate-850 hover:bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {rotationAngle !== 0
                    ? `Đang xoay màn hình ${rotationAngle}° (Bấm để xoay tiếp)`
                    : 'Xoay điện thoại chiều ngang (Toàn cảnh lớp)'}
                </span>
              </button>
            )}

            {/* Device list with Vietnamese parsed labels */}
            {(classifiedDevices.length > 1 || availableDevices.length > 1) && (
              <div className="mb-2">
                <label className="block text-[10px] text-slate-400 mb-1">
                  Chọn ống kính camera:
                </label>
                <select
                  value={selectedDeviceId}
                  onChange={(e) => onSelectDeviceId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 focus:outline-none focus:border-cyan-400"
                >
                  {classifiedDevices.length > 0
                    ? classifiedDevices.map((dev, idx) => (
                        <option key={dev.deviceId || idx} value={dev.deviceId}>
                          {dev.displayLabel}
                        </option>
                      ))
                    : availableDevices.map((dev, idx) => (
                        <option key={dev.deviceId || idx} value={dev.deviceId}>
                          {dev.label || `Camera ${idx + 1}`}
                        </option>
                      ))}
                </select>
              </div>
            )}

            {/* Custom photo upload & reset */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
              <label className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 rounded-lg text-[11px] font-medium cursor-pointer transition-colors">
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Tải ảnh đơn lớp...</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      onUploadCustomPhoto(file);
                      sound.playClick();
                    }
                  }}
                />
              </label>

              {hasCustomPhoto && (
                <button
                  onClick={onResetToLiveCamera}
                  title="Bỏ ảnh, quay lại Camera trực tiếp"
                  className="py-1.5 px-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Bỏ ảnh</span>
                </button>
              )}
            </div>

            {/* Quick 1-click test button */}
            <button
              onClick={() => {
                onLoadTestClassroomPhoto();
                sound.playFanfare();
              }}
              className="w-full mt-2 py-1.5 px-2 bg-gradient-to-r from-cyan-950 to-blue-950 hover:from-cyan-900 hover:to-blue-900 border border-cyan-500/40 rounded-lg text-cyan-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
              <span>Thử nghiệm ảnh toàn cảnh lớp học mẫu</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Section: History */}
      <div className="pt-2 border-t border-slate-800">
        <button
          onClick={() => {
            sound.playClick();
            onOpenHistory();
          }}
          className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-xl text-xs font-semibold text-slate-200 flex items-center justify-between transition-colors hover:border-cyan-500/40"
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-cyan-400" />
            <span>Khuôn mặt đã gọi ({callHistory.length})</span>
          </div>

          <div className="flex items-center -space-x-1.5">
            {callHistory.slice(0, 3).map((item) => (
              <img
                key={item.id}
                src={item.facePhotoUrl}
                alt="Face thumbnail"
                className="w-6 h-6 rounded-full border border-cyan-400 object-cover"
              />
            ))}
          </div>
        </button>

        <div className="text-center text-[10px] text-slate-500 mt-2 font-mono">
          [Phím Space] Bắt đầu quay · [F] Toàn màn hình
        </div>
      </div>
    </div>
  );
};
