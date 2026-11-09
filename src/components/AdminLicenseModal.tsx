import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Search,
  KeyRound,
  RefreshCw,
  Copy,
  Check,
  Smartphone,
  Lock,
  X,
  Users,
  Sparkles,
  RotateCcw,
  MessageCircle,
  LogOut,
  QrCode,
} from 'lucide-react';
import { TeacherLicense, LicenseKeyType } from '../types';
import {
  ADMIN_ZALO_PHONE,
  ADMIN_DEFAULT_PIN,
  FREE_TRIAL_SPINS,
  generateLicenseKey,
  normalizePhoneNumber,
  isStoredAdminAuth,
  setStoredAdminAuth,
} from '../utils/licenseManager';
import { sound } from '../utils/audio';

interface AdminLicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAdminQr?: () => void;
  onAdminLogout?: () => void;
}

export const AdminLicenseModal: React.FC<AdminLicenseModalProps> = ({
  isOpen,
  onClose,
  onOpenAdminQr,
  onAdminLogout,
}) => {
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const [teachers, setTeachers] = useState<TeacherLicense[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Quick Issue Key State
  const [selectedTeacherPhone, setSelectedTeacherPhone] = useState<string | null>(null);
  const [customPhone, setCustomPhone] = useState('');
  const [selectedKeyType, setSelectedKeyType] = useState<LicenseKeyType>('unlimited');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedZaloMsg, setCopiedZaloMsg] = useState(false);

  // Auto-login if already authenticated in this session
  useEffect(() => {
    if (isOpen && isStoredAdminAuth()) {
      setIsAuthenticated(true);
      fetchTeachers(ADMIN_DEFAULT_PIN);
    }
  }, [isOpen]);

  // Load teachers from backend
  const fetchTeachers = async (adminPin: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/license/admin/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: adminPin }),
      });
      if (res.ok) {
        const data = await res.json();
        setTeachers(data.teachers || []);
      }
    } catch (err) {
      console.warn('Cannot fetch admin teacher list:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pin.trim();
    if (cleanPin === ADMIN_DEFAULT_PIN || cleanPin === 'admin123' || cleanPin === ADMIN_ZALO_PHONE) {
      sound.playClick();
      setStoredAdminAuth(true);
      setIsAuthenticated(true);
      setPinError(null);
      fetchTeachers(cleanPin);
    } else {
      sound.playClick();
      setPinError('Mã PIN không đúng. Gợi ý: Số điện thoại Admin (0973834541).');
    }
  };

  const handleGenerateKeyForPhone = async (targetPhone: string, type: LicenseKeyType) => {
    sound.playClick();
    const norm = normalizePhoneNumber(targetPhone);
    const key = generateLicenseKey(norm, type);
    setGeneratedKey(key);

    try {
      await fetch('/api/license/admin/generate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin.trim() || ADMIN_DEFAULT_PIN, phone: norm, type }),
      });
      fetchTeachers(pin.trim() || ADMIN_DEFAULT_PIN);
      sound.playFanfare();
    } catch {}
  };

  const handleResetSpins = async (targetPhone: string) => {
    if (!confirm(`Xác nhận reset lượt quay của số ${targetPhone} về 0?`)) return;
    sound.playClick();
    try {
      await fetch('/api/license/admin/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin.trim() || ADMIN_DEFAULT_PIN, phone: targetPhone }),
      });
      fetchTeachers(pin.trim() || ADMIN_DEFAULT_PIN);
    } catch {}
  };

  const handleCopyKey = () => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey);
    setCopiedKey(true);
    sound.playClick();
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyZaloMessage = (targetPhone: string) => {
    if (!generatedKey) return;
    const msg = `Chào Thầy/Cô! AI Smartboard gửi Thầy/Cô mã kích hoạt bản quyền cho số điện thoại ${targetPhone}:\n\nMã Key: ${generatedKey}\n\nThầy/Cô mở app, nhập số điện thoại ${targetPhone} và dán mã key trên vào để sử dụng không giới hạn nhé! Chúc Thầy/Cô tiết dạy thành công!`;
    navigator.clipboard.writeText(msg);
    setCopiedZaloMsg(true);
    sound.playClick();
    setTimeout(() => setCopiedZaloMsg(false), 2500);
  };

  if (!isOpen) return null;

  // Filter teachers by search query
  const filteredTeachers = teachers.filter((t) => {
    if (!searchQuery.trim()) return true;
    return t.phone.includes(searchQuery.trim().replace(/\D/g, ''));
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-cyan-500/50 rounded-3xl p-5 sm:p-7 shadow-[0_0_60px_rgba(6,182,212,0.3)] text-white my-auto max-h-[92vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-cyan-500/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-cyan-500 flex items-center justify-center text-slate-950 font-black shadow-lg shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[10px] font-cyber text-cyan-400 tracking-wider uppercase font-bold">
                ADMIN CONTROL PANEL
              </div>
              <h2 className="text-lg sm:text-xl font-black font-cyber text-white">
                QUẢN LÝ BẢN QUYỀN & CẤP MÃ KEY
              </h2>
            </div>
          </div>

          {isAuthenticated && (
            <button
              onClick={() => {
                sound.playClick();
                setStoredAdminAuth(false);
                setIsAuthenticated(false);
                setPin('');
                onAdminLogout?.();
              }}
              className="mr-8 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-rose-300 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Thoát Admin</span>
            </button>
          )}
        </div>

        {/* LOGIN FORM IF NOT AUTHENTICATED */}
        {!isAuthenticated ? (
          <div className="py-6 max-w-sm mx-auto w-full text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 mx-auto shadow-lg">
              <Lock className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-cyber font-bold text-base text-white mb-1">
                XÁC THỰC QUẢN TRỊ VIÊN
              </h3>
              <p className="text-xs text-slate-400">
                Quét mã QR Zalo hoặc nhập mã PIN quản trị (Số Zalo: <strong>0973834541</strong>)
              </p>
            </div>

            {/* QR Scan Button for Admin */}
            {onOpenAdminQr && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAdminQr();
                }}
                className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-cyber font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <QrCode className="w-4 h-4 text-slate-950" />
                <span>QUÉT MÃ QR ZALO 0973834541</span>
              </button>
            )}

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-slate-900 px-2 text-slate-500 font-mono">Hoặc nhập mã PIN</span>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-3">
              <input
                type="password"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  if (pinError) setPinError(null);
                }}
                placeholder="Nhập mã PIN (0973834541)..."
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-cyan-500/50 text-white font-mono text-center text-base tracking-widest placeholder-slate-600 focus:outline-none focus:border-cyan-400"
              />

              {pinError && (
                <p className="text-rose-400 text-xs font-medium">{pinError}</p>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 font-cyber font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
              >
                Xác nhận PIN
              </button>
            </form>
          </div>
        ) : (
          /* AUTHENTICATED ADMIN DASHBOARD */
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto space-y-4 pr-1">
            {/* Stats Summary Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3">
                <div className="text-[10px] font-cyber text-slate-400 uppercase">Tổng giáo viên</div>
                <div className="text-lg font-black font-cyber text-cyan-300">{teachers.length}</div>
              </div>
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3">
                <div className="text-[10px] font-cyber text-slate-400 uppercase">Đã kích hoạt Key</div>
                <div className="text-lg font-black font-cyber text-emerald-400">
                  {teachers.filter((t) => t.isKeyActive).length}
                </div>
              </div>
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3">
                <div className="text-[10px] font-cyber text-slate-400 uppercase">Đang dùng thử</div>
                <div className="text-lg font-black font-cyber text-amber-400">
                  {teachers.filter((t) => !t.isKeyActive).length}
                </div>
              </div>
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3">
                <div className="text-[10px] font-cyber text-slate-400 uppercase">Tổng lượt quay</div>
                <div className="text-lg font-black font-cyber text-indigo-300">
                  {teachers.reduce((sum, t) => sum + (t.usedSpins || 0), 0)}
                </div>
              </div>
            </div>

            {/* Quick Generator Box */}
            <div className="bg-slate-950/80 border border-cyan-500/30 rounded-2xl p-4 shrink-0">
              <div className="text-xs font-cyber font-bold text-cyan-300 mb-2.5 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>CẤP MÃ KEY NHANH CHO SỐ ĐIỆN THOẠI:</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="tel"
                  value={customPhone}
                  onChange={(e) => setCustomPhone(e.target.value)}
                  placeholder="Nhập số điện thoại (VD: 0973834541)..."
                  maxLength={12}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />

                <select
                  value={selectedKeyType}
                  onChange={(e) => setSelectedKeyType(e.target.value as LicenseKeyType)}
                  className="px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-medium text-slate-200 focus:outline-none focus:border-cyan-400 cursor-pointer"
                >
                  <option value="unlimited">Gói Vĩnh Viễn (Không giới hạn)</option>
                  <option value="500">Gói 500 lượt quay</option>
                  <option value="200">Gói 200 lượt quay</option>
                  <option value="100">Gói 100 lượt quay</option>
                </select>

                <button
                  type="button"
                  onClick={() => {
                    if (!customPhone.trim()) {
                      alert('Vui lòng nhập số điện thoại');
                      return;
                    }
                    handleGenerateKeyForPhone(customPhone, selectedKeyType);
                  }}
                  className="py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 text-slate-950 font-cyber font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shrink-0 cursor-pointer"
                >
                  Tạo Key Ngay
                </button>
              </div>

              {/* Generated Key Result Display */}
              {generatedKey && (
                <div className="mt-3.5 p-3.5 bg-emerald-950/70 border border-emerald-500/50 rounded-xl space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-cyber text-emerald-300 font-bold">
                      MÃ KEY ĐÃ TẠO THÀNH CÔNG:
                    </span>
                    <span className="text-[11px] font-mono text-emerald-400">
                      Đã lưu vào hệ thống
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-950 rounded-lg border border-emerald-500/40 font-mono text-sm font-bold text-emerald-300 text-center tracking-wider select-all break-all">
                    {generatedKey}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleCopyKey}
                      className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white rounded-lg flex items-center gap-1.5 transition-all"
                    >
                      {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey ? 'Đã sao chép Key' : 'Sao chép Key'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyZaloMessage(customPhone || selectedTeacherPhone || '')}
                      className="py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white rounded-lg flex items-center gap-1.5 transition-all"
                    >
                      {copiedZaloMsg ? (
                        <Check className="w-3.5 h-3.5 text-emerald-300" />
                      ) : (
                        <MessageCircle className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedZaloMsg ? 'Đã sao chép tin nhắn Zalo' : 'Sao chép tin nhắn Zalo gửi giáo viên'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Search and List Header */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Nhập số điện thoại để tìm kiếm..."
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <button
                type="button"
                onClick={() => fetchTeachers(pin.trim() || ADMIN_DEFAULT_PIN)}
                className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shrink-0 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Làm mới danh sách</span>
              </button>
            </div>

            {/* Teacher List Table */}
            <div className="flex-1 bg-slate-950/70 border border-slate-800 rounded-2xl overflow-hidden min-h-[220px]">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/90 text-slate-400 font-cyber uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-3.5">Số điện thoại</th>
                      <th className="py-3 px-3.5 text-center">Số lượt quay</th>
                      <th className="py-3 px-3.5 text-center">Trạng thái</th>
                      <th className="py-3 px-3.5 text-center">Mã Key</th>
                      <th className="py-3 px-3.5 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredTeachers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500 font-mono text-xs">
                          {searchQuery
                            ? `Không tìm thấy giáo viên nào có số điện thoại "${searchQuery}"`
                            : 'Chưa có giáo viên nào đăng ký sử dụng.'}
                        </td>
                      </tr>
                    ) : (
                      filteredTeachers.map((teacher) => {
                        const isUnlimited = teacher.keyType === 'unlimited';
                        const isExceeded = !teacher.isKeyActive && teacher.usedSpins >= FREE_TRIAL_SPINS;

                        return (
                          <tr key={teacher.phone} className="hover:bg-slate-900/50 transition-colors">
                            <td className="py-3 px-3.5 font-mono font-bold text-white text-xs">
                              {teacher.phone}
                            </td>
                            <td className="py-3 px-3.5 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full font-cyber font-bold text-[11px] ${
                                  isExceeded
                                    ? 'bg-rose-950/80 border border-rose-500/50 text-rose-300'
                                    : 'bg-slate-800 text-cyan-300'
                                }`}
                              >
                                {teacher.usedSpins} lượt
                              </span>
                            </td>
                            <td className="py-3 px-3.5 text-center">
                              {teacher.isKeyActive ? (
                                <span className="px-2 py-0.5 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 rounded-full font-cyber font-bold text-[10px]">
                                  {isUnlimited ? 'Vĩnh viễn' : `Gói ${teacher.grantedSpins}`}
                                </span>
                              ) : isExceeded ? (
                                <span className="px-2 py-0.5 bg-rose-950/80 border border-rose-500/40 text-rose-300 rounded-full font-cyber font-bold text-[10px]">
                                  Hết lượt (20/20)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-amber-950/80 border border-amber-500/40 text-amber-300 rounded-full font-cyber font-bold text-[10px]">
                                  Dùng thử ({teacher.usedSpins}/{FREE_TRIAL_SPINS})
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-center font-mono text-[11px] text-slate-300 max-w-[150px] truncate">
                              {teacher.activeKey ? (
                                <span className="text-emerald-400 font-bold" title={teacher.activeKey}>
                                  {teacher.activeKey}
                                </span>
                              ) : (
                                <span className="text-slate-600">—</span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCustomPhone(teacher.phone);
                                    setSelectedTeacherPhone(teacher.phone);
                                    handleGenerateKeyForPhone(teacher.phone, 'unlimited');
                                  }}
                                  className="py-1 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-cyber font-bold text-[10px] rounded-lg transition-colors flex items-center gap-1 shadow"
                                >
                                  <KeyRound className="w-3 h-3" />
                                  <span>Cấp Key</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleResetSpins(teacher.phone)}
                                  title="Reset số lượt quay về 0"
                                  className="p-1 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded-lg transition-colors"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
