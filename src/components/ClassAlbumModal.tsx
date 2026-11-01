import React, { useRef, useState } from 'react';
import {
  X,
  Upload,
  Sparkles,
  Trash2,
  CheckCircle2,
  Users,
  Image as ImageIcon,
  Check,
  RotateCcw,
} from 'lucide-react';
import { StudentPhotoItem } from '../types';
import { sound } from '../utils/audio';

interface ClassAlbumModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: StudentPhotoItem[];
  onSetStudents: (students: StudentPhotoItem[]) => void;
  onSelectAlbumMode: () => void;
  isAlbumModeActive: boolean;
}

// Clean filename into student name or number
const cleanStudentName = (fileName: string, index: number): string => {
  // Remove file extension
  let base = fileName.replace(/\.[^/.]+$/, '');
  // Replace underscores and hyphens with spaces
  base = base.replace(/[_-]+/g, ' ').trim();
  // Strip common prefixes like "01", "HS01", "student"
  const cleaned = base.replace(/^(hs|hoc sinh|student|st|\d+)\s*/i, '').trim();
  if (cleaned.length >= 2) {
    // Capitalize words
    return cleaned
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return `Học sinh #${index + 1}`;
};

// 30 Sample classroom students for instant 1-click test
const SAMPLE_STUDENTS: { name: string; avatarUrl: string }[] = [
  { name: 'Nguyễn Văn An', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=240&auto=format&fit=crop&q=80' },
  { name: 'Trần Thị Mai', avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=240&auto=format&fit=crop&q=80' },
  { name: 'Lê Hoàng Nam', avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=240&auto=format&fit=crop&q=80' },
  { name: 'Phạm Thu Trang', avatarUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=240&auto=format&fit=crop&q=80' },
  { name: 'Hoàng Minh Đức', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=240&auto=format&fit=crop&q=80' },
  { name: 'Vũ Bảo Ngọc', avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=240&auto=format&fit=crop&q=80' },
  { name: 'Đặng Tuấn Kiệt', avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=240&auto=format&fit=crop&q=80' },
  { name: 'Bùi Phương Linh', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=240&auto=format&fit=crop&q=80' },
  { name: 'Ngô Quốc Huy', avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=240&auto=format&fit=crop&q=80' },
  { name: 'Đỗ Thùy Dung', avatarUrl: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=240&auto=format&fit=crop&q=80' },
  { name: 'Dương Thành Long', avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=240&auto=format&fit=crop&q=80' },
  { name: 'Hồ Kim Ngân', avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=240&auto=format&fit=crop&q=80' },
  { name: 'Đinh Hữu Phước', avatarUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=240&auto=format&fit=crop&q=80' },
  { name: 'Lý Khánh Huyền', avatarUrl: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=240&auto=format&fit=crop&q=80' },
  { name: 'Mai Thế Hùng', avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=240&auto=format&fit=crop&q=80' },
  { name: 'Trịnh Cẩm Tú', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=240&auto=format&fit=crop&q=80' },
  { name: 'Lâm Gia Bảo', avatarUrl: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=240&auto=format&fit=crop&q=80' },
  { name: 'Phan Ánh Dương', avatarUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=240&auto=format&fit=crop&q=80' },
  { name: 'Võ Minh Quân', avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=240&auto=format&fit=crop&q=80' },
  { name: 'Tạ Thảo My', avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=240&auto=format&fit=crop&q=80' },
];

export const ClassAlbumModal: React.FC<ClassAlbumModalProps> = ({
  isOpen,
  onClose,
  students,
  onSetStudents,
  onSelectAlbumMode,
  isAlbumModeActive,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');

  if (!isOpen) return null;

  // Handle MULTIPLE FILES at once
  const handleFilesSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsProcessing(true);

    const newItems: StudentPhotoItem[] = [];
    const fileArray = Array.from(files);

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      if (!file.type.startsWith('image/')) continue;

      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const currentCount = students.length + newItems.length;
      newItems.push({
        id: `student_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`,
        name: cleanStudentName(file.name, currentCount),
        photoUrl: dataUrl,
        called: false,
      });
    }

    onSetStudents([...students, ...newItems]);
    setIsProcessing(false);
    sound.playFanfare();
  };

  const handleLoadSampleClass = () => {
    const samples: StudentPhotoItem[] = SAMPLE_STUDENTS.map((item, idx) => ({
      id: `sample_${idx}_${Date.now()}`,
      name: item.name,
      photoUrl: item.avatarUrl,
      called: false,
    }));
    onSetStudents(samples);
    sound.playFanfare();
  };

  const handleDeleteStudent = (id: string) => {
    onSetStudents(students.filter((s) => s.id !== id));
    sound.playClick();
  };

  const handleResetCalled = () => {
    onSetStudents(students.map((s) => ({ ...s, called: false })));
    sound.playClick();
  };

  const handleClearAll = () => {
    if (window.confirm('Thầy/Cô có chắc chắn muốn xóa toàn bộ ảnh lớp đã tải lên không?')) {
      onSetStudents([]);
      sound.playClick();
    }
  };

  const handleStartEdit = (student: StudentPhotoItem) => {
    setEditingId(student.id);
    setEditingName(student.name);
  };

  const handleSaveEdit = (id: string) => {
    onSetStudents(
      students.map((s) => (s.id === id ? { ...s, name: editingName.trim() || s.name } : s))
    );
    setEditingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-cyan-400/80 rounded-3xl p-5 sm:p-6 shadow-[0_0_60px_rgba(6,182,212,0.4)] text-slate-100 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Glow ambient */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-36 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-400/50 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-cyber text-cyan-400 uppercase tracking-widest">
                  ALBUM ẢNH CẢ LỚP
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono font-bold">
                  {students.length} học sinh
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black font-cyber text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-teal-200 to-emerald-300">
                TẢI ẢNH NHIỀU HỌC SINH CÙNG LÚC
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-2 rounded-full hover:bg-slate-800"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Middle Controls & Actions */}
        <div className="py-3 flex flex-wrap items-center justify-between gap-2.5 shrink-0 border-b border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            {/* BIG MULTIPLE FILE PICKER BUTTON */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="py-2 px-4 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-cyber font-bold text-xs rounded-xl shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              <span>{isProcessing ? 'Đang đọc ảnh...' : 'CHỌN NHIỀU ẢNH (CẢ LỚP)'}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFilesSelect(e.target.files)}
            />

            {/* Quick Sample Button */}
            <button
              onClick={handleLoadSampleClass}
              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 border border-cyan-500/30 text-cyan-300 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
              <span>Nạp mẫu 20 học sinh</span>
            </button>
          </div>

          {/* Album Mode Activation & Batch Reset */}
          <div className="flex items-center gap-2">
            {students.length > 0 && (
              <>
                <button
                  onClick={handleResetCalled}
                  title="Đặt lại trạng thái chưa gọi cho cả lớp"
                  className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Gọi lại tất cả</span>
                </button>
                <button
                  onClick={handleClearAll}
                  title="Xóa danh sách"
                  className="py-1.5 px-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs rounded-lg transition-colors flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa hết</span>
                </button>
              </>
            )}

            <button
              onClick={() => {
                onSelectAlbumMode();
                sound.playFanfare();
                onClose();
              }}
              disabled={students.length === 0}
              className={`py-2 px-4 rounded-xl text-xs font-cyber font-bold flex items-center gap-2 transition-all shadow-md ${
                isAlbumModeActive
                  ? 'bg-emerald-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.5)]'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white disabled:opacity-50'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isAlbumModeActive ? 'ĐANG DÙNG CHẾ ĐỘ ALBUM' : 'BẬT VÒNG QUAY ALBUM NÀY'}</span>
            </button>
          </div>
        </div>

        {/* Student Gallery Grid */}
        <div className="flex-1 overflow-y-auto py-4 px-1">
          {students.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-cyan-500/30 rounded-2xl bg-slate-950/40">
              <div className="w-16 h-16 rounded-2xl bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-cyan-400 mb-3 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
                <ImageIcon className="w-8 h-8" />
              </div>
              <h3 className="font-cyber font-bold text-white text-base mb-1">
                CHƯA CÓ ẢNH HỌC SINH NÀO
              </h3>
              <p className="text-xs text-slate-400 max-w-md mb-4 leading-relaxed">
                Thầy/Cô có thể nhấn nút <strong>"CHỌN NHIỀU ẢNH (CẢ LỚP)"</strong> để tải cùng lúc hàng chục ảnh thẻ hoặc ảnh chụp chân dung của học sinh trong lớp. Tên học sinh sẽ được tự động trích xuất từ tên file ảnh!
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="py-2 px-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-cyber font-bold text-xs rounded-xl shadow-md transition-all"
                >
                  Chọn ảnh từ máy tính
                </button>
                <button
                  onClick={handleLoadSampleClass}
                  className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold rounded-xl border border-cyan-500/30 transition-all"
                >
                  Thử nạp 20 ảnh mẫu
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {students.map((student, idx) => (
                <div
                  key={student.id}
                  className={`relative group bg-slate-950/80 rounded-2xl border transition-all p-2.5 flex flex-col items-center text-center ${
                    student.called
                      ? 'border-slate-800 opacity-60'
                      : 'border-cyan-500/40 hover:border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.1)]'
                  }`}
                >
                  {/* Photo thumbnail */}
                  <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-2 bg-slate-900 border border-slate-700">
                    <img
                      src={student.photoUrl}
                      alt={student.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Order badge */}
                    <div className="absolute top-1.5 left-1.5 bg-slate-950/90 border border-cyan-500/60 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold text-cyan-300">
                      #{idx + 1}
                    </div>

                    {/* Called badge */}
                    {student.called && (
                      <div className="absolute inset-0 bg-slate-950/75 flex items-center justify-center">
                        <span className="bg-rose-500/90 text-white text-[10px] font-cyber px-2 py-0.5 rounded-md">
                          ĐÃ GỌI
                        </span>
                      </div>
                    )}

                    {/* Delete single button on hover */}
                    <button
                      onClick={() => handleDeleteStudent(student.id)}
                      title="Xóa học sinh này"
                      className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 p-1 rounded-md bg-rose-600/90 hover:bg-rose-500 text-white transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Name or inline editor */}
                  {editingId === student.id ? (
                    <div className="w-full flex items-center gap-1">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(student.id)}
                        autoFocus
                        className="w-full bg-slate-900 border border-cyan-400 text-white text-xs rounded px-1.5 py-0.5 text-center focus:outline-none"
                      />
                      <button
                        onClick={() => handleSaveEdit(student.id)}
                        className="p-1 bg-cyan-500 text-slate-950 rounded"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => handleStartEdit(student)}
                      title="Bấm để sửa tên"
                      className="w-full text-xs font-semibold text-slate-200 truncate cursor-pointer hover:text-cyan-300 transition-colors"
                    >
                      {student.name}
                    </div>
                  )}

                  <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                    {student.called ? 'Đã lên bảng' : 'Sẵn sàng quay'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Tip & Action */}
        <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>Thầy/Cô có thể đổi tên học sinh bằng cách bấm trực tiếp vào tên dưới mỗi ảnh.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="py-2 px-5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
