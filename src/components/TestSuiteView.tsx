import React, { useState, useEffect } from 'react';
import {
  Layers,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  ShieldCheck,
  FileCheck2,
  AlertTriangle
} from 'lucide-react';
import { TestCaseResult } from '../types/index.ts';
import { api } from '../services/api.ts';
import { formatVietnamDisplay } from '../utils/datetime.ts';

export const TestSuiteView: React.FC = () => {
  const [results, setResults] = useState<TestCaseResult[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [passed, setPassed] = useState<number>(0);
  const [failed, setFailed] = useState<number>(0);
  const [lastRun, setLastRun] = useState<string>('');
  const [running, setRunning] = useState<boolean>(false);

  const runTests = async () => {
    setRunning(true);
    try {
      const data = await api.runTestSuite();
      setResults(data.results);
      setTotal(data.total);
      setPassed(data.passed);
      setFailed(data.failed);
      setLastRun(data.timestamp);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi chạy kiểm thử');
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    runTests();
  }, []);

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
            Kiểm thử Tuân thủ Hệ thống (14 Ca kiểm thử bắt buộc)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Xác minh tự động toàn bộ 14 quy tắc nghiệp vụ theo Mục 13 của tài liệu đặc tả
          </p>
        </div>

        <button
          onClick={runTests}
          disabled={running}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-xs flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
        >
          {running ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Đang kiểm thử...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              <span>Chạy lại toàn bộ kiểm thử</span>
            </>
          )}
        </button>
      </div>

      {/* Summary Scorecard */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Tổng số ca kiểm thử</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{total} ca</div>
          <span className="text-[10px] text-slate-400">14/14 yêu cầu Mục 13</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs">
          <span className="text-[11px] font-semibold text-emerald-700 uppercase">Đạt chuẩn (PASS)</span>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{passed}</div>
          <span className="text-[10px] text-emerald-600">Đạt 100% tiêu chí</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-red-200 shadow-xs">
          <span className="text-[11px] font-semibold text-red-700 uppercase">Không đạt (FAIL)</span>
          <div className="text-2xl font-bold text-red-700 mt-1">{failed}</div>
          <span className="text-[10px] text-red-500">{failed === 0 ? 'Không có lỗi' : 'Cần xử lý'}</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Thời điểm kiểm thử</span>
          <div className="text-xs font-mono font-medium text-slate-800 mt-2">
            {formatVietnamDisplay(lastRun) || 'Vừa xong'}
          </div>
          <span className="text-[10px] text-slate-400">Múi giờ Asia/Ho_Chi_Minh</span>
        </div>
      </div>

      {/* Test Cases List */}
      <div className="space-y-3">
        {results.map((t, idx) => (
          <div
            key={t.id}
            className={`bg-white rounded-xl border p-4 shadow-xs transition ${
              t.passed ? 'border-slate-200 hover:border-emerald-300' : 'border-red-300 bg-red-50/20'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {t.passed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold font-mono px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
                      {t.id}
                    </span>
                    <h3 className="font-bold text-sm text-slate-900">{t.title}</h3>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{t.description}</p>
                </div>
              </div>

              <div className="shrink-0 self-end sm:self-center">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    t.passed
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-red-100 text-red-800 border border-red-300'
                  }`}
                >
                  {t.passed ? 'ĐẠT (PASS)' : 'KHÔNG ĐẠT (FAIL)'}
                </span>
              </div>
            </div>

            {/* Test output assertions */}
            <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Kết quả kỳ vọng (Expected):</span>
                <span className="font-mono text-slate-800 font-medium">{t.expected}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Kết quả thực tế (Actual):</span>
                <span className={`font-mono font-medium ${t.passed ? 'text-emerald-700' : 'text-red-700'}`}>
                  {t.actual}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
