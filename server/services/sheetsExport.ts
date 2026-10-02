import {
  CONDUCT_LABELS,
  MonthlyConductEvaluation,
  Student,
  Teacher,
  ViolationRecord
} from '../../src/types/index.ts';

export const SHEET_COLUMNS = {
  NHAT_KY_VI_PHAM: [
    'Họ tên học sinh',
    'Lớp',
    'Loại vi phạm',
    'Ngày tháng năm',
    'Tháng',
    'Địa điểm',
    'Hướng xử lý',
    'Ghi chú',
    'Mã vi phạm',
    'Người ghi nhận'
  ],
  GVCN: ['Lớp', 'Họ tên GVCN', 'Email GVCN', 'Đang hoạt động'],
  HOC_SINH: ['Mã học sinh', 'Họ và tên', 'Khối', 'Lớp', 'Đang học'],
  XET_HANH_KIEM_THANG: [
    'Kỳ tháng',
    'Mã học sinh',
    'Họ và tên',
    'Lớp',
    'Mức đánh giá ban đầu',
    'Số lần chạy xe',
    'Số lần Dùng ĐT SHDC',
    'Số lần điện thoại (Biên bản)',
    'Số lần lỗi khác',
    'Tổng số bậc đã xác nhận để tính',
    'Số vụ chờ quyết định',
    'Mức đề xuất',
    'Mức được duyệt',
    'Người duyệt',
    'Ngày duyệt',
    'Ghi chú'
  ]
};

function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export function formatViolationToSheetRow(v: ViolationRecord): any[] {
  return [
    v.student_name,                         // Họ tên học sinh
    v.class_name,                           // Lớp
    v.violation_label,                      // Loại vi phạm
    v.violation_date,                       // Ngày tháng năm (dd/MM/yyyy)
    `Tháng ${v.month}`,                     // Tháng (tách cột riêng để lọc)
    v.location,                             // Địa điểm
    v.handling_result || v.handling_rule,   // Hướng xử lý
    v.notes || '',                          // Ghi chú
    v.violation_id,                         // Mã vi phạm
    v.recorded_by_name                      // Người ghi nhận
  ];
}

export function generateCsvForTab(
  tab: 'NHAT_KY_VI_PHAM' | 'GVCN' | 'HOC_SINH' | 'XET_HANH_KIEM_THANG',
  data: {
    violations?: ViolationRecord[];
    teachers?: Teacher[];
    students?: Student[];
    evaluations?: MonthlyConductEvaluation[];
  }
): string {
  const headers = SHEET_COLUMNS[tab];
  const rows: string[] = [headers.map(escapeCsvCell).join(',')];

  if (tab === 'NHAT_KY_VI_PHAM' && data.violations) {
    data.violations.forEach((v) => {
      rows.push(formatViolationToSheetRow(v).map(escapeCsvCell).join(','));
    });
  } else if (tab === 'GVCN' && data.teachers) {
    data.teachers.forEach((t) => {
      rows.push(
        [t.className, t.teacherName, t.email, t.isActive ? 'Có' : 'Không']
          .map(escapeCsvCell)
          .join(',')
      );
    });
  } else if (tab === 'HOC_SINH' && data.students) {
    data.students.forEach((s) => {
      rows.push(
        [s.id, s.name, s.grade, s.className, s.isActive ? 'Có' : 'Không']
          .map(escapeCsvCell)
          .join(',')
      );
    });
  } else if (tab === 'XET_HANH_KIEM_THANG' && data.evaluations) {
    data.evaluations.forEach((e) => {
      rows.push(
        [
          e.month_key,
          e.student_id,
          e.student_name,
          e.class_name,
          CONDUCT_LABELS[e.initial_grade] || e.initial_grade,
          e.vehicle_count,
          e.phone_commitment_count,
          e.phone_report_count,
          e.other_count,
          e.total_downgrade_steps,
          e.pending_decisions_count,
          CONDUCT_LABELS[e.proposed_grade] || e.proposed_grade,
          e.approved_grade ? CONDUCT_LABELS[e.approved_grade] || e.approved_grade : '',
          e.approved_by || '',
          e.approved_at || '',
          e.notes || ''
        ]
          .map(escapeCsvCell)
          .join(',')
      );
    });
  }

  // Prepend UTF-8 BOM so Excel opens Vietnamese characters correctly
  return '\uFEFF' + rows.join('\r\n');
}
