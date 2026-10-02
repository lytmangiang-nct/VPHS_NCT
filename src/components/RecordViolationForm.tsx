import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Send,
  Eye,
  X,
  FileCheck2,
  MapPin,
  User as UserIcon,
  Tag,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import {
  ALL_CLASSES,
  CLASSES_BY_GRADE,
  Student,
  Teacher,
  User as AppUser,
  VIOLATION_DEFINITIONS,
  ViolationCode,
  ViolationRecord
} from '../types/index.ts';
import { api } from '../services/api.ts';
import { parseToVietnamParts } from '../utils/datetime.ts';

const LOCATION_PRESETS = ['Khu C', 'SHDC', 'Khu Sân khấu', 'Khu Căn tin GV', 'Khác'] as const;

interface RecordViolationFormProps {
  currentUser: AppUser;
  onSuccessNavigate: (violationId: string) => void;
}

export const RecordViolationForm: React.FC<RecordViolationFormProps> = ({
  currentUser,
  onSuccessNavigate
}) => {
  // Pilot class locked to 10C1 by default
  const [selectedClass, setSelectedClass] = useState<string>('10C1');
  const [availableClasses, setAvailableClasses] = useState<string[]>(['10C1']);

  // 1. Tự nhập họ tên học sinh (không có gợi ý datalist)
  const [studentName, setStudentName] = useState<string>('');

  // 2. Mã học sinh: tự động sinh mới theo lớp
  const [studentId, setStudentId] = useState<string>('');
  const [isGeneratingId, setIsGeneratingId] = useState<boolean>(false);

  // 3. Địa điểm (Khu C, SHDC, Khu Sân khấu, Khu Căn tin GV, Khác)
  const [locationPreset, setLocationPreset] = useState<string>('Khu C');
  const [customLocation, setCustomLocation] = useState<string>('');

  // Violation fields
  const [violationCode, setViolationCode] = useState<ViolationCode>('VEHICLE_ON_CAMPUS');
  const [description, setDescription] = useState<string>('');
  const [occurredAtInput, setOccurredAtInput] = useState<string>(() => {
    return parseToVietnamParts(new Date()).htmlInputDateTime;
  });
  const [notes, setNotes] = useState<string>('');

  // Teachers and Config
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [otherRuleText, setOtherRuleText] = useState<string>('');

  // UI States
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedRecord, setSubmittedRecord] = useState<ViolationRecord | null>(null);

  // Tự động sinh mã học sinh mới cho lớp
  const generateNewStudentId = async (className: string) => {
    setIsGeneratingId(true);
    try {
      const res = await api.getNextStudentId(className);
      if (res?.nextId) {
        setStudentId(res.nextId);
      } else {
        const rand = Math.floor(10 + Math.random() * 90);
        setStudentId(`HS${className}${rand}`);
      }
    } catch {
      const rand = Math.floor(10 + Math.random() * 90);
      setStudentId(`HS${className}${rand}`);
    } finally {
      setIsGeneratingId(false);
    }
  };

  useEffect(() => {
    api.getTeachers().then(setTeachers).catch(() => {});
    api.getClasses().then((res) => {
      setAvailableClasses(res.all || ALL_CLASSES);
    }).catch(() => {});
    api.getConfig().then((cfg) => {
      setOtherRuleText(cfg.otherViolationDefaultRule || VIOLATION_DEFINITIONS.OTHER.defaultRule);
    }).catch(() => {});
  }, []);

  // Tự động sinh mã mới khi lớp thay đổi hoặc khi khởi động
  useEffect(() => {
    if (selectedClass) {
      generateNewStudentId(selectedClass);
    }
  }, [selectedClass]);

  const handleClassChange = (newClass: string) => {
    setSelectedClass(newClass);
  };

  const handleStudentNameChange = (val: string) => {
    setStudentName(val);
    if (!studentId && selectedClass) {
      generateNewStudentId(selectedClass);
    }
  };

  const getEffectiveLocation = () => {
    if (locationPreset === 'Khác') {
      return customLocation.trim() || 'Khác';
    }
    return locationPreset;
  };

  const getEffectiveStudentId = () => {
    if (studentId.trim()) return studentId.trim();
    return selectedClass || '10C1';
  };

  const currentTeacher = teachers.find((t) => t.className === selectedClass);
  const currentDef = VIOLATION_DEFINITIONS[violationCode];

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!studentName.trim()) {
      setErrorMessage('Vui lòng nhập họ và tên học sinh vi phạm');
      return;
    }
    if (!studentId.trim()) {
      setErrorMessage('Vui lòng chọn hoặc nhập Mã học sinh / Lớp');
      return;
    }
    if (locationPreset === 'Khác' && !customLocation.trim()) {
      setErrorMessage('Vui lòng nhập tên khu vực / địa điểm cụ thể khi chọn "Khác"');
      return;
    }
    if (violationCode === 'OTHER' && !description.trim()) {
      setErrorMessage('Vui lòng nhập nội dung vi phạm đối với "Lỗi khác"');
      return;
    }

    setIsSubmitting(true);
    const clientViolationId = `v-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const effectiveId = getEffectiveStudentId();
    const effectiveLoc = getEffectiveLocation();

    try {
      const record = await api.createViolation({
        client_violation_id: clientViolationId,
        student_id: effectiveId,
        student_name: studentName.trim(),
        class_name: selectedClass,
        violation_code: violationCode,
        description,
        location: effectiveLoc,
        occurred_at: occurredAtInput,
        notes,
        attachment_urls: []
      });

      setSubmittedRecord(record);
    } catch (err: any) {
      setErrorMessage(err.message || 'Có lỗi xảy ra khi ghi nhận vi phạm');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForNewRecord = () => {
    setSubmittedRecord(null);
    setStudentName('');
    setDescription('');
    setNotes('');
    setOccurredAtInput(parseToVietnamParts(new Date()).htmlInputDateTime);
    generateNewStudentId(selectedClass || '10C1');
  };

  return (
    <div className="w-full">
      {/* SUCCESS SCREEN */}
      {submittedRecord ? (
        <div className="bg-white rounded-xl shadow-xs border border-emerald-200 p-6 text-center space-y-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Đã ghi nhận và gửi qua Google Sheet thành công!
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Học sinh: <strong className="text-slate-800">{submittedRecord.student_name}</strong> &bull; Mã: <span className="font-mono">{submittedRecord.student_id}</span> &bull; Lớp {submittedRecord.class_name}
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-left space-y-2 text-xs max-w-md mx-auto">
            <div className="flex justify-between">
              <span className="text-slate-500">Mã vi phạm:</span>
              <span className="font-mono font-bold text-slate-800">{submittedRecord.violation_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Địa điểm:</span>
              <span className="font-semibold text-slate-800">{submittedRecord.location}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Loại vi phạm:</span>
              <span className="font-medium text-slate-900">{submittedRecord.violation_label}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Hướng xử lý:</span>
              <span className="font-semibold text-amber-700">{submittedRecord.handling_result || submittedRecord.handling_rule}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-200">
              <span className="text-slate-500">Trạng thái Webhook & Sheet:</span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                submittedRecord.sync_status === 'DA_GHI_SHEET' || submittedRecord.sync_status === 'DA_TIEP_NHAN'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {submittedRecord.sync_status === 'DA_GHI_SHEET' || submittedRecord.sync_status === 'DA_TIEP_NHAN'
                  ? '✅ Đã gửi qua Webhook & Sheet'
                  : '⚠️ Chưa gửi (Chưa cài link Webhook)'}
              </span>
            </div>
            {submittedRecord.teacher_name && (
              <div className="flex justify-between">
                <span className="text-slate-500">GVCN:</span>
                <span className="font-semibold text-slate-800">{submittedRecord.teacher_name}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-center gap-2.5 pt-2">
            <button
              onClick={handleResetForNewRecord}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-lg shadow-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <span>+ Ghi nhận tiếp học sinh khác (Lớp {selectedClass})</span>
            </button>
            <button
              onClick={() => onSuccessNavigate(submittedRecord.violation_id)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-lg border border-slate-300 transition cursor-pointer"
            >
              Xem sổ nhật ký đã gửi
            </button>
          </div>
        </div>
      ) : (
        /* STREAMLINED COMPACT FORM */
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <FileCheck2 className="w-5 h-5 text-blue-400" />
              <div>
                <h2 className="text-sm font-bold">Ghi nhận vi phạm</h2>
                <div className="text-[11px] text-slate-300">
                  Ghi nhận nề nếp học sinh &bull; Tự động đồng bộ Google Sheet & Email GVCN
                </div>
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="p-5 space-y-4 text-xs">
            {/* 1. Thông tin học sinh vi phạm */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Họ và tên học sinh - Nhập tự do, không gợi ý */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1 flex items-center gap-1">
                  <UserIcon className="w-3.5 h-3.5 text-blue-600" />
                  Họ và tên học sinh <span className="text-red-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={studentName}
                  onChange={(e) => handleStudentNameChange(e.target.value)}
                  placeholder="Nhập họ và tên học sinh..."
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm bg-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Nhập tên học sinh vi phạm
                </p>
              </div>

              {/* Lớp vi phạm (Chọn từ 28 lớp) */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-blue-600" />
                    Lớp vi phạm (28 lớp) <span className="text-red-500 font-bold">*</span>
                  </span>
                  <span className="text-[10px] text-blue-700 font-semibold">{selectedClass}</span>
                </label>
                <select
                  value={selectedClass}
                  onChange={(e) => handleClassChange(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs font-bold text-blue-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <optgroup label="Khối 10 (9 lớp: 10C1 - 10C9)">
                    {CLASSES_BY_GRADE[10].map((cls) => (
                      <option key={cls} value={cls}>Lớp {cls}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Khối 11 (9 lớp: 11C1 - 11C9)">
                    {CLASSES_BY_GRADE[11].map((cls) => (
                      <option key={cls} value={cls}>Lớp {cls}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Khối 12 (10 lớp: 12C1 - 12C10)">
                    {CLASSES_BY_GRADE[12].map((cls) => (
                      <option key={cls} value={cls}>Lớp {cls}</option>
                    ))}
                  </optgroup>
                </select>

                {/* Real-time Homeroom Teacher (GVCN) Name */}
                {selectedClass && (
                  <div className="mt-1.5 text-xs text-slate-700 flex items-center gap-1.5">
                    <span className="text-slate-500 font-medium">GVCN:</span>
                    <span className="font-bold text-slate-800">
                      {currentTeacher?.teacherName || `Thầy/Cô Chủ nhiệm ${selectedClass}`}
                    </span>
                  </div>
                )}
              </div>

              {/* Mã học sinh - Tự động sinh mới */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Mã học sinh <span className="text-red-500 font-bold">*</span>
                  </span>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded font-semibold font-mono">
                    Tự động sinh
                  </span>
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    required
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value.toUpperCase())}
                    placeholder="Đang sinh mã..."
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs font-mono font-bold text-blue-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    title="Mã học sinh tự động sinh ra theo lớp"
                  />
                  <button
                    type="button"
                    onClick={() => generateNewStudentId(selectedClass)}
                    disabled={isGeneratingId}
                    className="h-9 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 shrink-0 flex items-center justify-center cursor-pointer transition shadow-2xs"
                    title="Bấm để tạo lại mã mới"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingId ? 'animate-spin text-blue-600' : ''}`} />
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Mã mới tạo cho lớp <span className="font-semibold text-blue-700">{selectedClass}</span>
                </p>
              </div>
            </div>

            {/* 2. Địa điểm (Khu C, SHDC, Khu Sân khấu, Khu Căn tin GV, Khác) */}
            <div>
              <label className="block font-semibold text-slate-800 mb-1.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                Địa điểm vi phạm
              </label>

              <div className="flex flex-wrap gap-2">
                {LOCATION_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setLocationPreset(preset)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                      locationPreset === preset
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {/* Nếu chọn Khác thì hiển thị ô nhập tên khu vực */}
              {locationPreset === 'Khác' && (
                <div className="mt-2 animate-in fade-in duration-150">
                  <input
                    type="text"
                    required
                    value={customLocation}
                    onChange={(e) => setCustomLocation(e.target.value)}
                    placeholder="Nhập tên khu vực vi phạm (ví dụ: Nhà thi đấu, Nhà xe học sinh, Cổng phụ...)"
                    className="w-full h-9 px-3 border border-blue-300 bg-blue-50/30 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
              )}
            </div>

            {/* 3. Loại vi phạm (Compact 2x2 grid) */}
            <div>
              <label className="block font-semibold text-slate-800 mb-1.5">
                Loại vi phạm & Hướng xử lý
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setViolationCode('VEHICLE_ON_CAMPUS')}
                  className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                    violationCode === 'VEHICLE_ON_CAMPUS'
                      ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-1 ring-blue-600 font-semibold'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <div className="font-bold text-xs">A. Chạy xe trong sân trường</div>
                  <div className="text-[11px] text-blue-700 mt-1">Đề xuất hạ 1 bậc hạnh kiểm</div>
                </button>

                <button
                  type="button"
                  onClick={() => setViolationCode('PHONE_COMMITMENT')}
                  className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                    violationCode === 'PHONE_COMMITMENT'
                      ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-1 ring-blue-600 font-semibold'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <div className="font-bold text-xs">B. Dùng ĐT SHDC</div>
                  <div className="text-[11px] text-blue-700 mt-1">Đề xuất hạ 1 bậc hạnh kiểm</div>
                </button>

                <button
                  type="button"
                  onClick={() => setViolationCode('PHONE_REPORT')}
                  className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                    violationCode === 'PHONE_REPORT'
                      ? 'border-amber-600 bg-amber-50/70 text-amber-900 ring-1 ring-amber-600 font-semibold'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <div className="font-bold text-xs">C. Dùng điện thoại (Biên bản)</div>
                  <div className="text-[11px] text-amber-800 mt-1">Xử lý theo quy định nhà trường</div>
                </button>

                <button
                  type="button"
                  onClick={() => setViolationCode('OTHER')}
                  className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                    violationCode === 'OTHER'
                      ? 'border-purple-600 bg-purple-50/70 text-purple-900 ring-1 ring-purple-600 font-semibold'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <div className="font-bold text-xs">D. Lỗi khác (Nhập mô tả)</div>
                  <div className="text-[11px] text-purple-700 mt-1">
                    {otherRuleText || 'Theo quyết định nhà trường'}
                  </div>
                </button>
              </div>
            </div>

            {/* 4. Nội dung vi phạm */}
            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                Nội dung vi phạm {violationCode === 'OTHER' && <span className="text-red-600 font-bold">*</span>}
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả cụ thể hành vi vi phạm..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 5. Thời điểm vi phạm & Ghi chú */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-800 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  Thời điểm xảy ra
                </label>
                <input
                  type="datetime-local"
                  value={occurredAtInput}
                  onChange={(e) => setOccurredAtInput(e.target.value)}
                  className="w-full h-9 px-2.5 border border-slate-300 rounded-lg text-xs font-mono bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Ghi chú thêm (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ý thức học sinh, người chứng kiến..."
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm rounded-lg shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang gửi tự động qua Google Sheet...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Ghi nhận & Tự động gửi qua Google Sheet</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
