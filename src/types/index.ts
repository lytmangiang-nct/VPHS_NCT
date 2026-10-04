export type ViolationCode = 'VEHICLE_ON_CAMPUS' | 'PHONE_COMMITMENT' | 'PHONE_REPORT' | 'OTHER';

export type VerificationStatus = 'CHO_XAC_NHAN' | 'DA_XAC_NHAN' | 'DA_HUY';

export type DecisionStatus = 'CHUA_XU_LY' | 'CHO_QUYET_DINH' | 'DA_XU_LY';

export type SyncStatus = 'CHUA_GUI' | 'DANG_GUI' | 'DA_TIEP_NHAN' | 'DA_GHI_SHEET' | 'LOI';

export type EmailStatus = 'CHUA_GUI' | 'DANG_GUI' | 'DA_GUI' | 'THIEU_EMAIL' | 'THAT_BAI' | 'CAN_DOI_SOAT';

export type ConductGrade = 'TOT' | 'KHA' | 'DAT' | 'CHUA_DAT';

export type UserRole = 'admin' | 'recorder' | 'approver' | 'homeroom_teacher';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  assignedClass?: string;
  email?: string;
}

export interface Student {
  id: string;
  name: string;
  grade: number;
  className: string;
  isActive: boolean;
}

export interface Teacher {
  className: string;
  teacherName: string;
  email: string;
  isActive: boolean;
  updatedAt?: string;
}

export interface ViolationRecord {
  violation_id: string; // UUID cố định
  request_id: string;
  student_id: string;
  student_name: string;
  grade: number;
  class_name: string;
  occurred_at: string; // ISO 8601 UTC+07:00
  recorded_at: string; // ISO 8601 UTC+07:00
  updated_at: string;
  violation_date: string; // dd/MM/yyyy
  violation_time: string; // HH:mm:ss
  month: number; // 1 - 12
  year: number; // e.g. 2026
  month_key: string; // MM/yyyy
  violation_code: ViolationCode;
  violation_label: string;
  description: string;
  location: string;
  recorded_by_id: string;
  recorded_by_name: string;
  verification_status: VerificationStatus;
  handling_rule: string;
  proposed_downgrade_steps: number;
  approved_downgrade_steps: number;
  decision_status: DecisionStatus;
  handling_result: string; // Kết quả xử lý
  teacher_name?: string;
  teacher_email: string; // Email GVCN
  email_status: EmailStatus;
  email_sent_at?: string;
  email_message_id?: string;
  sync_status: SyncStatus;
  sheet_synced_at?: string;
  sync_error?: string;
  attachment_urls: string[];
  notes: string;
  // Audit log for modifications / cancellations
  history?: ViolationHistoryEntry[];
}

export interface ViolationHistoryEntry {
  timestamp: string;
  action: string;
  actor_id: string;
  actor_name: string;
  reason?: string;
  details?: string;
}

export interface WebhookPayload {
  schema_version: string;
  event_type: 'create_violation' | 'update_violation';
  violation_id: string;
  request_id: string;
  student_id: string;
  student_name: string;
  class_name: string;
  grade: number;
  violation_code: ViolationCode;
  violation_label: string;
  description: string;
  location: string;
  occurred_at: string;
  recorded_at: string;
  updated_at?: string;
  timezone: string;
  violation_date: string;
  violation_time: string;
  month: number;
  year: number;
  month_key: string;
  recorded_by_id: string;
  recorded_by_name: string;
  verification_status: VerificationStatus;
  handling_rule: string;
  handling_result?: string;
  proposed_downgrade_steps: number;
  approved_downgrade_steps: number;
  decision_status: DecisionStatus;
  teacher_name?: string;
  teacher_email?: string;
  school_name?: string;
  google_sheet_id?: string;
  attachment_urls: string[];
  notes: string;
  [key: string]: any;
}

