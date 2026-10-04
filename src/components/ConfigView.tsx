import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Link,
  Save,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Users,
  Code2,
  Mail,
  Copy,
  Check,
  Download,
  Plus,
  RefreshCw,
  Info,
  Upload,
  Cloud
} from 'lucide-react';
import { ALL_CLASSES, AppConfig, Student, Teacher, User } from '../types/index.ts';
import { api } from '../services/api.ts';

interface ConfigViewProps {
  currentUser: User;
  onConfigUpdated: () => void;
}

export const ConfigView: React.FC<ConfigViewProps> = ({ currentUser, onConfigUpdated }) => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [makeWebhookUrl, setMakeWebhookUrl] = useState<string>('');
  const [googleSheetId, setGoogleSheetId] = useState<string>('');
  const [otherRule, setOtherRule] = useState<string>('');
  const [otherSteps, setOtherSteps] = useState<number>(0);
  const [schoolName, setSchoolName] = useState<string>('');

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentClass, setSelectedStudentClass] = useState<string>('10C1');

  // Add student form
  const [newStudentId, setNewStudentId] = useState<string>('');
  const [newStudentName, setNewStudentName] = useState<string>('');

  // UI state
  const [savingConfig, setSavingConfig] = useState<boolean>(false);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testingWebhook, setTestingWebhook] = useState<boolean>(false);
  const [copiedPayload, setCopiedPayload] = useState<boolean>(false);
  const [activeSubTab, setActiveSubTab] = useState<'settings' | 'teachers' | 'students' | 'make_docs' | 'sheets_docs'>('settings');
  const csvConfigInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    try {
      const cfg = await api.getConfig();
      setConfig(cfg);
      setMakeWebhookUrl(cfg.makeWebhookUrl || '');
      setGoogleSheetId(cfg.googleSheetId || '');
      setOtherRule(cfg.otherViolationDefaultRule || '');
      setOtherSteps(cfg.otherViolationDefaultSteps || 0);
      setSchoolName(cfg.schoolName || '');

      const [tchList, stList] = await Promise.all([
        api.getTeachers(),
        api.getStudents({ className: selectedStudentClass })
      ]);
      setTeachers(tchList);
      setStudents(stList);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedStudentClass]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setConfigSuccess(null);
    try {
      await api.updateConfig({
        makeWebhookUrl,
        googleSheetId,
        otherViolationDefaultRule: otherRule,
        otherViolationDefaultSteps: Number(otherSteps) || 0,
        schoolName
      });
      setConfigSuccess('Đã cập nhật cấu hình hệ thống thành công!');
      onConfigUpdated();
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi lưu cấu hình');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!makeWebhookUrl.trim()) {
      setTestResult('Vui lòng nhập URL Webhook Make để kiểm tra');
      return;
    }
    setTestingWebhook(true);
    setTestResult(null);
    try {
      const res = await fetch(makeWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_ping: true,
          timestamp: new Date().toISOString(),
          source: 'SoGhiNhanViPham'
        })
      });
      if (res.ok) {
        setTestResult(`✅ Kết nối Webhook thành công! (Mã phản hồi HTTP ${res.status})`);
      } else {
        setTestResult(`⚠️ Webhook phản hồi mã lỗi HTTP ${res.status}`);
      }
    } catch (err: any) {
      setTestResult(`❌ Không thể kết nối tới Webhook: ${err.message || String(err)}`);
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleUpdateTeacherRow = async (className: string, teacherName: string, email: string) => {
    try {
      await api.updateTeacher(className, { teacherName, email });
      setTeachers((prev) =>
        prev.map((t) => (t.className === className ? { ...t, teacherName, email } : t))
      );
    } catch (err: any) {
      alert(err.message || 'Lỗi khi lưu GVCN');
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentId.trim() || !newStudentName.trim()) {
      alert('Vui lòng nhập mã học sinh và họ tên');
      return;
    }
    try {
      const grade = parseInt(selectedStudentClass.slice(0, 2), 10);
      const added = await api.addStudent({
        id: newStudentId.trim(),
        name: newStudentName.trim(),
        grade,
        className: selectedStudentClass
      });
      setStudents((prev) => [...prev, added]);
      setNewStudentId('');
      setNewStudentName('');
    } catch (err: any) {
      alert(err.message || 'Lỗi khi thêm học sinh');
    }
  };

  const sampleJsonPayload = JSON.stringify(
    {
      schema_version: '1.0.0',
      event_type: 'create_violation',
      violation_id: 'v-b8f2a1c0-2026-4fa1-8f22-123456789abc',
      request_id: 'req-98765432-1234-abcd-ef01-23456789abcd',
      student_id: 'HS100101',
      student_name: 'Nguyễn Văn An',
      class_name: '10C1',
      grade: 10,
      violation_code: 'VEHICLE_ON_CAMPUS',
      violation_label: 'Chạy xe trong khuôn viên nhà trường',
      description: 'Chạy xe đạp điện vào khu vực tượng đài',
      location: 'Sân trường',
      occurred_at: '2026-10-01T07:15:00+07:00',
      recorded_at: '2026-10-01T07:30:00+07:00',
      timezone: 'Asia/Ho_Chi_Minh',
      violation_date: '01/10/2026',
      violation_time: '07:15:00',
      month: 10,
      year: 2026,
      month_key: '10/2026',
      ho_ten: 'Nguyễn Văn An',
      lop: '10C1',
      loai_vi_pham: 'Chạy xe trong khuôn viên nhà trường',
      thang: 10,
      thang_chu: 'Tháng 10',
      email_gvcn: 'nguyenthimai@gmail.com',
      ten_gvcn: 'Cô Nguyễn Thị Mai',
      message: 'Kính gửi Thầy/Cô: Cô Nguyễn Thị Mai (GVCN lớp 10C1),\n\nBCH ĐT thông báo học sinh sau vừa vi phạm nề nếp:\n- Họ và tên học sinh: Nguyễn Văn An\n- Lớp: 10C1\n- Hành vi vi phạm: Chạy xe trong khuôn viên nhà trường\n- Ngày vi phạm: 01/10/2026 (Tháng vi phạm: Tháng 10)\n- Địa điểm: Sân trường\n- Hướng đề xuất xử lý: Đề xuất hạ 1 bậc hạnh kiểm tháng\n- Ghi chú: Không\n\nKính đề nghị Thầy/Cô phối hợp nhắc nhở và giáo dục học sinh.\n\nTrân trọng!\nBCH Đoàn trường THPT Nguyễn Chí Thanh',
      from: 'doantruong.thpt@gmail.com',
      recorded_by_id: 'usr_recorder',
      recorded_by_name: 'Nguyễn Minh Quân (Ban Trật tự Sao đỏ)',
      verification_status: 'DA_XAC_NHAN',
      handling_rule: 'Đề xuất hạ 1 bậc hạnh kiểm tháng cho mỗi lần vi phạm đã xác nhận.',
      proposed_downgrade_steps: 1,
      approved_downgrade_steps: 1,
      decision_status: 'CHUA_XU_LY',
      attachment_urls: [],
      notes: 'Học sinh hợp tác'
    },
    null,
    2
  );

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sampleJsonPayload);
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-blue-600" />
          Cấu hình Hệ thống & Bàn giao Kỹ thuật
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Quản lý kết nối Webhook Make, danh sách GVCN 28 lớp, danh mục học sinh và hồ sơ bàn giao Google Sheets
        </p>
      </div>

      {/* Sub-navigation tabs */}
      <div className="flex border-b border-slate-200 space-x-4 text-xs font-semibold">
        <button
          onClick={() => setActiveSubTab('settings')}
          className={`pb-2.5 transition border-b-2 cursor-pointer ${
            activeSubTab === 'settings'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Cấu hình kết nối & Quy tắc
        </button>
        <button
          onClick={() => setActiveSubTab('teachers')}
          className={`pb-2.5 transition border-b-2 cursor-pointer ${
            activeSubTab === 'teachers'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Danh sách GVCN (28 Lớp)
        </button>
        <button
          onClick={() => setActiveSubTab('students')}
          className={`pb-2.5 transition border-b-2 cursor-pointer ${
            activeSubTab === 'students'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Quản lý Học sinh
        </button>
        <button
          onClick={() => setActiveSubTab('make_docs')}
          className={`pb-2.5 transition border-b-2 cursor-pointer ${
            activeSubTab === 'make_docs'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Hướng dẫn Scenario Make & Payload
        </button>
        <button
          onClick={() => setActiveSubTab('sheets_docs')}
          className={`pb-2.5 transition border-b-2 cursor-pointer ${
            activeSubTab === 'sheets_docs'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Cấu trúc 4 Tab Google Sheets
        </button>
      </div>

      {/* SUB-TAB 1: SETTINGS */}
      {activeSubTab === 'settings' && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-6">
          {!isAdmin && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
              Bạn đang đăng nhập với vai trò <strong>{currentUser.role}</strong>. Chỉ Quản trị viên mới có quyền thay đổi các cài đặt này.
            </div>
          )}

          {configSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{configSuccess}</span>
            </div>
          )}

          <form onSubmit={handleSaveConfig} className="space-y-6">
            {/* Connection URLs */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b pb-2 flex items-center gap-2">
                <Link className="w-4 h-4 text-blue-600" />
                Thông số kết nối Webhook Make & Google Sheets
              </h3>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  MAKE_WEBHOOK_URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    disabled={!isAdmin}
                    placeholder="https://hook.eu2.make.com/xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={makeWebhookUrl}
                    onChange={(e) => setMakeWebhookUrl(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleTestWebhook}
                    disabled={testingWebhook || !makeWebhookUrl.trim()}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition cursor-pointer"
                  >
                    {testingWebhook ? 'Đang test...' : 'Kiểm tra Webhook'}
                  </button>
                </div>
                {testResult && (
                  <p className="text-xs mt-1.5 font-medium">{testResult}</p>
                )}
                {!makeWebhookUrl.trim() && (
                  <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Chưa cấu hình MAKE_WEBHOOK_URL. Khi ghi nhận vi phạm, hệ thống sẽ lưu cục bộ và hiển thị trạng thái "Chưa cấu hình", không giả lập thành công.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  GOOGLE_SHEET_ID
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  placeholder="Ví dụ: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                  value={googleSheetId}
                  onChange={(e) => setGoogleSheetId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  ID của Google Sheets dùng bởi Make scenario để đồng bộ 4 tab: NHAT_KY_VI_PHAM, GVCN, HOC_SINH, XET_HANH_KIEM_THANG.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên trường / Đơn vị
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                />
              </div>
            </div>

            {/* Other violation configuration */}
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 border-b pb-2 flex items-center gap-2">
                <Settings className="w-4 h-4 text-purple-600" />
                Cấu hình mặc định cho "Lỗi khác"
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Hướng xử lý mặc định
                  </label>
                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={otherRule}
                    onChange={(e) => setOtherRule(e.target.value)}
                    placeholder="Ví dụ: Kiểm điểm trước lớp hoặc đề xuất theo tính chất vụ việc"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Số bậc hạ đề xuất mặc định
                  </label>
                  <select
                    disabled={!isAdmin}
                    value={otherSteps}
                    onChange={(e) => setOtherSteps(Number(e.target.value))}
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs bg-white font-bold"
                  >
                    <option value={0}>0 bậc (Chờ quyết định / Không tự hạ)</option>
                    <option value={1}>1 bậc</option>
                    <option value={2}>2 bậc</option>
                  </select>
                </div>
              </div>
            </div>

            {isAdmin && (
              <div className="pt-4 border-t border-slate-200 flex justify-end">
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingConfig ? 'Đang lưu...' : 'Lưu cấu hình hệ thống'}</span>
                </button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* SUB-TAB 2: TEACHERS (28 Classes) */}
      {activeSubTab === 'teachers' && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900">
                  Danh sách Giáo viên chủ nhiệm 28 Lớp (Tab Google Sheet: GVCN)
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Cloud Firestore
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Mỗi lớp có 1 cấu hình GVCN. Dữ liệu tự động đồng bộ thời gian thực vĩnh viễn trên mọi thiết bị.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const csv = api.exportTeachersCsv(teachers);
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'GVCN_28_LOP.csv';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Xuất CSV</span>
              </button>

              <button
                type="button"
                onClick={() => csvConfigInputRef.current?.click()}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                <span>Nhập CSV</span>
              </button>
              <input
                ref={csvConfigInputRef}
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const text = ev.target?.result as string;
                    const res = api.importTeachersCsv(text);
                    setTeachers(res.imported);
                    alert(`Đã nhập thành công ${res.count} lớp từ file CSV!`);
                  };
                  reader.readAsText(file);
                  e.target.value = '';
                }}
                className="hidden"
              />
            </div>
          </div>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-100 z-10">
                <tr className="border-b border-slate-200 text-slate-700 font-bold uppercase text-[11px]">
                  <th className="py-2.5 px-3">Lớp</th>
                  <th className="py-2.5 px-3">Họ và tên GVCN</th>
                  <th className="py-2.5 px-3">Email GVCN</th>
                  <th className="py-2.5 px-3 text-center">Trạng thái</th>
                  <th className="py-2.5 px-3 text-right">Lưu thay đổi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {teachers.map((t) => (
                  <tr key={t.className} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-bold text-blue-700 whitespace-nowrap">{t.className}</td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        disabled={!isAdmin}
                        defaultValue={t.teacherName}
                        id={`name_${t.className}`}
                        className="w-full px-2 py-1 border border-slate-200 rounded text-xs"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="email"
                        disabled={!isAdmin}
                        defaultValue={t.email}
                        placeholder={t.className === '10C9' ? 'Lớp 10C9 đang trống email (để thử THIEU_EMAIL)' : 'gvcn@thpt.edu.vn'}
                        id={`email_${t.className}`}
                        className={`w-full px-2 py-1 border rounded text-xs font-mono ${
                          !t.email ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-200'
                        }`}
                      />
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        t.email ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {t.email ? 'Đang hoạt động' : 'Thiếu email'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right">
                      {isAdmin && (
                        <button
                          onClick={() => {
                            const nameVal = (document.getElementById(`name_${t.className}`) as HTMLInputElement)?.value;
                            const emailVal = (document.getElementById(`email_${t.className}`) as HTMLInputElement)?.value;
                            handleUpdateTeacherRow(t.className, nameVal, emailVal);
                          }}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded text-[11px]"
                        >
                          Lưu
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: STUDENTS */}
      {activeSubTab === 'students' && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                Danh sách Học sinh theo lớp (Tab Google Sheet: HOC_SINH)
              </h3>
              <p className="text-xs text-slate-500">
                Phân biệt học sinh trùng tên bằng Mã học sinh và Lớp
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedStudentClass}
                onChange={(e) => setSelectedStudentClass(e.target.value)}
                className="h-8 px-2 border border-slate-300 rounded bg-white text-xs font-bold text-blue-700"
              >
                {ALL_CLASSES.map((cls) => (
                  <option key={cls} value={cls}>
                    Xem Lớp {cls}
                  </option>
                ))}
              </select>

              <a
                href="/api/sheets-export/HOC_SINH"
                download="HOC_SINH_TOAN_TRUONG.csv"
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Xuất CSV Học sinh</span>
              </a>
            </div>
          </div>

          {/* Add Student Form */}
          {isAdmin && (
            <form onSubmit={handleAddStudent} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap gap-2 items-center text-xs">
              <span className="font-bold text-slate-700">Thêm nhanh học sinh vào lớp {selectedStudentClass}:</span>
              <input
                type="text"
                placeholder="Mã HS (vd: HS100109)"
                value={newStudentId}
                onChange={(e) => setNewStudentId(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded bg-white font-mono text-xs w-36"
              />
              <input
                type="text"
                placeholder="Họ và tên học sinh"
                value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs flex-1 min-w-[150px]"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm</span>
              </button>
            </form>
          )}

          {/* Students Table */}
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 sticky top-0">
                <tr className="border-b border-slate-200 text-slate-700 font-bold uppercase text-[11px]">
                  <th className="py-2.5 px-3">Mã học sinh</th>
                  <th className="py-2.5 px-3">Họ và tên</th>
                  <th className="py-2.5 px-3">Khối</th>
                  <th className="py-2.5 px-3">Lớp</th>
                  <th className="py-2.5 px-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {students.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono font-medium text-slate-800">{s.id}</td>
                    <td className="py-2 px-3 font-bold text-slate-900">{s.name}</td>
                    <td className="py-2 px-3 text-slate-500">Khối {s.grade}</td>
                    <td className="py-2 px-3 font-semibold text-blue-700">{s.className}</td>
                    <td className="py-2 px-3">
                      <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-semibold">
                        Đang học
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: MAKE SCENARIO BLUEPRINT & JSON */}
      {activeSubTab === 'make_docs' && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Hướng dẫn Thiết lập Make Scenario & Mẫu Payload JSON
              </h3>
              <p className="text-xs text-slate-500">
                Tuân thủ quy trình: Webhook → Xác thực → Google Sheets → Tra cứu GVCN → Gửi Email → Cập nhật dòng Sheet
              </p>
            </div>
            <button
              onClick={copyToClipboard}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs rounded-lg border border-slate-300 flex items-center gap-1.5 transition"
            >
              {copiedPayload ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-600" />}
              <span>{copiedPayload ? 'Đã sao chép' : 'Sao chép JSON mẫu'}</span>
            </button>
          </div>

          {/* 7-Step Make Workflow Explanation */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 text-xs">
            <h4 className="font-bold text-slate-800 text-sm">Quy trình 7 bước tiêu chuẩn trong Make:</h4>
            <ol className="list-decimal pl-5 space-y-2 text-slate-700">
              <li>
                <strong>Module 1: Custom Webhook:</strong> Nhận HTTP POST JSON từ backend của ứng dụng.
              </li>
              <li>
                <strong>Module 2: Router / Filter:</strong> Kiểm tra tính hợp lệ của payload (schema_version, violation_id, class_name).
              </li>
              <li>
                <strong>Module 3: Google Sheets - Search Rows:</strong> Tìm kiếm dòng trong tab <code>NHAT_KY_VI_PHAM</code> theo cột <code>violation_id</code> để kiểm tra trùng lặp (Idempotency).
              </li>
              <li>
                <strong>Module 4: Google Sheets - Add / Update Row:</strong> Nếu chưa có thì ghi dòng mới (30 cột). Nếu đã có thì cập nhật đúng dòng đó, không tạo thêm dòng.
              </li>
              <li>
                <strong>Module 5: Google Sheets - Search Row GVCN:</strong> Tra cứu email GVCN trong tab <code>GVCN</code> theo <code>class_name</code> (không lấy email do frontend tự tạo).
              </li>
              <li>
                <strong>Module 6: Gmail / Email - Send an Email:</strong> Gửi email thông báo tới GVCN với tiêu đề:
                <div className="font-mono bg-white p-1 rounded border border-slate-200 my-1 text-slate-900">
                  [Thông báo vi phạm] [{`class_name`}] — [{`student_name`}] — [{`violation_date`}]
                </div>
              </li>
              <li>
                <strong>Module 7: Webhook Response:</strong> Cập nhật trạng thái email vào dòng Google Sheet và trả về mã phản hồi cho backend.
              </li>
            </ol>
          </div>

          {/* JSON Payload preview */}
          <div>
            <h4 className="font-bold text-xs text-slate-700 uppercase mb-2">Mẫu Payload JSON được gửi tới Webhook:</h4>
            <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-[11px] font-mono overflow-x-auto max-h-80">
              {sampleJsonPayload}
            </pre>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: GOOGLE SHEETS TABS SPEC */}
      {activeSubTab === 'sheets_docs' && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-6">
          <div>
            <h3 className="font-bold text-base text-slate-900">
              Cấu trúc 4 Tab Google Sheets Chuẩn Hoá
            </h3>
            <p className="text-xs text-slate-500">
              Tạo Google Sheets mới với 4 tab có tên chính xác như sau:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Tab 1 */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-blue-700 text-sm font-mono">1. NHAT_KY_VI_PHAM</span>
                <a
                  href="/api/sheets-export/NHAT_KY_VI_PHAM"
                  download="NHAT_KY_VI_PHAM.csv"
                  className="text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> Xuất mẫu CSV
                </a>
              </div>
              <p className="text-slate-600 mb-2">Chứa 30 cột dữ liệu vi phạm chi tiết:</p>
              <div className="text-[11px] font-mono text-slate-700 bg-white p-2.5 rounded border border-slate-200 max-h-48 overflow-y-auto space-y-0.5">
                <div>1. Mã vi phạm | 2. Mã học sinh | 3. Họ và tên</div>
                <div>4. Khối | 5. Lớp | 6. Ngày vi phạm (dd/MM/yyyy)</div>
                <div>7. Giờ vi phạm (HH:mm:ss) | 8. Tháng (1..12)</div>
                <div>9. Năm (2026) | 10. Kỳ tháng (MM/yyyy)</div>
                <div>11. Mã loại lỗi | 12. Tên loại lỗi | 13. Nội dung</div>
                <div>14. Địa điểm | 15. Người ghi nhận | 16. Thời điểm ghi nhận</div>
                <div>17. Trạng thái xác nhận | 18. Hướng xử lý</div>
                <div>19. Số bậc đề xuất | 20. Số bậc được duyệt</div>
                <div>21. Trạng thái quyết định | 22. Kết quả xử lý</div>
                <div>23. Email GVCN | 24. Trạng thái gửi email</div>
                <div>25. Thời điểm gửi email | 26. Mã thông báo email</div>
                <div>27. Lỗi đồng bộ hoặc gửi mail | 28. Link minh chứng</div>
                <div>29. Ghi chú | 30. Thời điểm cập nhật</div>
              </div>
            </div>

            {/* Tab 2 */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-blue-700 text-sm font-mono">2. GVCN</span>
                <a
                  href="/api/sheets-export/GVCN"
                  download="GVCN.csv"
                  className="text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> Xuất mẫu CSV
                </a>
              </div>
              <p className="text-slate-600 mb-2">4 cột cấu hình 28 giáo viên chủ nhiệm:</p>
              <div className="text-[11px] font-mono text-slate-700 bg-white p-2.5 rounded border border-slate-200 space-y-1">
                <div>• Cột A: Lớp (10C1 ... 12C10)</div>
                <div>• Cột B: Họ tên GVCN</div>
                <div>• Cột C: Email GVCN</div>
                <div>• Cột D: Đang hoạt động (Có / Không)</div>
              </div>
            </div>

            {/* Tab 3 */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-blue-700 text-sm font-mono">3. HOC_SINH</span>
                <a
                  href="/api/sheets-export/HOC_SINH"
                  download="HOC_SINH.csv"
                  className="text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> Xuất mẫu CSV
                </a>
              </div>
              <p className="text-slate-600 mb-2">5 cột danh bạ học sinh toàn trường:</p>
              <div className="text-[11px] font-mono text-slate-700 bg-white p-2.5 rounded border border-slate-200 space-y-1">
                <div>• Cột A: Mã học sinh (HS100101...)</div>
                <div>• Cột B: Họ và tên</div>
                <div>• Cột C: Khối (10, 11, 12)</div>
                <div>• Cột D: Lớp</div>
                <div>• Cột E: Đang học (Có / Không)</div>
              </div>
            </div>

            {/* Tab 4 */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-blue-700 text-sm font-mono">4. XET_HANH_KIEM_THANG</span>
                <a
                  href="/api/sheets-export/XET_HANH_KIEM_THANG"
                  download="XET_HANH_KIEM_THANG.csv"
                  className="text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> Xuất mẫu CSV
                </a>
              </div>
              <p className="text-slate-600 mb-2">16 cột tổng hợp và xét hạnh kiểm tháng:</p>
              <div className="text-[11px] font-mono text-slate-700 bg-white p-2.5 rounded border border-slate-200 space-y-1">
                <div>• Kỳ tháng, Mã HS, Họ và tên, Lớp</div>
                <div>• Mức đánh giá ban đầu, Số lần chạy xe, ĐT (Cam kết), ĐT (Biên bản), Lỗi khác</div>
                <div>• Tổng số bậc đã xác nhận để tính, Số vụ chờ quyết định</div>
                <div>• Mức đề xuất, Mức được duyệt, Người duyệt, Ngày duyệt, Ghi chú</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
