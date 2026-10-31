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
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { AppStage, CalledFaceRecord, DetectedFace } from '../types';
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
  selectedDeviceId: string;
  onSelectDeviceId: (id: string) => void;
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
  selectedDeviceId,
  onSelectDeviceId,
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
}) => {
  const isPicking = appStage === 'picking';
  const isDetecting = appStage === 'detecting';

  return (
    <div className="flex flex-col justify-between h-full bg-slate-900/95 border-l border-cyan-500/30 p-4 sm:p-5 backdrop-blur-md text-white select-none overflow-y-auto">
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-cyan-500/20">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-cyber text-cyan-400 tracking-widest uppercase">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />
              <span>CAMERA TRỰC TIẾP</span>
            </div>
            <h1 className="text-lg sm:text-xl font-black font-cyber text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 tracking-tight">
              GỌI TÊN SIÊU CẤP AI
            </h1>
          </div>

          <div className="flex items-center gap-1">
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

        {/* Big Highlight Button: Open Phone Guide */}
        <button
          onClick={() => {
            onOpenPhoneGuide();
            sound.playClick();
          }}
          className="w-full mb-3 py-2 px-3 bg-gradient-to-r from-cyan-950 via-slate-900 to-cyan-950 hover:from-cyan-900 hover:to-slate-800 border border-cyan-400/50 rounded-xl text-cyan-300 text-xs font-semibold flex items-center justify-between shadow-md transition-all group"
        >
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-yellow-400 group-hover:scale-110 transition-transform" />
            <span>Hướng dẫn mở trên Điện Thoại (Tránh 403)</span>
          </div>
          <span className="text-[10px] bg-cyan-500/20 px-2 py-0.5 rounded text-cyan-300 font-mono">
            Xem ngay 📱
          </span>
        </button>

        {/* Phase 1: Detected Faces Status */}
        <div className="mb-3 bg-slate-950/70 p-3 rounded-xl border border-cyan-500/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-cyber text-slate-300">
              <ScanFace className="w-4 h-4 text-emerald-400" />
              <span>Khuôn mặt đã nhận diện:</span>
            </div>
            <span className="font-mono text-emerald-400 font-bold text-sm">
              {detectedFaces.length} học sinh
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => {
                onDetectFaces();
                sound.playClick();
              }}
              disabled={isPicking || isDetecting}
              className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
            >
              <RotateCcw className={`w-3 h-3 ${isDetecting ? 'animate-spin' : ''}`} />
              <span>{isDetecting ? 'Đang quét...' : 'Quét lại khuôn mặt'}</span>
            </button>

            <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={excludeCalled}
                onChange={(e) => onToggleExcludeCalled(e.target.checked)}
                className="rounded accent-cyan-400 w-3 h-3"
              />
              <span>Không gọi lại</span>
            </label>
          </div>
        </div>

        {/* Phase 2: MAIN BIG ACTION BUTTON - QUAY CHỌN NGẪU NHIÊN */}
        <div className="mb-4">
          {!isPicking ? (
            <button
              onClick={() => {
                sound.playClick();
                onStartPick();
              }}
              disabled={detectedFaces.length === 0}
              className="w-full py-4 px-6 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-50 text-slate-950 font-black font-cyber text-base sm:text-lg tracking-wider rounded-2xl shadow-[0_0_25px_rgba(16,185,129,0.6)] hover:shadow-[0_0_35px_rgba(6,182,212,0.8)] transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              <Play className="w-6 h-6 fill-slate-950" />
              <span>QUAY CHỌN NGẪU NHIÊN</span>
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

        {/* Zoom Slider */}
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

        {/* CAMERA CONTROLS: Switch Camera, Device Selector, Torch */}
        <div className="mb-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-xs font-cyber text-slate-400 mb-2">
            <div className="flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-cyan-400" />
              <span>Camera thiết bị:</span>
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
              Đổi Camera: {cameraFacing === 'environment' ? 'Đang dùng Camera Sau ➔ Đổi sang Trước' : 'Đang dùng Camera Trước ➔ Đổi sang Sau'}
            </span>
          </button>

          {/* Device list if multiple cameras detected */}
          {availableDevices.length > 1 && (
            <div className="mb-2">
              <select
                value={selectedDeviceId}
                onChange={(e) => onSelectDeviceId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 focus:outline-none focus:border-cyan-400"
              >
                {availableDevices.map((dev, idx) => (
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
              <span>Tải ảnh lớp học mới...</span>
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

          {/* Quick 1-click test button for the classroom photo */}
          <button
            onClick={() => {
              onLoadTestClassroomPhoto();
              sound.playFanfare();
            }}
            className="w-full mt-2 py-1.5 px-2 bg-gradient-to-r from-cyan-950 to-blue-950 hover:from-cyan-900 hover:to-blue-900 border border-cyan-500/40 rounded-lg text-cyan-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
            <span>Thử nghiệm quét trên ảnh lớp học này (Ảnh thầy vừa gửi)</span>
          </button>
        </div>
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