export interface MonthlyConductEvaluation {
  id?: string;
  month_key: string; // MM/yyyy
  student_id: string;
  student_name: string;
  class_name: string;
  initial_grade: ConductGrade;
  vehicle_count: number;
  phone_commitment_count: number;
  phone_report_count: number;
  other_count: number;
  total_downgrade_steps: number; // Tổng số bậc đã xác nhận để tính
  pending_decisions_count: number; // Số vụ chờ quyết định
  proposed_grade: ConductGrade;
  approved_grade?: ConductGrade;
  approved_by?: string;
  approved_at?: string;
  notes?: string;
}

export interface AppConfig {
  makeWebhookUrl: string;
  makeApiKey?: string;
  googleSheetId: string;
  senderEmail?: string;
  senderName?: string;
  otherViolationDefaultRule: string;
  otherViolationDefaultSteps: number;
  schoolName: string;
  timezone: string;
  testModeSimulation: boolean; // When true, simulates Make webhook responses if real URL not reachable
}

export interface TestCaseResult {
  id: string;
  title: string;
  description: string;
  passed: boolean;
  actual: string;
  expected: string;
  details?: string;
}

export const CLASSES_BY_GRADE: Record<number, string[]> = {
  10: ['10C1', '10C2', '10C3', '10C4', '10C5', '10C6', '10C7', '10C8', '10C9'],
  11: ['11C1', '11C2', '11C3', '11C4', '11C5', '11C6', '11C7', '11C8', '11C9'],
  12: ['12C1', '12C2', '12C3', '12C4', '12C5', '12C6', '12C7', '12C8', '12C9', '12C10']
};

export const ALL_CLASSES: string[] = [
  ...CLASSES_BY_GRADE[10],
  ...CLASSES_BY_GRADE[11],
  ...CLASSES_BY_GRADE[12]
];

export const VIOLATION_DEFINITIONS: Record<ViolationCode, {
  label: string;
  defaultRule: string;
  defaultSteps: number;
  notice: string;
  requiresSpecialHandling?: boolean;
}> = {
  VEHICLE_ON_CAMPUS: {
    label: 'Chạy xe trong khuôn viên nhà trường',
    defaultRule: 'Đề xuất hạ 1 bậc hạnh kiểm tháng cho mỗi lần vi phạm đã xác nhận.',
    defaultSteps: 1,
    notice: 'Đề xuất hạ 1 bậc hạnh kiểm tháng'
  },
  PHONE_COMMITMENT: {
    label: 'Dùng ĐT SHDC',
    defaultRule: 'Đề xuất hạ 1 bậc hạnh kiểm tháng cho mỗi lần vi phạm đã xác nhận.',
    defaultSteps: 1,
    notice: 'Đề xuất hạ 1 bậc hạnh kiểm tháng'
  },
  PHONE_REPORT: {
    label: 'Sử dụng điện thoại (Biên bản)',
    defaultRule: 'Xử lý theo quy định nhà trường. Không tự quy đổi hạ bậc. Chờ người có thẩm quyền quyết định.',
    defaultSteps: 0,
    notice: 'Xử lý theo quy định nhà trường',
    requiresSpecialHandling: true
  },
  OTHER: {
    label: 'Lỗi khác',
    defaultRule: 'Cấu hình theo quy định hoặc xử lý theo quyết định nhà trường.',
    defaultSteps: 0,
    notice: 'Áp dụng theo cấu hình của nhà trường'
  }
};

export const CONDUCT_ORDER: ConductGrade[] = ['TOT', 'KHA', 'DAT', 'CHUA_DAT'];

export const CONDUCT_LABELS: Record<ConductGrade, string> = {
  TOT: 'Tốt',
  KHA: 'Khá',
  DAT: 'Đạt',
  CHUA_DAT: 'Chưa đạt'
};

export function calculateDowngrade(initial: ConductGrade, steps: number): ConductGrade {
  if (steps <= 0) return initial;
  const currentIndex = CONDUCT_ORDER.indexOf(initial);
  if (currentIndex === -1) return initial;
  const newIndex = Math.min(CONDUCT_ORDER.length - 1, currentIndex + steps);
  return CONDUCT_ORDER[newIndex];
}
