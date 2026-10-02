import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { ALL_CLASSES, ViolationRecord } from '../types/index.ts';
import { api } from '../services/api.ts';

export const StatisticsView: React.FC = () => {
  const [violations, setViolations] = useState<ViolationRecord[]>([]);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('10/2026');
  const [loading, setLoading] = useState<boolean>(true);
  const [showAllClasses, setShowAllClasses] = useState<boolean>(false);

  useEffect(() => {
    setLoading(true);
    api.getViolations({ month_key: selectedMonthKey })
      .then(setViolations)
      .finally(() => setLoading(false));
  }, [selectedMonthKey]);

  const activeViolations = violations.filter((v) => v.verification_status !== 'DA_HUY');

  // Filter for pilot class 10C1
  const pilotViolations = activeViolations.filter((v) => v.class_name === '10C1');

  const totalCount = pilotViolations.length;
  const vehicleCount = pilotViolations.filter((v) => v.violation_code === 'VEHICLE_ON_CAMPUS').length;
  const phoneCommitmentCount = pilotViolations.filter((v) => v.violation_code === 'PHONE_COMMITMENT').length;
  const phoneReportCount = pilotViolations.filter((v) => v.violation_code === 'PHONE_REPORT').length;
  const otherCount = pilotViolations.filter((v) => v.violation_code === 'OTHER').length;

  const pendingDecisions = pilotViolations.filter(
    (v) => v.decision_status === 'CHO_QUYET_DINH' || v.verification_status === 'CHO_XAC_NHAN'
  ).length;

  const emailIssues = pilotViolations.filter(
    (v) => v.email_status === 'THIEU_EMAIL' || v.email_status === 'THAT_BAI' || v.email_status === 'CAN_DOI_SOAT'
  ).length;

  // Breakdown across classes
  const classesToDisplay = showAllClasses ? ALL_CLASSES : ['10C1'];

  const classBreakdown = classesToDisplay.map((cls) => {
    const list = activeViolations.filter((v) => v.class_name === cls);
    return {
      className: cls,
      grade: parseInt(cls.slice(0, 2), 10),
      total: list.length,
      vehicles: list.filter((v) => v.violation_code === 'VEHICLE_ON_CAMPUS').length,
      phoneCommitment: list.filter((v) => v.violation_code === 'PHONE_COMMITMENT').length,
      phoneReport: list.filter((v) => v.violation_code === 'PHONE_REPORT').length,
      others: list.filter((v) => v.violation_code === 'OTHER').length,
      pending: list.filter((v) => v.decision_status === 'CHO_QUYET_DINH').length,
      unsentEmail: list.filter(
        (v) => v.email_status === 'THIEU_EMAIL' || v.email_status === 'THAT_BAI' || v.email_status === 'CAN_DOI_SOAT'
      ).length
    };
  });

  return (
    <div className="max-w-6xl mx-auto py-5 px-3 sm:px-4 space-y-4">
      {/* Header and Month Filter */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            Thống kê & Tổng hợp vi phạm
          </h2>
          <p className="text-[11px] text-slate-500">
            Số liệu mẫu thí điểm: <strong>Lớp 10C1</strong> &bull; Kỳ tháng {selectedMonthKey}
          </p>
        </div>

        <select
          value={selectedMonthKey}
          onChange={(e) => setSelectedMonthKey(e.target.value)}
          className="h-8 px-2.5 border border-slate-300 rounded bg-white text-xs font-semibold"
        >
          <option value="10/2026">Tháng 10/2026</option>
          <option value="09/2026">Tháng 09/2026</option>
          <option value="11/2026">Tháng 11/2026</option>
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
          <span className="text-[10px] text-slate-500 font-semibold uppercase">Tổng vụ 10C1</span>
          <div className="text-xl font-bold text-slate-900 mt-0.5">{totalCount}</div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-blue-200 shadow-2xs">
          <span className="text-[10px] text-blue-700 font-semibold uppercase">Chạy xe</span>
          <div className="text-xl font-bold text-blue-700 mt-0.5">{vehicleCount}</div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-indigo-200 shadow-2xs">
          <span className="text-[10px] text-indigo-700 font-semibold uppercase">ĐT (Cam kết)</span>
          <div className="text-xl font-bold text-indigo-700 mt-0.5">{phoneCommitmentCount}</div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-amber-200 shadow-2xs">
          <span className="text-[10px] text-amber-800 font-semibold uppercase">ĐT (Biên bản)</span>
          <div className="text-xl font-bold text-amber-700 mt-0.5">{phoneReportCount}</div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-orange-200 shadow-2xs">
          <span className="text-[10px] text-orange-700 font-semibold uppercase">Chờ xử lý</span>
          <div className="text-xl font-bold text-orange-700 mt-0.5">{pendingDecisions}</div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-red-200 shadow-2xs">
          <span className="text-[10px] text-red-700 font-semibold uppercase">Lỗi gửi Email</span>
          <div className="text-xl font-bold text-red-700 mt-0.5">{emailIssues}</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-2xs border border-slate-200 overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs">
          <span className="font-bold text-slate-800">
            Tổng hợp theo lớp ({showAllClasses ? 'Đầy đủ 28 lớp' : 'Lớp thí điểm 10C1'})
          </span>

          <button
            onClick={() => setShowAllClasses(!showAllClasses)}
            className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <span>{showAllClasses ? 'Thu gọn chỉ xem 10C1' : 'Mở rộng xem tất cả 28 lớp'}</span>
            {showAllClasses ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase text-[11px]">
                <th className="py-2 px-3">Lớp</th>
                <th className="py-2 px-3 text-center">Tổng vụ</th>
                <th className="py-2 px-3 text-center">Chạy xe</th>
                <th className="py-2 px-3 text-center">ĐT (Cam kết)</th>
                <th className="py-2 px-3 text-center">ĐT (Biên bản)</th>
                <th className="py-2 px-3 text-center">Lỗi khác</th>
                <th className="py-2 px-3 text-center">Chờ xử lý</th>
                <th className="py-2 px-3 text-center">Lỗi Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {classBreakdown.map((row) => (
                <tr key={row.className} className="hover:bg-slate-50">
                  <td className="py-2 px-3 font-bold text-blue-700">{row.className}</td>
                  <td className="py-2 px-3 text-center font-bold">{row.total}</td>
                  <td className="py-2 px-3 text-center">{row.vehicles}</td>
                  <td className="py-2 px-3 text-center">{row.phoneCommitment}</td>
                  <td className="py-2 px-3 text-center">{row.phoneReport}</td>
                  <td className="py-2 px-3 text-center">{row.others}</td>
                  <td className="py-2 px-3 text-center">
                    {row.pending > 0 ? (
                      <span className="text-amber-800 font-bold px-1.5 py-0.2 rounded bg-amber-50">
                        {row.pending}
                      </span>
                    ) : (
                      '0'
                    )}
                  </td>
                  <td className="py-2 px-3 text-center">
                    {row.unsentEmail > 0 ? (
                      <span className="text-red-700 font-bold px-1.5 py-0.2 rounded bg-red-50">
                        {row.unsentEmail}
                      </span>
                    ) : (
                      <span className="text-emerald-600">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
