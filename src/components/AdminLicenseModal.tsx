import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
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
  FileSpreadsheet,
  UserCheck,
  UserX,
  Clock,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Upload,
  PlusCircle,
} from 'lucide-react';
import { TeacherLicense, LicenseKeyType, TeacherApprovalStatus } from '../types';
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Quick Issue Key State
  const [customPhone, setCustomPhone] = useState('');
  const [selectedKeyType, setSelectedKeyType] = useState<LicenseKeyType>('unlimited');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedZaloMsg, setCopiedZaloMsg] = useState(false);

  // Excel / Batch Whitelist Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importPhonesList, setImportPhonesList] = useState<string[]>([]);
  const [importRawText, setImportRawText] = useState('');
  const [importKeyType, setImportKeyType] = useState<string>('trial');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  // 1-Click Approve
  const handleApproveTeacher = async (targetPhone: string) => {
    sound.playClick();
    try {
      const res = await fetch('/api/license/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin.trim() || ADMIN_DEFAULT_PIN, phone: targetPhone }),
      });
      if (res.ok) {
        sound.playFanfare();
        setActionMessage(`Đã phê duyệt thành công số điện thoại ${targetPhone}!`);
        setTimeout(() => setActionMessage(null), 3000);
        fetchTeachers(pin.trim() || ADMIN_DEFAULT_PIN);
      }
    } catch {
      alert('Không thể phê duyệt, vui lòng thử lại.');
    }
  };

  // Reject
  const handleRejectTeacher = async (targetPhone: string) => {
    sound.playClick();
    try {
      const res = await fetch('/api/license/admin/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin.trim() || ADMIN_DEFAULT_PIN, phone: targetPhone }),
      });
      if (res.ok) {
        setActionMessage(`Đã từ chối số điện thoại ${targetPhone}.`);
        setTimeout(() => setActionMessage(null), 3000);
        fetchTeachers(pin.trim() || ADMIN_DEFAULT_PIN);
      }
    } catch {
      alert('Thao tác thất bại.');
    }
  };

  // Delete
  const handleDeleteTeacher = async (targetPhone: string) => {
    sound.playClick();
    try {
      const res = await fetch('/api/license/admin/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin.trim() || ADMIN_DEFAULT_PIN, phone: targetPhone }),
      });
      if (res.ok) {
        setActionMessage(`Đã xóa số điện thoại ${targetPhone} khỏi hệ thống.`);
        setTimeout(() => setActionMessage(null), 3000);
        fetchTeachers(pin.trim() || ADMIN_DEFAULT_PIN);
      }
    } catch {
      alert('Không thể xóa số điện thoại.');
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
    sound.playClick();
    try {
      await fetch('/api/license/admin/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin.trim() || ADMIN_DEFAULT_PIN, phone: targetPhone }),
      });
      setActionMessage(`Đã đặt lại số lượt quay của ${targetPhone} về 0.`);
      setTimeout(() => setActionMessage(null), 3000);
      fetchTeachers(pin.trim() || ADMIN_DEFAULT_PIN);
    } catch {}
  };

  // Parse Excel / CSV File
  const handleExcelFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const foundPhones: string[] = [];

      workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
        rows.forEach((row) => {
          if (Array.isArray(row)) {
            row.forEach((cell) => {
              if (cell !== null && cell !== undefined) {
                const cellStr = String(cell).trim();
                const matches = cellStr.match(/(?:84|0)(?:3|5|7|8|9)\d{8}/g);
                if (matches) {
                  matches.forEach((m) => {
                    let clean = m.replace(/\D/g, '');
                    if (clean.startsWith('84') && clean.length === 11) clean = '0' + clean.substring(2);
                    if (clean !== ADMIN_ZALO_PHONE && /^0[3|5|7|8|9]\d{8}$/.test(clean)) {
                      foundPhones.push(clean);
                    }
                  });
                }
              }
            });
          }
        });
      });

      const unique = Array.from(new Set(foundPhones));
      setImportPhonesList(unique);
      if (unique.length > 0) {
        sound.playFanfare();
        setActionMessage(`Đã tìm thấy ${unique.length} số điện thoại giáo viên từ file Excel.`);
      } else {
        alert('Không tìm thấy số điện thoại hợp lệ nào trong file Excel.');
      }
    } catch (err) {
      console.error('Error reading excel file:', err);
      alert('Không thể đọc file Excel. Vui lòng kiểm tra định dạng .xlsx, .xls hoặc .csv');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // Parse Raw Text / Paste
  const handleParseRawText = (text: string) => {
    setImportRawText(text);
    const matches = text.match(/(?:84|0)(?:3|5|7|8|9)\d{8}/g) || [];
    const unique = Array.from(
      new Set(
        matches
          .map((m) => {
            let n = m.replace(/\D/g, '');
            if (n.startsWith('84') && n.length === 11) n = '0' + n.substring(2);
            return n;
          })
          .filter((n) => n !== ADMIN_ZALO_PHONE && /^0[3|5|7|8|9]\d{8}$/.test(n))
      )
    );
    setImportPhonesList(unique);
  };

  // Submit Import Whitelist
  const handleConfirmImportWhitelist = async () => {
    if (importPhonesList.length === 0) {
      alert('Vui lòng tải file Excel hoặc dán danh sách số điện thoại trước khi xác nhận.');
      return;
    }

    setIsImporting(true);
    sound.playClick();
    try {
      const res = await fetch('/api/license/admin/import-whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: pin.trim() || ADMIN_DEFAULT_PIN,
          phones: importPhonesList,
          keyType: importKeyType === 'trial' ? undefined : importKeyType,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        sound.playFanfare();
        setIsImportModalOpen(false);
        setImportPhonesList([]);
        setImportRawText('');
        setActionMessage(`Đã phê duyệt thành công ${data.count} giáo viên vào hệ thống!`);
        setTimeout(() => setActionMessage(null), 4000);
        fetchTeachers(pin.trim() || ADMIN_DEFAULT_PIN);
      } else {
        const err = await res.json();
        alert(err.error || 'Có lỗi xảy ra khi nhập danh sách.');
      }
    } catch {
      alert('Chưa thể kết nối máy chủ để nhập danh sách.');
    } finally {
      setIsImporting(false);
    }
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
    const msg = `Chào Thầy/Cô! AI Smartboard gửi Thầy/Cô mã kích hoạt bản quyền cho số điện thoại ${targetPhone}:\n\nMã Key: ${generatedKey}\n\nThầy/Cô mở app, nhập số điện thoại ${targetPhone} và dán mã key trên vào để sử dụng nhé! Chúc Thầy/Cô tiết dạy thành công!`;
    navigator.clipboard.writeText(msg);
    setCopiedZaloMsg(true);
    sound.playClick();
    setTimeout(() => setCopiedZaloMsg(false), 2500);
  };

  if (!isOpen) return null;

  // Filter teachers
  const pendingCount = teachers.filter((t) => t.status === 'pending').length;
  const approvedCount = teachers.filter((t) => t.status === 'approved' || !t.status).length;
  const rejectedCount = teachers.filter((t) => t.status === 'rejected').length;

  const filteredTeachers = teachers.filter((t) => {
    // Search query match
    if (searchQuery.trim()) {
      const q = searchQuery.trim().replace(/\D/g, '');
      if (!t.phone.includes(q)) return false;
    }
    // Status filter
    if (statusFilter === 'pending') return t.status === 'pending';
    if (statusFilter === 'approved') return t.status === 'approved' || !t.status;
    if (statusFilter === 'rejected') return t.status === 'rejected';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-cyan-500/50 rounded-3xl p-5 sm:p-7 shadow-[0_0_60px_rgba(6,182,212,0.3)] text-white my-auto max-h-[92vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors z-10 cursor-pointer"
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
              <div className="text-[10px] font-cyber text-cyan-400 tracking-wider uppercase font-bold flex items-center gap-1.5">
                <span>ADMIN CONTROL PANEL</span>
                {pendingCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 text-[10px] rounded-full font-black animate-pulse">
                    {pendingCount} CHỜ DUYỆT
                  </span>
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-black font-cyber text-white">
                QUẢN LÝ BẢN QUYỀN & PHÊ DUYỆT GIÁO VIÊN
              </h2>
            </div>
          </div>

          {isAuthenticated && (
            <div className="flex items-center gap-2 mr-8">
              {/* Import Excel Whitelist Button */}
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  setIsImportModalOpen(true);
                }}
                className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-cyber font-bold rounded-lg text-xs flex items-center gap-1.5 shadow transition-all cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="hidden sm:inline">Nhập File Excel</span>
                <span className="sm:hidden">Excel</span>
              </button>

              <button
                onClick={() => {
                  sound.playClick();
                  setStoredAdminAuth(false);
                  setIsAuthenticated(false);
                  setPin('');
                  onAdminLogout?.();
                }}
                className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-rose-300 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Thoát</span>
              </button>
            </div>
          )}
        </div>

        {/* Global Action Notification Banner */}
        {actionMessage && (
          <div className="mb-3 p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs font-medium flex items-center gap-2 shrink-0 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* ================= LOGIN FORM IF NOT AUTHENTICATED ================= */}
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
          /* ================= AUTHENTICATED ADMIN DASHBOARD ================= */
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto space-y-4 pr-1">
            {/* Stats Summary Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3">
                <div className="text-[10px] font-cyber text-slate-400 uppercase">Tổng giáo viên</div>
                <div className="text-lg font-black font-cyber text-cyan-300">{teachers.length}</div>
              </div>
              <div
                onClick={() => setStatusFilter('pending')}
                className={`bg-slate-950/70 border rounded-2xl p-3 cursor-pointer transition-all ${
                  pendingCount > 0 ? 'border-amber-500/60 bg-amber-950/20 shadow-md' : 'border-slate-800'
                }`}
              >
                <div className="text-[10px] font-cyber text-amber-400 uppercase flex items-center justify-between">
                  <span>Chờ phê duyệt</span>
                  {pendingCount > 0 && <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />}
                </div>
                <div className="text-lg font-black font-cyber text-amber-400">{pendingCount}</div>
              </div>
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3">
                <div className="text-[10px] font-cyber text-slate-400 uppercase">Đã kích hoạt Key</div>
                <div className="text-lg font-black font-cyber text-emerald-400">
                  {teachers.filter((t) => t.isKeyActive).length}
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
                <span>CẤP MÃ KEY NHANH HOẶC THÊM SỐ ĐIỆN THOẠI:</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="tel"
                  value={customPhone}
                  onChange={(e) => setCustomPhone(e.target.value)}
                  placeholder="Nhập số điện thoại giáo viên (VD: 0912345678)..."
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
                      Đã lưu và tự động phê duyệt
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-950 rounded-lg border border-emerald-500/40 font-mono text-sm font-bold text-emerald-300 text-center tracking-wider select-all break-all">
                    {generatedKey}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleCopyKey}
                      className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey ? 'Đã sao chép Key' : 'Sao chép Key'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyZaloMessage(customPhone || '')}
                      className="py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
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

            {/* Status Filter Tabs & Search Header */}
            <div className="space-y-2.5 shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Tabs */}
                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-cyber">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className={`py-1.5 px-3 rounded-lg font-bold transition-all cursor-pointer ${
                      statusFilter === 'all'
                        ? 'bg-cyan-500 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Tất cả ({teachers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('pending')}
                    className={`py-1.5 px-3 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      statusFilter === 'pending'
                        ? 'bg-amber-500 text-slate-950 shadow'
                        : 'text-amber-400 hover:text-amber-300'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Chờ duyệt ({pendingCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('approved')}
                    className={`py-1.5 px-3 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      statusFilter === 'approved'
                        ? 'bg-emerald-500 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Đã duyệt ({approvedCount})</span>
                  </button>
                  {rejectedCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setStatusFilter('rejected')}
                      className={`py-1.5 px-3 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        statusFilter === 'rejected'
                          ? 'bg-rose-500 text-white shadow'
                          : 'text-rose-400 hover:text-rose-300'
                      }`}
                    >
                      <UserX className="w-3.5 h-3.5" />
                      <span>Đã từ chối ({rejectedCount})</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fetchTeachers(pin.trim() || ADMIN_DEFAULT_PIN)}
                    className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>Làm mới</span>
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm theo số điện thoại giáo viên..."
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Teacher List Table */}
            <div className="flex-1 bg-slate-950/70 border border-slate-800 rounded-2xl overflow-hidden min-h-[240px]">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/90 text-slate-400 font-cyber uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-3.5">Số điện thoại</th>
                      <th className="py-3 px-3.5 text-center">Trạng thái duyệt</th>
                      <th className="py-3 px-3.5 text-center">Số lượt quay</th>
                      <th className="py-3 px-3.5 text-center">Mã Key</th>
                      <th className="py-3 px-3.5 text-right">Thao tác Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredTeachers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-slate-500 font-mono text-xs">
                          {statusFilter === 'pending'
                            ? 'Hiện tại không có số điện thoại nào đang chờ duyệt.'
                            : searchQuery
                            ? `Không tìm thấy giáo viên nào có số điện thoại "${searchQuery}"`
                            : 'Chưa có giáo viên nào trong danh sách.'}
                        </td>
                      </tr>
                    ) : (
                      filteredTeachers.map((teacher) => {
                        const isPending = teacher.status === 'pending';
                        const isRejected = teacher.status === 'rejected';
                        const isApproved = teacher.status === 'approved' || !teacher.status;
                        const isUnlimited = teacher.keyType === 'unlimited';
                        const isExceeded = !teacher.isKeyActive && teacher.usedSpins >= FREE_TRIAL_SPINS;

                        return (
                          <tr
                            key={teacher.phone}
                            className={`transition-colors ${
                              isPending
                                ? 'bg-amber-950/20 hover:bg-amber-950/30'
                                : 'hover:bg-slate-900/50'
                            }`}
                          >
                            {/* Phone */}
                            <td className="py-3 px-3.5 font-mono font-bold text-white text-xs">
                              <div className="flex items-center gap-2">
                                <span>{teacher.phone}</span>
                                {isPending && (
                                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                                )}
                              </div>
                            </td>

                            {/* Status */}
                            <td className="py-3 px-3.5 text-center">
                              {isPending ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/20 border border-amber-500/50 text-amber-300 rounded-full font-cyber font-bold text-[10px]">
                                  <Clock className="w-3 h-3 text-amber-400" />
                                  <span>Chờ phê duyệt</span>
                                </span>
                              ) : isRejected ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-500/20 border border-rose-500/50 text-rose-300 rounded-full font-cyber font-bold text-[10px]">
                                  <UserX className="w-3 h-3 text-rose-400" />
                                  <span>Đã từ chối</span>
                                </span>
                              ) : teacher.isKeyActive ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 rounded-full font-cyber font-bold text-[10px]">
                                  <UserCheck className="w-3 h-3 text-emerald-400" />
                                  <span>{isUnlimited ? 'Key Vĩnh viễn' : `Key ${teacher.grantedSpins} lượt`}</span>
                                </span>
                              ) : isExceeded ? (
                                <span className="px-2 py-0.5 bg-rose-950/80 border border-rose-500/40 text-rose-300 rounded-full font-cyber font-bold text-[10px]">
                                  Hết lượt (20/20)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 rounded-full font-cyber font-bold text-[10px]">
                                  <Check className="w-3 h-3" />
                                  <span>Đã duyệt (Dùng thử)</span>
                                </span>
                              )}
                            </td>

                            {/* Spins */}
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

                            {/* Active Key */}
                            <td className="py-3 px-3.5 text-center font-mono text-[11px] text-slate-300 max-w-[150px] truncate">
                              {teacher.activeKey ? (
                                <span className="text-emerald-400 font-bold" title={teacher.activeKey}>
                                  {teacher.activeKey}
                                </span>
                              ) : (
                                <span className="text-slate-600">—</span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {isPending ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleApproveTeacher(teacher.phone)}
                                      className="py-1 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-cyber font-black text-[11px] rounded-lg transition-all flex items-center gap-1 shadow cursor-pointer active:scale-95"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>Phê duyệt</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleRejectTeacher(teacher.phone)}
                                      title="Từ chối số này"
                                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                    >
                                      <UserX className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCustomPhone(teacher.phone);
                                        handleGenerateKeyForPhone(teacher.phone, 'unlimited');
                                      }}
                                      className="py-1 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-cyber font-bold text-[10px] rounded-lg transition-colors flex items-center gap-1 shadow cursor-pointer"
                                    >
                                      <KeyRound className="w-3 h-3" />
                                      <span>Cấp Key</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleResetSpins(teacher.phone)}
                                      title="Reset số lượt quay về 0"
                                      className="p-1 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleDeleteTeacher(teacher.phone)}
                                      title="Xóa giáo viên khỏi danh sách"
                                      className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
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

        {/* ================= MODAL: EXCEL & BATCH WHITELIST IMPORT ================= */}
        {isImportModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in">
            <div className="relative w-full max-w-xl bg-slate-900 border border-emerald-500/60 rounded-3xl p-6 shadow-[0_0_60px_rgba(16,185,129,0.3)] text-white space-y-4">
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-slate-950 font-black shadow-lg shrink-0">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[10px] font-cyber text-emerald-400 tracking-wider uppercase font-bold">
                    NHẬP DANH SÁCH GIÁO VIÊN
                  </div>
                  <h3 className="text-base font-black font-cyber text-white">
                    TẢI FILE EXCEL / CSV HOẶC DÁN DANH SÁCH
                  </h3>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Các số điện thoại trong danh sách sẽ được <strong>tự động Phê duyệt</strong> vào hệ thống. Giáo viên nhập đúng số điện thoại đã có trong danh sách sẽ được truy cập sử dụng ngay!
              </p>

              {/* Upload Input */}
              <div className="p-4 bg-slate-950 border border-dashed border-emerald-500/40 rounded-2xl text-center space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleExcelFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="py-2.5 px-5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 text-slate-950 font-cyber font-bold text-xs uppercase rounded-xl transition-all shadow-md inline-flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <Upload className="w-4 h-4" />
                  <span>Chọn File Excel (.xlsx, .xls, .csv)</span>
                </button>
                <p className="text-[11px] text-slate-500">
                  Hệ thống tự động quét tất cả các cột và ô chứa số điện thoại hợp lệ (10 số).
                </p>
              </div>

              {/* Or Paste Textarea */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Hoặc sao chép & dán danh sách số điện thoại tại đây:
                </label>
                <textarea
                  value={importRawText}
                  onChange={(e) => handleParseRawText(e.target.value)}
                  placeholder="Dán văn bản hoặc cột Excel có chứa các số điện thoại (ví dụ: 0912345678, 0987654321)..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Parsed Phones Preview */}
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-emerald-400">
                    Đã nhận diện: <strong>{importPhonesList.length}</strong> số điện thoại hợp lệ
                  </span>
                  {importPhonesList.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setImportPhonesList([]);
                        setImportRawText('');
                      }}
                      className="text-slate-500 hover:text-rose-400 text-[11px] cursor-pointer"
                    >
                      Xóa danh sách
                    </button>
                  )}
                </div>

                {importPhonesList.length > 0 && (
                  <div className="max-h-24 overflow-y-auto p-2 bg-slate-900 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 flex flex-wrap gap-1.5">
                    {importPhonesList.map((phone) => (
                      <span key={phone} className="px-2 py-0.5 bg-slate-800 rounded border border-slate-700">
                        {phone}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Key assignment option */}
              <div className="flex items-center justify-between gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs">
                <div>
                  <div className="font-bold text-white">Chế độ cấp quyền khi nhập:</div>
                  <div className="text-[11px] text-slate-400">Chọn hình thức kích hoạt cho danh sách này</div>
                </div>
                <select
                  value={importKeyType}
                  onChange={(e) => setImportKeyType(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-medium text-slate-200 focus:outline-none focus:border-emerald-400 cursor-pointer"
                >
                  <option value="trial">Phê duyệt (Dùng thử 20 lượt)</option>
                  <option value="unlimited">Cấp Key Vĩnh Viễn luôn</option>
                  <option value="500">Cấp Key 500 lượt</option>
                  <option value="200">Cấp Key 200 lượt</option>
                </select>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Hủy
                </button>

                <button
                  type="button"
                  disabled={importPhonesList.length === 0 || isImporting}
                  onClick={handleConfirmImportWhitelist}
                  className="py-2.5 px-5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 disabled:opacity-40 text-slate-950 font-cyber font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {isImporting
                      ? 'Đang nhập...'
                      : `Xác nhận phê duyệt (${importPhonesList.length} số)`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
