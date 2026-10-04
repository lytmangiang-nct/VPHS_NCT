import React, { useState, useEffect } from 'react';
import {
  Search,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  Ban,
  FileCheck,
  Eye,
  X,
  FileSpreadsheet,
  Trash2
} from 'lucide-react';
import {
  User,
  ViolationRecord
} from '../types/index.ts';
import { api } from '../services/api.ts';
import { formatVietnamDisplay } from '../utils/datetime.ts';

interface ViolationLogViewProps {
  currentUser: User;
  highlightId?: string | null;
}

export const ViolationLogView: React.FC<ViolationLogViewProps> = ({
  currentUser,
  highlightId
}) => {
  const [violations, setViolations] = useState<ViolationRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters - default to pilot class 10C1
  const [search, setSearch] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('10C1');
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('10/2026');
  const [selectedCode, setSelectedCode] = useState<string>('');

  // Selected for Details / Decision Modal
  const [selectedRecord, setSelectedRecord] = useState<ViolationRecord | null>(null);

  // Cancel Modal State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('');

  // In-app Delete Modal State (replaces blocked window.confirm)
  const [recordToDelete, setRecordToDelete] = useState<ViolationRecord | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const fetchViolations = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (selectedClass) params.class_name = selectedClass;
      if (selectedMonthKey) params.month_key = selectedMonthKey;
      if (selectedCode) params.violation_code = selectedCode;
      if (search) params.search = search;

      const data = await api.getViolations(params);
      setViolations(data);

      if (highlightId) {
        const found = data.find((v) => v.violation_id === highlightId);
        if (found) setSelectedRecord(found);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchViolations();
    const unsub = api.subscribeViolations((liveViolations) => {
      let filtered = liveViolations;
      if (selectedClass) filtered = filtered.filter((v) => v.class_name === selectedClass);
      if (selectedMonthKey) filtered = filtered.filter((v) => v.month_key === selectedMonthKey);
      if (selectedCode) filtered = filtered.filter((v) => v.violation_code === selectedCode);
      if (search) {
        const q = search.toLowerCase().trim();
        filtered = filtered.filter(
          (v) =>
            v.student_name.toLowerCase().includes(q) ||
            v.student_id.toLowerCase().includes(q) ||
            v.description.toLowerCase().includes(q) ||
            v.violation_id.toLowerCase().includes(q)
        );
      }
      setViolations(filtered);
    });
    return () => unsub();
  }, [selectedClass, selectedMonthKey, selectedCode, search]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchViolations();
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    const id = recordToDelete.violation_id;
    const studentName = recordToDelete.student_name;
    const className = recordToDelete.class_name;
    setActionLoading(true);
    try {
      // Optimistically remove from state immediately
      setViolations((prev) => prev.filter((item) => item.violation_id !== id));
      if (selectedRecord?.violation_id === id) {
        setSelectedRecord(null);
      }
      setRecordToDelete(null);

      await api.deleteViolation(id);
      setToastMessage(`Đã xóa vĩnh viễn vi phạm của học sinh "${studentName}" (${className}).`);
      setTimeout(() => setToastMessage(null), 4000);
      await fetchViolations();
    } catch (err: any) {
      console.error('Delete error:', err);
      setToastMessage(err.message || 'Lỗi khi xóa vi phạm');
      setTimeout(() => setToastMessage(null), 4000);
      await fetchViolations();
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenCancel = (v: ViolationRecord) => {
    setSelectedRecord(v);
    setCancelReason('');
    setIsCancelModalOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!selectedRecord) return;
    if (!cancelReason.trim()) {
      alert('Vui lòng nhập lý do hủy vụ việc');
      return;
    }
    setActionLoading(true);
    try {
      await api.cancelViolation(selectedRecord.violation_id, cancelReason.trim());
      setIsCancelModalOpen(false);
      await fetchViolations();
      setSelectedRecord({
        ...selectedRecord,
        verification_status: 'DA_HUY',
        decision_status: 'DA_XU_LY',
        approved_downgrade_steps: 0,
        handling_result: `Đã hủy vụ việc. Lý do: ${cancelReason.trim()}`
      });
    } catch (err: any) {
      alert(err.message || 'Lỗi khi hủy vụ việc');
    } finally {
      setActionLoading(false);
    }
  };

  const getVerificationBadge = (status: string) => {
    switch (status) {
      case 'DA_XAC_NHAN':
        return <span className="text-emerald-700 font-semibold text-[11px] flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Đã xác nhận</span>;
      case 'CHO_XAC_NHAN':
        return <span className="text-amber-700 font-semibold text-[11px] flex items-center gap-1"><Clock className="w-3 h-3" /> Chờ xác nhận</span>;
      case 'DA_HUY':
        return <span className="text-red-700 font-bold text-[11px] flex items-center gap-1 line-through"><Ban className="w-3 h-3" /> Đã hủy</span>;
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
            <FileCheck className="w-4 h-4 text-blue-600" />
            Nhật ký vi phạm
          </h2>
          <p className="text-[11px] text-slate-500">
            Dữ liệu thí điểm lớp <strong>{selectedClass || 'Toàn trường'}</strong> &bull; Kỳ tháng {selectedMonthKey}
          </p>
        </div>

        <a
          href="/api/sheets-export/NHAT_KY_VI_PHAM"
          download="NHAT_KY_VI_PHAM.csv"
          className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded border border-slate-300 shadow-2xs flex items-center gap-1 transition"
        >
          <Download className="w-3.5 h-3.5 text-emerald-600" />
          <span>Xuất CSV Sheet</span>
        </a>
      </div>

      {/* Streamlined Filter Bar */}
      <div className="bg-white rounded-lg shadow-2xs border border-slate-200 p-3 flex flex-wrap gap-2 items-center text-xs">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Tìm theo tên học sinh, mã HS, nội dung..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded text-xs bg-white"
          />
        </form>

        {/* Class Filter */}
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="h-8 px-2 border border-slate-300 rounded bg-white font-bold text-blue-700"
        >
          <option value="10C1">Lớp 10C1 (Mẫu)</option>
          <option value="">Tất cả các lớp</option>
        </select>

        {/* Month Filter */}
        <select
          value={selectedMonthKey}
          onChange={(e) => setSelectedMonthKey(e.target.value)}
          className="h-8 px-2 border border-slate-300 rounded bg-white font-semibold"
        >
          <option value="10/2026">Tháng 10/2026</option>
          <option value="09/2026">Tháng 09/2026</option>
          <option value="11/2026">Tháng 11/2026</option>
        </select>

        {/* Code Filter */}
        <select
          value={selectedCode}
          onChange={(e) => setSelectedCode(e.target.value)}
          className="h-8 px-2 border border-slate-300 rounded bg-white text-slate-700"
        >
          <option value="">Tất cả lỗi</option>
          <option value="VEHICLE_ON_CAMPUS">Chạy xe</option>
          <option value="PHONE_COMMITMENT">Dùng ĐT SHDC</option>
          <option value="PHONE_REPORT">ĐT (Biên bản)</option>
          <option value="OTHER">Lỗi khác</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-2xs border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-xs">Đang tải nhật ký...</div>
        ) : violations.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto mb-1" />
            Không có vi phạm nào trong bộ lọc này.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[11px] uppercase">
                  <th className="py-2 px-3">Thời gian</th>
                  <th className="py-2 px-3">Học sinh</th>
                  <th className="py-2 px-3">Lớp</th>
                  <th className="py-2 px-3">Loại vi phạm</th>
                  <th className="py-2 px-3">Hướng xử lý</th>
                  <th className="py-2 px-3">Tên GVCN</th>
                  <th className="py-2 px-3">Mức hạ HK</th>
                  <th className="py-2 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {violations.map((v) => {
                  const isHighlighted = v.violation_id === highlightId;
                  const isCancelled = v.verification_status === 'DA_HUY';

                  return (
                    <tr
                      key={v.violation_id}
                      className={`hover:bg-slate-50 transition ${
                        isHighlighted ? 'bg-amber-50 font-medium' : ''
                      } ${isCancelled ? 'opacity-60 bg-slate-50' : ''}`}
                    >
                      <td className="py-2 px-3 whitespace-nowrap text-slate-800">
                        {v.violation_date} <span className="text-[10px] text-slate-500 font-mono">{v.violation_time}</span>
                      </td>
                      <td className="py-2 px-3">
                        <span className="font-bold text-slate-900">{v.student_name}</span>
                        <span className="text-[10px] text-slate-500 font-mono ml-1">({v.student_id})</span>
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200 text-[11px]">
                          {v.class_name}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-medium text-slate-800">{v.violation_label}</div>
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap font-medium text-slate-700">
                        {v.handling_result || v.handling_rule}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap font-medium text-slate-800">
                        {v.teacher_name || `GVCN ${v.class_name}`}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        {v.proposed_downgrade_steps > 0 ? (
                          <span className="text-amber-800 font-semibold bg-amber-50 px-1.5 py-0.5 rounded text-[10px] border border-amber-200">
                            -{v.proposed_downgrade_steps} bậc HK
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Theo quy định</span>
                        )}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-right space-x-1.5">
                        <button
                          onClick={() => setSelectedRecord(v)}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded text-[11px] cursor-pointer"
                        >
                          Xem
                        </button>
                        <button
                          onClick={() => setRecordToDelete(v)}
                          disabled={actionLoading}
                          className="px-2 py-0.5 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded text-[11px] border border-red-200 inline-flex items-center gap-1 cursor-pointer transition"
                          title="Xóa vi phạm này"
                        >
                          <Trash2 className="w-3 h-3 text-red-500" />
                          <span>Xóa</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* COMPACT DETAIL MODAL */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 border border-slate-200 space-y-3 text-xs">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-sm text-slate-900">Chi tiết vi phạm</h3>
              <button onClick={() => setSelectedRecord(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Mã vi phạm:</span>
                <span className="font-mono font-bold text-slate-800">{selectedRecord.violation_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Học sinh:</span>
                <span className="font-bold text-slate-900">{selectedRecord.student_name} ({selectedRecord.student_id})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Lớp:</span>
                <span className="font-bold text-blue-700">{selectedRecord.class_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Thời gian vi phạm:</span>
                <span>{selectedRecord.violation_date} lúc {selectedRecord.violation_time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Loại lỗi:</span>
                <span className="font-semibold text-slate-800">{selectedRecord.violation_label}</span>
              </div>
              {selectedRecord.description && (
                <div className="pt-1 border-t border-slate-200">
                  <span className="text-slate-500 block mb-0.5">Mô tả:</span>
                  <p className="bg-white p-2 rounded border border-slate-200 text-slate-800">{selectedRecord.description}</p>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span className="text-slate-500">Giáo viên chủ nhiệm:</span>
                <span className="font-bold text-slate-800">{selectedRecord.teacher_name || `GVCN ${selectedRecord.class_name}`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Hướng xử lý:</span>
                <span className="font-bold text-amber-700">{selectedRecord.handling_result || selectedRecord.handling_rule}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setRecordToDelete(selectedRecord)}
                disabled={actionLoading}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded font-semibold flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa vi phạm</span>
              </button>
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-3 py-1.5 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM IN-APP DELETE CONFIRMATION MODAL (Replaces blocked window.confirm) */}
      {recordToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-5 border border-slate-200 space-y-4 text-xs">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-sm text-slate-900">Xác nhận xóa vi phạm</h3>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  Bạn có chắc chắn muốn xóa bản ghi vi phạm của học sinh{' '}
                  <strong className="text-slate-900">{recordToDelete.student_name}</strong> (Lớp{' '}
                  <strong className="text-blue-700">{recordToDelete.class_name}</strong>)?
                </p>
                <div className="mt-2.5 p-2 bg-slate-50 rounded-lg border border-slate-200 text-slate-600 text-[11px] space-y-1">
                  <div>• Hành vi: <span className="font-semibold text-slate-800">{recordToDelete.violation_label}</span></div>
                  <div>• Thời gian: {recordToDelete.violation_date} {recordToDelete.violation_time}</div>
                  <div>• GVCN: {recordToDelete.teacher_name || `Lớp ${recordToDelete.class_name}`}</div>
                </div>
                <p className="text-red-600 font-medium text-[11px] mt-2">
                  ⚠️ Dữ liệu sẽ bị xóa hoàn toàn khỏi hệ thống.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setRecordToDelete(null)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{actionLoading ? 'Đang xóa...' : 'Xác nhận xóa'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-lg shadow-xl text-xs flex items-center gap-2 border border-slate-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-slate-400 hover:text-white cursor-pointer">✕</button>
        </div>
      )}

      {/* CANCEL MODAL */}
      {isCancelModalOpen && selectedRecord && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-4 border border-slate-200 space-y-3 text-xs">
            <h3 className="font-bold text-sm text-red-700">Hủy vụ việc vi phạm</h3>
            <p className="text-slate-500">Vụ việc sẽ không tính vào hạnh kiểm tháng nhưng giữ lịch sử.</p>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Lý do hủy:</label>
              <textarea
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Nhập lý do..."
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button onClick={() => setIsCancelModalOpen(false)} className="px-3 py-1 text-slate-600">Hủy</button>
              <button onClick={handleConfirmCancel} disabled={actionLoading} className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded">Xác nhận hủy</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
