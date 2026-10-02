import React, { useState } from 'react';
import {
  ClipboardList,
  ShieldAlert,
  Settings,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Users,
  Mail,
  Search,
  Check,
  Edit3,
  Smartphone,
  QrCode,
  Copy,
  ExternalLink
} from 'lucide-react';
import { api } from '../services/api.ts';
import { Teacher } from '../types/index.ts';

const OFFICIAL_SHARED_URL = 'https://ais-pre-4sx3rf535uubyub7pgl4aa-658614430471.asia-east1.run.app';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  config: {
    isWebhookConfigured: boolean;
    isSheetConfigured: boolean;
    makeWebhookUrl: string;
    makeApiKey?: string;
    googleSheetId: string;
    senderEmail?: string;
    senderName?: string;
  } | null;
  onRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  config,
  onRefresh
}) => {
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showMobileSyncModal, setShowMobileSyncModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [webhookInput, setWebhookInput] = useState(config?.makeWebhookUrl || '');
  const [sheetIdInput, setSheetIdInput] = useState(config?.googleSheetId || '');
  const [apiKeyInput, setApiKeyInput] = useState(config?.makeApiKey || '');
  const [senderEmailInput, setSenderEmailInput] = useState(config?.senderEmail || 'doantruong.thpt@gmail.com');
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Teachers List Modal State
  const [showTeachersModal, setShowTeachersModal] = useState(false);
  const [teachersList, setTeachersList] = useState<Teacher[]>([]);
  const [teachersLoading, setTeachersLoading] = useState(false);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [editingTeacherClass, setEditingTeacherClass] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [savingTeacherClass, setSavingTeacherClass] = useState<string | null>(null);
  const [configNotification, setConfigNotification] = useState<string | null>(null);

  const handleOpenConfig = () => {
    setWebhookInput(config?.makeWebhookUrl || '');
    setSheetIdInput(config?.googleSheetId || '');
    setApiKeyInput(config?.makeApiKey || '');
    setSenderEmailInput(config?.senderEmail || 'doantruong.thpt@gmail.com');
    setTestResult(null);
    setShowConfigModal(true);
  };

  const handleOpenTeachers = async () => {
    setShowTeachersModal(true);
    setTeachersLoading(true);
    try {
      const data = await api.getTeachers();
      setTeachersList(data);
    } catch {
      // ignore
    } finally {
      setTeachersLoading(false);
    }
  };

  const handleStartEditTeacher = (t: Teacher) => {
    setEditingTeacherClass(t.className);
    setEditName(t.teacherName || '');
    setEditEmail(t.email || '');
  };

  const handleSaveTeacherRow = async (className: string) => {
    setSavingTeacherClass(className);
    try {
      const res = await api.updateTeacher(className, {
        teacherName: editName.trim(),
        email: editEmail.trim(),
        isActive: true
      });
      if (res?.teacher) {
        setTeachersList((prev) =>
          prev.map((item) => (item.className === className ? { ...item, ...res.teacher } : item))
        );
      }
      setEditingTeacherClass(null);
      setConfigNotification(`Đã lưu thông tin GVCN lớp ${className}!`);
      setTimeout(() => setConfigNotification(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Lỗi lưu thông tin GVCN');
    } finally {
      setSavingTeacherClass(null);
    }
  };

  const handleSaveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateConfig({
        makeWebhookUrl: webhookInput.trim(),
        makeApiKey: apiKeyInput.trim(),
        googleSheetId: sheetIdInput.trim(),
        senderEmail: senderEmailInput.trim()
      });

      if (webhookInput.trim().startsWith('http')) {
        fetch(webhookInput.trim(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'connection_test',
            timestamp: new Date().toISOString(),
            ho_ten: 'Học sinh kiểm tra',
            'Họ và tên': 'Học sinh kiểm tra',
            lop: '10C1',
            'Lớp': '10C1',
            loai_vi_pham: 'Chạy xe trong khuôn viên nhà trường',
            'Loại vi phạm': 'Chạy xe trong khuôn viên nhà trường',
            ngay_thang_nam: '02/10/2026',
            'Ngày tháng năm': '02/10/2026',
            thang: 10,
            'Tháng': 10,
            dia_diem: 'Khu C',
            'Địa điểm': 'Khu C',
            huong_xu_ly: 'Đề xuất hạ 1 bậc hạnh kiểm tháng',
            'Hướng xử lý': 'Đề xuất hạ 1 bậc hạnh kiểm tháng',
            email_gvcn: senderEmailInput.trim() || 'lytm.angiang@gmail.com',
            'Email GVCN': senderEmailInput.trim() || 'lytm.angiang@gmail.com',
            google_sheet_id: sheetIdInput.trim() || 'Vipham',
            sheet_id: sheetIdInput.trim() || 'Vipham',
            from: senderEmailInput.trim() || 'lytm.angiang@gmail.com',
            email_nguoi_gui: senderEmailInput.trim() || 'lytm.angiang@gmail.com',
            ghi_chu: 'Kiểm tra kết nối Make Webhook & Google Sheet'
          })
        }).catch(() => {});
      }

      onRefresh();
      setShowConfigModal(false);
      setConfigNotification('Đã lưu cấu hình và kết nối Webhook / Google Sheet thành công!');
      setTimeout(() => setConfigNotification(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Lỗi lưu cấu hình');
    } finally {
      setSaving(false);
    }
  };

  const handleTestPing = async () => {
    if (!webhookInput.trim()) {
      setTestResult('Vui lòng nhập link Webhook');
      return;
    }
    setTestResult('Đang kiểm tra kết nối...');
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKeyInput.trim()) {
        headers['Authorization'] = `Bearer ${apiKeyInput.trim()}`;
        headers['x-make-apikey'] = apiKeyInput.trim();
      }
      const res = await fetch(webhookInput.trim(), {
        method: 'POST',
        headers,
        body: JSON.stringify({ test_ping: true, timestamp: new Date().toISOString() })
      });
      if (res.ok) {
        setTestResult(`✅ Kết nối thành công (HTTP ${res.status})! Webhook đã sẵn sàng nhận dữ liệu.`);
      } else {
        const txt = await res.text().catch(() => '');
        if (res.status === 401) {
          setTestResult('⚠️ Lỗi 401 Unauthorized: Webhook trên Make đang bật chế độ bảo mật (chặn truy cập). Vui lòng tắt IP restriction / API Key trên Make hoặc dán API Key vào ô dưới.');
        } else {
          setTestResult(`⚠️ Webhook trả về HTTP ${res.status}: ${txt || res.statusText}`);
        }
      }
    } catch (e: any) {
      setTestResult(`❌ Lỗi kết nối: ${e.message || String(e)}`);
    }
  };

  const filteredTeachers = teachersList.filter((t) => {
    const q = teacherSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      t.className.toLowerCase().includes(q) ||
      (t.teacherName && t.teacherName.toLowerCase().includes(q)) ||
      (t.email && t.email.toLowerCase().includes(q))
    );
  });

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs w-full">
      <div className="w-full px-3 sm:px-6 lg:px-8">
        {/* Main top bar */}
        <div className="flex items-center justify-between py-2.5">
          {/* Logo & Title */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-700 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              Đ
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                  Ghi nhận vi phạm &bull; Tự động đồng bộ Google Sheet
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  Toàn màn hình
                </span>
              </div>
            </div>
          </div>

          {/* Right Status Badges & Controls */}
          <div className="flex items-center gap-2 text-xs">
            {/* Teacher Emails 28 Classes Button */}
            <button
              onClick={handleOpenTeachers}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              title="Xem danh sách Giáo viên chủ nhiệm của 28 lớp"
            >
              <Users className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Danh sách GVCN 28 lớp</span>
              <span className="sm:hidden">GVCN</span>
            </button>

            {/* Webhook Status Button */}
            <button
              onClick={handleOpenConfig}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border transition cursor-pointer ${
                config?.isWebhookConfigured
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
              }`}
              title="Nhấp để cấu hình đường dẫn Webhook gửi qua Sheet"
            >
              {config?.isWebhookConfigured ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">Đã nối Webhook Sheet</span>
                  <span className="sm:hidden">Đã nối</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span className="hidden sm:inline">Cài link Webhook Sheet</span>
                  <span className="sm:hidden">Cài link</span>
                </>
              )}
            </button>

            {/* Refresh */}
            <button
              onClick={onRefresh}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition cursor-pointer"
              title="Làm mới dữ liệu"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs - Always visible across desktop and mobile */}
        <nav className="flex space-x-2 border-t border-slate-100 pt-1.5 pb-1.5">
          <button
            onClick={() => setActiveTab('record')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition cursor-pointer ${
              activeTab === 'record'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Ghi nhận vi phạm</span>
          </button>

          <button
            onClick={() => setActiveTab('log')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition cursor-pointer ${
              activeTab === 'log'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Nhật ký vi phạm</span>
          </button>
        </nav>
      </div>

      {/* TEACHERS LIST MODAL (28 CLASSES) */}
      {showTeachersModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-5 border border-slate-200 space-y-4 text-xs max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b pb-2">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-600" />
                  Danh sách Giáo viên Chủ nhiệm (28 lớp)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Danh sách thông tin Giáo viên chủ nhiệm phân công theo từng lớp.
                </p>
              </div>
              <button
                onClick={() => setShowTeachersModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={teacherSearch}
                onChange={(e) => setTeacherSearch(e.target.value)}
                placeholder="Tìm theo tên lớp, tên giáo viên, địa chỉ email..."
                className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Teachers Table */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg">
              {teachersLoading ? (
                <div className="p-8 text-center text-slate-500">Đang tải danh sách 28 lớp...</div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 text-slate-700 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3 font-semibold">Lớp</th>
                      <th className="py-2 px-3 font-semibold">Họ tên GVCN</th>
                      <th className="py-2 px-3 font-semibold">Email nhận thông báo</th>
                      <th className="py-2 px-3 font-semibold text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTeachers.map((t) => {
                      const isEditing = editingTeacherClass === t.className;
                      return (
                        <tr key={t.className} className="hover:bg-slate-50/80">
                          <td className="py-2 px-3 font-bold text-blue-700">{t.className}</td>
                          <td className="py-2 px-3">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full px-2 py-1 border border-blue-400 rounded text-xs bg-white"
                              />
                            ) : (
                              <span className="font-medium text-slate-800">{t.teacherName}</span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {isEditing ? (
                              <input
                                type="email"
                                value={editEmail}
                                onChange={(e) => setEditEmail(e.target.value)}
                                className="w-full px-2 py-1 border border-blue-400 rounded text-xs font-mono text-blue-800 bg-white"
                              />
                            ) : (
                              <span className="font-mono text-slate-600">{t.email || '(Chưa có)'}</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  disabled={savingTeacherClass === t.className}
                                  onClick={() => handleSaveTeacherRow(t.className)}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold text-[11px] flex items-center gap-1 cursor-pointer"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>{savingTeacherClass === t.className ? 'Lưu...' : 'Lưu'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingTeacherClass(null)}
                                  className="px-2 py-1 border border-slate-300 rounded text-slate-600 hover:bg-slate-100 text-[11px] cursor-pointer"
                                >
                                  Hủy
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleStartEditTeacher(t)}
                                className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-blue-700 rounded text-[11px] font-semibold flex items-center gap-1 ml-auto cursor-pointer"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Sửa</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowTeachersModal(false)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK CONFIG MODAL */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 border border-slate-200 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-blue-600" />
                Cấu hình kết nối Webhook Make / Google Sheet
              </h3>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveWebhook} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Đường dẫn MAKE_WEBHOOK_URL hoặc Google Apps Script URL:
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://hook.eu1.make.com/... hoặc https://script.google.com/macros/s/.../exec"
                  value={webhookInput}
                  onChange={(e) => setWebhookInput(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-300 rounded font-mono text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Mọi trường dữ liệu và email chủ nhiệm tương ứng sẽ tự động gửi thẳng qua link này.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  GOOGLE_SHEET_ID (Tên bảng tính hoặc ID):
                </label>
                <input
                  type="text"
                  placeholder="Vipham hoặc ID chuỗi dài trên thanh địa chỉ Google Sheet"
                  value={sheetIdInput}
                  onChange={(e) => setSheetIdInput(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-300 rounded font-mono text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Email người gửi (Trường 'From' cho Make / Email):
                </label>
                <input
                  type="email"
                  placeholder="Ví dụ: doantruong.thpt@gmail.com"
                  value={senderEmailInput}
                  onChange={(e) => setSenderEmailInput(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-300 rounded font-mono text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Trường này sẽ được truyền qua Webhook với tên <code>from</code> và <code>email_nguoi_gui</code> để tránh lỗi trống ô From khi gửi mail.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  API Key Make (Tùy chọn - nếu Webhook bật bảo mật):
                </label>
                <input
                  type="password"
                  placeholder="Dán API Key nếu webhook Make có bật xác thực"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-300 rounded font-mono text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {testResult && (
                <div className="p-2.5 bg-slate-50 border rounded text-[11px] font-medium text-slate-700 leading-relaxed">
                  {testResult}
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleTestPing}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-xs transition cursor-pointer"
                >
                  Kiểm tra thử link
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowConfigModal(false)}
                    className="px-3 py-1.5 border border-slate-300 rounded text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow-xs transition cursor-pointer"
                  >
                    {saving ? 'Đang lưu...' : 'Lưu kết nối'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {configNotification && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-lg shadow-xl text-xs flex items-center gap-2 border border-slate-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{configNotification}</span>
          <button onClick={() => setConfigNotification(null)} className="ml-2 text-slate-400 hover:text-white cursor-pointer">✕</button>
        </div>
      )}
    </header>
  );
};
