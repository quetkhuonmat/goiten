import React from 'react';
import {
  Play,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Camera,
  ZoomIn,
  Sun,
  History,
  ScanFace,
  Smartphone,
  RefreshCw,
  Users,
  KeyRound,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { AppStage, CalledFaceRecord, DetectedFace, TeacherLicense } from '../types';
import { CameraDeviceInfo } from '../utils/cameraUtils';
import { FREE_TRIAL_SPINS } from '../utils/licenseManager';
import { sound } from '../utils/audio';

interface ControlPanelProps {
  appStage: AppStage;
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
  isMuted: boolean;
  onToggleMute: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  callHistory: CalledFaceRecord[];
  onOpenHistory: () => void;
  excludeCalled: boolean;
  onToggleExcludeCalled: (val: boolean) => void;
  torchActive?: boolean;
  onToggleTorch?: () => void;
  hasTorch?: boolean;
  onOpenRemoteConnect: () => void;
  isPhoneConnected: boolean;
  studentsCount: number;
  onOpenClassAlbum: () => void;
  license: TeacherLicense | null;
  onOpenLicenseModal: () => void;
  onOpenAdminModal: () => void;
  isAdminLoggedIn?: boolean;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  appStage,
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
  isMuted,
  onToggleMute,
  isFullscreen,
  onToggleFullscreen,
  callHistory,
  onOpenHistory,
  excludeCalled,
  onToggleExcludeCalled,
  torchActive,
  onToggleTorch,
  hasTorch,
  onOpenRemoteConnect,
  isPhoneConnected,
  studentsCount,
  onOpenClassAlbum,
  license,
  onOpenLicenseModal,
  onOpenAdminModal,
  isAdminLoggedIn = false,
}) => {
  const isPicking = appStage === 'picking';
  const hasFaces = detectedFaces.length > 0 || studentsCount > 0;

  return (
    <div className="flex flex-col justify-between h-full bg-slate-900/95 border-l border-cyan-500/30 p-4 sm:p-5 backdrop-blur-md text-white select-none overflow-y-auto">
      {/* Top Header & Toolbar */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-cyan-500/20">
          <div>
            <div className="text-[10px] font-cyber text-cyan-400 tracking-widest uppercase">
              AI SMARTBOARD
            </div>
            <h1 className="text-lg sm:text-xl font-black font-cyber text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 tracking-tight">
              GỌI TÊN HỌC SINH AI
            </h1>
          </div>

          {/* Quick Header Tool Icons: Speaker, Flip Camera, Phone QR, Album, Key, Admin, Fullscreen */}
          <div className="flex items-center gap-1">
            {/* Audio Toggle */}
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

            {/* Flip Camera Button right next to Speaker */}
            <button
              onClick={() => {
                onToggleCameraFacing();
                sound.playClick();
              }}
              title={`Đổi Camera (${cameraFacing === 'environment' ? 'Sau ➔ Trước' : 'Trước ➔ Sau'})`}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white transition-colors"
            >
              <RefreshCw className="w-4 h-4 text-cyan-400" />
            </button>

            {/* Wireless Phone Camera QR modal trigger */}
            <button
              onClick={() => {
                onOpenRemoteConnect();
                sound.playClick();
              }}
              title="Dùng camera điện thoại không dây qua mã QR"
              className={`p-2 rounded-lg border transition-colors relative ${
                isPhoneConnected
                  ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-300'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-cyan-400'
              }`}
            >
              <Smartphone className="w-4 h-4 text-cyan-400" />
              {isPhoneConnected && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>

            {/* Class Album Modal trigger */}
            <button
              onClick={() => {
                onOpenClassAlbum();
                sound.playClick();
              }}
              title="Album ảnh học sinh cả lớp"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-indigo-300 transition-colors relative"
            >
              <Users className="w-4 h-4 text-indigo-400" />
              {studentsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-indigo-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center">
                  {studentsCount}
                </span>
              )}
            </button>

            {/* License Key Trigger */}
            <button
              onClick={() => {
                onOpenLicenseModal();
                sound.playClick();
              }}
              title={license?.isKeyActive ? 'Bản quyền đã kích hoạt' : 'Nhập mã key bản quyền'}
              className={`p-2 rounded-lg transition-colors ${
                license?.isKeyActive
                  ? 'bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300'
                  : (license?.usedSpins || 0) >= FREE_TRIAL_SPINS
                  ? 'bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-300 animate-bounce'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-300'
              }`}
            >
              <KeyRound className="w-4 h-4" />
            </button>

            {/* Admin Portal Gateway - ONLY VISIBLE TO LOGGED IN ADMIN */}
            {isAdminLoggedIn && (
              <button
                onClick={() => {
                  onOpenAdminModal();
                  sound.playClick();
                }}
                title="Quản trị viên (Cấp key & Quản lý bản quyền)"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 hover:text-amber-200 transition-all text-xs font-cyber font-bold shadow-sm cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Admin</span>
              </button>
            )}

            {/* Fullscreen Smartboard Toggle */}
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

        {/* Teacher License / Trial Quota Status Banner */}
        <div
          onClick={() => {
            sound.playClick();
            onOpenLicenseModal();
          }}
          className={`mb-3 p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between shadow-md ${
            license?.isKeyActive
              ? 'bg-emerald-950/60 border-emerald-500/40 hover:border-emerald-400'
              : (license?.usedSpins || 0) >= FREE_TRIAL_SPINS
              ? 'bg-rose-950/70 border-rose-500/50 hover:border-rose-400 animate-pulse'
              : 'bg-slate-950/80 border-cyan-500/30 hover:border-cyan-400'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                license?.isKeyActive
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : (license?.usedSpins || 0) >= FREE_TRIAL_SPINS
                  ? 'bg-rose-500/20 text-rose-400'
                  : 'bg-cyan-500/20 text-cyan-400'
              }`}
            >
              {license?.isKeyActive ? <Sparkles className="w-4 h-4" /> : <KeyRound className="w-4 h-4" />}
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold font-cyber flex items-center gap-1.5">
                <span>{license?.phone ? `SĐT: ${license.phone}` : 'Chưa đăng ký SĐT'}</span>
                {license?.isKeyActive && (
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-bold">
                    PRO
                  </span>
                )}
              </div>
              <div className="text-xs font-cyber font-bold text-white">
                {license?.isKeyActive
                  ? (license.keyType === 'unlimited' ? 'Bản quyền Vĩnh viễn' : `Còn ${Math.max(0, (license.grantedSpins || (license.keyType ? Number(license.keyType) : 500)) - (license.usedSpins || 0))} lượt quay`)
                  : (license?.usedSpins || 0) >= FREE_TRIAL_SPINS
                  ? 'Hết lượt quay (Bấm để kích hoạt)'
                  : 'Tài khoản Giáo viên (Đang hoạt động)'}
              </div>
            </div>
          </div>

          <span className="text-[11px] font-cyber font-bold text-cyan-400 bg-cyan-950/80 border border-cyan-500/30 px-2.5 py-1 rounded-lg">
            {license?.isKeyActive ? 'Bản quyền' : (license?.usedSpins || 0) >= FREE_TRIAL_SPINS ? 'Nhập Key' : 'Bản quyền'}
          </span>
        </div>

        {/* Real-Time Automatic Face Detection & Album Status */}
        <div className="mb-4 bg-slate-950/80 p-3.5 rounded-2xl border border-emerald-500/40 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-cyber text-slate-200">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
              <span className="font-bold text-emerald-400">
                {detectedFaces.length > 0
                  ? 'TỰ ĐỘNG NHẬN DIỆN KHUÔN MẶT'
                  : studentsCount > 0
                  ? 'DANH SÁCH ẢNH CẢ LỚP'
                  : 'TỰ ĐỘNG NHẬN DIỆN KHUÔN MẶT'}
              </span>
            </div>
            <span className="font-mono text-emerald-300 font-black text-sm px-2.5 py-0.5 rounded-lg bg-emerald-950/80 border border-emerald-500/40 shadow-sm">
              {detectedFaces.length > 0 ? `${detectedFaces.length} học sinh` : `${studentsCount} học sinh`}
            </span>
          </div>

          <p className="text-[11px] text-slate-400 mb-2.5 leading-relaxed">
            {detectedFaces.length > 0
              ? `Hệ thống đang tự động theo dõi và đóng khung ${detectedFaces.length} học sinh theo thời gian thực.`
              : studentsCount > 0
              ? `Đã sẵn sàng ${studentsCount} ảnh học sinh trong danh sách cả lớp để quay chọn ngẫu nhiên.`
              : 'Đang mở camera để tự động phát hiện và đóng khung khuôn mặt học sinh trong lớp...'}
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

        {/* MAIN BIG ACTION BUTTON - QUAY CHỌN NGẪU NHIÊN */}
        <div className="mb-4">
          {!isPicking ? (
            <button
              onClick={() => {
                sound.playClick();
                onStartPick();
              }}
              disabled={!hasFaces}
              className="w-full py-4 px-6 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-40 text-slate-950 font-black font-cyber text-base sm:text-lg tracking-wider rounded-2xl shadow-[0_0_25px_rgba(16,185,129,0.6)] hover:shadow-[0_0_35px_rgba(6,182,212,0.8)] transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 group relative overflow-hidden"
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
              <span className="w-3 h-3 bg-white rounded-full animate-ping" />
              <span>DỪNG LẠI (HOẶC NHẤN SPACE)</span>
            </button>
          )}
        </div>

        {/* Duration Slider */}
        <div className="mb-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
          <div className="flex justify-between items-center text-xs mb-1.5 font-cyber">
            <span className="text-slate-400">Thời gian quay chọn:</span>
            <span className="text-cyan-400 font-bold font-mono text-sm">{scanDuration}s</span>
          </div>
          <input
            type="range"
            min={1}
            max={6}
            step={1}
            value={scanDuration}
            onChange={(e) => onDurationChange(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>

        {/* Digital Zoom Slider */}
        <div className="mb-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
          <div className="flex justify-between items-center text-xs mb-1.5 font-cyber">
            <div className="flex items-center gap-1 text-slate-400">
              <ZoomIn className="w-3.5 h-3.5 text-cyan-400" />
              <span>Độ phóng to (Zoom):</span>
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

        {/* Multi-Lens Selector (if phone has multiple rear lenses, e.g. Wide / Ultra-Wide) */}
        {(classifiedDevices.length > 1 || availableDevices.length > 1) && (
          <div className="mb-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-xs font-cyber text-slate-400 mb-2">
              <div className="flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-cyan-400" />
                <span>Chọn ống kính camera:</span>
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
      </div>

      {/* Bottom Section: History of called students */}
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
            <span>Học sinh đã gọi ({callHistory.length})</span>
          </div>

          <div className="flex items-center -space-x-1.5">
            {callHistory.slice(0, 3).map((item, idx) => (
              <img
                key={idx}
                src={item.facePhotoUrl}
                alt="Avatar"
                className="w-6 h-6 rounded-full border border-slate-900 object-cover"
              />
            ))}
          </div>
        </button>
      </div>
    </div>
  );
};
