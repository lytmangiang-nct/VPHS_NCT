import React, { useState, useEffect } from 'react';
import {
  Award,
  Download,
  CheckCircle2,
  Save
} from 'lucide-react';
import {
  CONDUCT_LABELS,
  CONDUCT_ORDER,
  ConductGrade,
  MonthlyConductEvaluation,
  User,
  calculateDowngrade
} from '../types/index.ts';
import { api } from '../services/api.ts';

interface MonthlyConductViewProps {
  currentUser: User;
}

export const MonthlyConductView: React.FC<MonthlyConductViewProps> = ({ currentUser }) => {
  const [selectedClass, setSelectedClass] = useState<string>('10C1');
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('10/2026');

  const [evaluations, setEvaluations] = useState<MonthlyConductEvaluation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchEvaluations = async () => {
    setLoading(true);
    setSuccessMessage(null);
    try {
      const data = await api.getConductEvaluations(selectedClass, selectedMonthKey);
      setEvaluations(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvaluations();
  }, [selectedClass, selectedMonthKey]);

  const handleInitialGradeChange = (studentId: string, newGrade: ConductGrade) => {
    setEvaluations((prev) =>
      prev.map((item) => {
        if (item.student_id === studentId) {
          const proposed = calculateDowngrade(newGrade, item.total_downgrade_steps);
          return {
            ...item,
            initial_grade: newGrade,
            proposed_grade: proposed
          };
        }
        return item;
      })
    );
  };

  const handleApprovedGradeChange = (studentId: string, grade: ConductGrade) => {
    setEvaluations((prev) =>
      prev.map((item) => {
        if (item.student_id === studentId) {
          return {
            ...item,
            approved_grade: grade
          };
        }
        return item;
      })
    );
  };

  const handleSaveApprove = async () => {
    setSaving(true);
    setSuccessMessage(null);
    try {
      const toApprove = evaluations.map((e) => ({
        ...e,
        approved_grade: e.approved_grade || e.proposed_grade
      }));

      await api.approveConduct(toApprove);
      setSuccessMessage('Đã lưu và phê duyệt bảng hạnh kiểm thành công!');
      await fetchEvaluations();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi lưu bảng hạnh kiểm');
    } finally {
      setSaving(false);
    }
  };

  const isApproverOrAdmin = currentUser.role === 'admin' || currentUser.role === 'approver';

  const getConductColor = (grade?: ConductGrade) => {
    switch (grade) {
      case 'TOT':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'KHA':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'DAT':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'CHUA_DAT':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-5 px-3 sm:px-4 space-y-4">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-amber-500" />
            Xét hạnh kiểm tháng &bull; Thí điểm Lớp {selectedClass}
          </h2>
          <p className="text-[11px] text-slate-500">
            Tự động tính bậc hạ (Tốt → Khá → Đạt → Chưa đạt), giữ đúng khóa (kỳ tháng + mã HS)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Class & Month in compact inline row */}
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="h-8 px-2 border border-slate-300 rounded bg-white text-xs font-bold text-blue-700"
          >
            <option value="10C1">Lớp 10C1 (Mẫu)</option>
            <option value="10C2">Lớp 10C2</option>
          </select>

          <select
            value={selectedMonthKey}
            onChange={(e) => setSelectedMonthKey(e.target.value)}
            className="h-8 px-2 border border-slate-300 rounded bg-white text-xs font-semibold"
          >
            <option value="10/2026">Tháng 10/2026</option>
            <option value="09/2026">Tháng 09/2026</option>
            <option value="11/2026">Tháng 11/2026</option>
          </select>

          <a
            href="/api/sheets-export/XET_HANH_KIEM_THANG"
            download="XET_HANH_KIEM_THANG.csv"
            className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded border border-slate-300 shadow-2xs flex items-center gap-1 transition"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Xuất CSV</span>
          </a>

          {isApproverOrAdmin && (
            <button
              onClick={handleSaveApprove}
              disabled={saving || loading || evaluations.length === 0}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Đang lưu...' : 'Lưu duyệt'}</span>
            </button>
          )}
        </div>
      </div>

      {successMessage && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 text-xs flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Evaluation Table */}
      <div className="bg-white rounded-lg shadow-2xs border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-xs">Đang tính hạnh kiểm...</div>
        ) : evaluations.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">Chưa có học sinh trong lớp {selectedClass}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[11px] uppercase">
                  <th className="py-2 px-3">Mã HS</th>
                  <th className="py-2 px-3">Họ và tên</th>
                  <th className="py-2 px-3">Mức ban đầu</th>
                  <th className="py-2 px-2 text-center">Chạy xe</th>
                  <th className="py-2 px-2 text-center">ĐT (Cam kết)</th>
                  <th className="py-2 px-2 text-center">ĐT (Biên bản)</th>
                  <th className="py-2 px-2 text-center">Lỗi khác</th>
                  <th className="py-2 px-2 text-center">Bậc hạ xác nhận</th>
                  <th className="py-2 px-2 text-center">Chờ quyết định</th>
                  <th className="py-2 px-3 text-center">Mức đề xuất</th>
                  <th className="py-2 px-3 text-center">Mức được duyệt</th>
                  <th className="py-2 px-3">Người duyệt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {evaluations.map((ev) => (
                  <tr key={ev.student_id} className="hover:bg-slate-50 transition">
                    <td className="py-2 px-3 font-mono text-slate-600 font-medium">{ev.student_id}</td>
                    <td className="py-2 px-3 font-bold text-slate-900">{ev.student_name}</td>
                    <td className="py-2 px-3">
                      <select
                        value={ev.initial_grade}
                        onChange={(e) => handleInitialGradeChange(ev.student_id, e.target.value as ConductGrade)}
                        className="h-6 px-1.5 border border-slate-300 rounded bg-white text-xs font-semibold"
                      >
                        {CONDUCT_ORDER.map((c) => (
                          <option key={c} value={c}>
                            {CONDUCT_LABELS[c]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-2 text-center font-bold">
                      {ev.vehicle_count > 0 ? <span className="text-red-600">{ev.vehicle_count}</span> : <span className="text-slate-400">0</span>}
                    </td>
                    <td className="py-2 px-2 text-center font-bold">
                      {ev.phone_commitment_count > 0 ? <span className="text-red-600">{ev.phone_commitment_count}</span> : <span className="text-slate-400">0</span>}
                    </td>
                    <td className="py-2 px-2 text-center font-bold">
                      {ev.phone_report_count > 0 ? <span className="text-amber-600">{ev.phone_report_count}</span> : <span className="text-slate-400">0</span>}
                    </td>
                    <td className="py-2 px-2 text-center font-bold">
                      {ev.other_count > 0 ? <span className="text-purple-600">{ev.other_count}</span> : <span className="text-slate-400">0</span>}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span className={`px-1.5 py-0.2 rounded font-bold text-[11px] ${
                        ev.total_downgrade_steps > 0 ? 'bg-red-100 text-red-800' : 'text-slate-400'
                      }`}>
                        -{ev.total_downgrade_steps}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center">
                      {ev.pending_decisions_count > 0 ? (
                        <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">
                          {ev.pending_decisions_count} vụ
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getConductColor(ev.proposed_grade)}`}>
                        {CONDUCT_LABELS[ev.proposed_grade]}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      {isApproverOrAdmin ? (
                        <select
                          value={ev.approved_grade || ev.proposed_grade}
                          onChange={(e) => handleApprovedGradeChange(ev.student_id, e.target.value as ConductGrade)}
                          className="h-6 px-1.5 border border-slate-300 rounded bg-white text-xs font-bold"
                        >
                          {CONDUCT_ORDER.map((c) => (
                            <option key={c} value={c}>
                              {CONDUCT_LABELS[c]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getConductColor(ev.approved_grade || ev.proposed_grade)}`}>
                          {CONDUCT_LABELS[ev.approved_grade || ev.proposed_grade]}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-500 text-[11px]">
                      {ev.approved_by ? (
                        <span className="font-medium text-slate-800">{ev.approved_by}</span>
                      ) : (
                        <span className="text-slate-400 italic">Chưa duyệt</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
