import {
  ALL_CLASSES,
  CLASSES_BY_GRADE,
  AppConfig,
  MonthlyConductEvaluation,
  Student,
  Teacher,
  TestCaseResult,
  User,
  VIOLATION_DEFINITIONS,
  ViolationCode,
  ViolationRecord
} from '../types/index.ts';
import { parseToVietnamParts } from '../utils/datetime.ts';

// Keys for client-side storage cache (supports static deployments like Netlify/Vercel)
const STORAGE_KEYS = {
  CONFIG: 'app_config_cache',
  USER: 'app_active_user',
  TEACHERS: 'app_teachers_cache',
  VIOLATIONS: 'app_violations_cache',
  STUDENTS: 'app_students_cache'
};

const DEFAULT_CONFIG: AppConfig = {
  makeWebhookUrl: '',
  makeApiKey: '',
  googleSheetId: '',
  senderEmail: 'bithu.doan@thpt.edu.vn',
  senderName: 'Đoàn Trường THPT',
  otherViolationDefaultRule: 'Ghi nhận và đề xuất hình thức kỷ luật theo mức độ vi phạm',
  otherViolationDefaultSteps: 0,
  schoolName: 'Trường THPT',
  timezone: 'Asia/Ho_Chi_Minh',
  testModeSimulation: false
};

const TEACHER_SAMPLE_NAMES = [
  'Nguyễn Văn An', 'Trần Thị Mai', 'Lê Hoàng Long', 'Phạm Quốc Bảo',
  'Hoàng Thu Trang', 'Đỗ Minh Tuấn', 'Vũ Hồng Hạnh', 'Bùi Văn Hưng',
  'Đặng Thanh Thảo', 'Ngô Kiến Huy', 'Dương Thúy Nga', 'Võ Đình Trí'
];

function generateSeedTeachers(): Teacher[] {
  const teachers: Teacher[] = [];
  ALL_CLASSES.forEach((cls, idx) => {
    teachers.push({
      className: cls,
      teacherName: `Thầy/Cô ${TEACHER_SAMPLE_NAMES[idx % TEACHER_SAMPLE_NAMES.length]}`,
      email: `gvcn.${cls.toLowerCase()}@thpt.edu.vn`,
      isActive: true
    });
  });
  return teachers;
}

// Stores active user in localStorage for role simulation
export function getStoredUser(): User {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    id: 'usr_admin',
    name: 'Thầy Nguyễn Văn Nam (Bí thư Đoàn)',
    role: 'admin',
    email: 'bithu.doan@thpt.edu.vn'
  };
}

export function setStoredUser(user: User) {
  try {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  } catch {}
}

function getAuthHeaders(): HeadersInit {
  const user = getStoredUser();
  return {
    'Content-Type': 'application/json',
    'x-user-id': user.id,
    'x-user-role': user.role,
    'x-assigned-class': user.assignedClass || '',
    'x-user-name': encodeURIComponent(user.name)
  };
}

// Helper to get cached config
function getClientConfig(): AppConfig & { isWebhookConfigured: boolean; isSheetConfigured: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONFIG);
    const parsed: AppConfig = raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : { ...DEFAULT_CONFIG };
    return {
      ...parsed,
      isWebhookConfigured: Boolean(parsed.makeWebhookUrl && parsed.makeWebhookUrl.trim()),
      isSheetConfigured: Boolean(parsed.googleSheetId && parsed.googleSheetId.trim())
    };
  } catch {
    return {
      ...DEFAULT_CONFIG,
      isWebhookConfigured: false,
      isSheetConfigured: false
    };
  }
}

// Helper to save cached config
function saveClientConfig(patch: Partial<AppConfig>): AppConfig & { isWebhookConfigured: boolean; isSheetConfigured: boolean } {
  const current = getClientConfig();
  const updated: AppConfig = { ...current, ...patch };
  try {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(updated));
  } catch {}
  return {
    ...updated,
    isWebhookConfigured: Boolean(updated.makeWebhookUrl && updated.makeWebhookUrl.trim()),
    isSheetConfigured: Boolean(updated.googleSheetId && updated.googleSheetId.trim())
  };
}

// Helper for teachers in client storage
function getClientTeachers(): Teacher[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TEACHERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  const seeds = generateSeedTeachers();
  try {
    localStorage.setItem(STORAGE_KEYS.TEACHERS, JSON.stringify(seeds));
  } catch {}
  return seeds;
}

function saveClientTeachers(teachers: Teacher[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.TEACHERS, JSON.stringify(teachers));
  } catch {}
}

// Helper for violations in client storage
function getClientViolations(): ViolationRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VIOLATIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function saveClientViolations(records: ViolationRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.VIOLATIONS, JSON.stringify(records));
  } catch {}
}

function buildClientWebhookPayload(record: ViolationRecord, teacher: Teacher | undefined, config: AppConfig) {
  const teacherName = teacher?.teacherName || `Chủ nhiệm ${record.class_name}`;
  const teacherEmail = teacher?.email || record.teacher_email || '';
  const senderEmail = config.senderEmail || 'doantruong.thpt@gmail.com';
  const senderName = config.senderName || 'BCH Đoàn trường THPT';
  const sheetId = config.googleSheetId || 'Vipham';
  const handlingText = record.handling_result || record.handling_rule || 'Theo quy định nhà trường';
  const notesText = record.notes && record.notes.trim() ? record.notes.trim() : 'Không';
  const thangChu = `Tháng ${record.month}`;

  const messagePlain = `Kính gửi Thầy/Cô: ${teacherName} (GVCN lớp ${record.class_name}),\n\nBCH ĐT thông báo học sinh sau vừa vi phạm nề nếp:\n- Họ và tên học sinh: ${record.student_name}\n- Lớp: ${record.class_name}\n- Hành vi vi phạm: ${record.violation_label}\n- Ngày vi phạm: ${record.violation_date} (Tháng vi phạm: ${thangChu})\n- Địa điểm: ${record.location}\n- Hướng đề xuất xử lý: ${handlingText}\n- Ghi chú: ${notesText}\n\nKính đề nghị Thầy/Cô phối hợp nhắc nhở và giáo dục học sinh.\n\nTrân trọng!\n${senderName}`;
  const messageWithBr = messagePlain.replace(/\n/g, '<br/>');

  return {
    // 1. CỘT TIẾNG VIỆT KHÔNG DẤU (Cho Google Sheet & Make)
    ho_ten: record.student_name,
    lop: record.class_name,
    loai_vi_pham: record.violation_label,
    ngay_thang_nam: record.violation_date,
    thang: record.month,
    thang_chu: thangChu,
    nam: record.year,
    dia_diem: record.location,
    huong_xu_ly: handlingText,
    email_gvcn: teacherEmail,
    email_chu_nhiem: teacherEmail,
    ten_gvcn: teacherName,
    from: senderEmail,
    from_email: senderEmail,
    from_name: senderName,
    email_nguoi_gui: senderEmail,
    ten_nguoi_gui: senderName,
    sender_email: senderEmail,
    sender_name: senderName,
    ghi_chu: notesText,
    ma_vi_pham: record.violation_id,
    ma_hoc_sinh: record.student_id,
    google_sheet_id: sheetId,
    sheet_id: sheetId,
    message: messagePlain,
    message_plain: messagePlain,
    message_html: messageWithBr,
    noi_dung_thong_bao: messagePlain,
    noi_dung_email: messageWithBr,

    // 2. CỘT TIẾNG VIỆT CÓ DẤU (Trùng khớp tiêu đề cột trên Google Sheet)
    'Họ tên học sinh': record.student_name,
    'Họ và tên': record.student_name,
    'Lớp': record.class_name,
    'Loại vi phạm': record.violation_label,
    'Ngày tháng năm': record.violation_date,
    'Tháng': record.month,
    'Tháng vi phạm': thangChu,
    'Năm': record.year,
    'Địa điểm': record.location,
    'Hướng xử lý': handlingText,
    'Email GVCN': teacherEmail,
    'Email chủ nhiệm': teacherEmail,
    'Tên GVCN': teacherName,
    'From': senderEmail,
    'Email người gửi': senderEmail,
    'Người gửi': senderName,
    'Ghi chú': notesText,
    'Mã vi phạm': record.violation_id,
    'Mã học sinh': record.student_id,
    'Message': messagePlain,

    // 3. TIÊU CHUẨN KỸ THUẬT TIẾNG ANH
    event: 'create_violation',
    event_type: 'create_violation',
    timestamp: new Date().toISOString(),
    violation_id: record.violation_id,
    student_id: record.student_id,
    student_name: record.student_name,
    class_name: record.class_name,
    grade: record.grade,
    violation_date: record.violation_date,
    violation_time: record.violation_time,
    violation_code: record.violation_code,
    violation_label: record.violation_label,
    description: record.description,
    location: record.location,
    notes: record.notes,
    handling_result: handlingText,
    teacher_name: teacherName,
    teacher_email: teacherEmail,
    recorded_by_name: record.recorded_by_name,
    verification_status: record.verification_status,
    decision_status: record.decision_status
  };
}

export const api = {
  // CONFIGURATION: Dual-layer (Backend + LocalStorage fallback for Netlify/Vercel)
  async getConfig(): Promise<AppConfig & { isWebhookConfigured: boolean; isSheetConfigured: boolean }> {
    try {
      const res = await fetch('/api/config', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        // Sync with local storage
        try {
          localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(data));
        } catch {}
        return data;
      }
    } catch {
      // Backend not reachable (e.g. Netlify static hosting)
    }
    return getClientConfig();
  },

  async updateConfig(payload: Partial<AppConfig>): Promise<void> {
    // 1. Always save immediately to client storage
    saveClientConfig(payload);

    // 2. Also attempt to sync with backend if running
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const synced = await res.json();
        try {
          localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(synced));
        } catch {}
      }
    } catch {
      // If deployed to Netlify without Express server, local storage persistence is sufficient!
    }
  },

  async getUsers(): Promise<User[]> {
    try {
      const res = await fetch('/api/users', { headers: getAuthHeaders() });
      if (res.ok) return res.json();
    } catch {}
    return [getStoredUser()];
  },

  async getClasses(): Promise<{ all: string[]; byGrade: Record<number, string[]> }> {
    try {
      const res = await fetch('/api/classes', { headers: getAuthHeaders() });
      if (res.ok) return res.json();
    } catch {}
    return { all: ALL_CLASSES, byGrade: CLASSES_BY_GRADE };
  },

  async getTeachers(): Promise<Teacher[]> {
    try {
      const res = await fetch('/api/teachers', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        saveClientTeachers(data);
        return data;
      }
    } catch {}
    return getClientTeachers();
  },

  async updateTeacher(className: string, data: Partial<Teacher>): Promise<{ success: boolean; teacher: Teacher }> {
    const list = getClientTeachers();
    const idx = list.findIndex((t) => t.className === className);
    let updatedTeacher: Teacher;
    if (idx !== -1) {
      updatedTeacher = { ...list[idx], ...data };
      list[idx] = updatedTeacher;
    } else {
      updatedTeacher = {
        className,
        teacherName: data.teacherName || `Thầy/Cô GVCN ${className}`,
        email: data.email || '',
        isActive: true
      };
      list.push(updatedTeacher);
    }
    saveClientTeachers(list);

    try {
      const res = await fetch(`/api/teachers/${className}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
      });
      if (res.ok) {
        const result = await res.json();
        return result;
      }
    } catch {}

    return { success: true, teacher: updatedTeacher };
  },

  async getStudents(params?: { className?: string; grade?: number; query?: string }): Promise<Student[]> {
    try {
      const url = new URL('/api/students', window.location.origin);
      if (params?.className) url.searchParams.set('className', params.className);
      if (params?.grade) url.searchParams.set('grade', String(params.grade));
      if (params?.query) url.searchParams.set('query', params.query);
      const res = await fetch(url.toString(), { headers: getAuthHeaders() });
      if (res.ok) return res.json();
    } catch {}
    return [];
  },

  async getNextStudentId(className: string): Promise<{ className: string; nextId: string }> {
    const cleanClass = className.trim().toUpperCase();
    try {
      const url = new URL('/api/students/next-id', window.location.origin);
      url.searchParams.set('className', cleanClass);
      const res = await fetch(url.toString(), { headers: getAuthHeaders() });
      if (res.ok) {
        return res.json();
      }
    } catch {}

    // Fallback: Compute next ID from client storage
    const prefix = `HS${cleanClass}`;
    const violations = getClientViolations();
    const existingIds = new Set<string>();
    violations.forEach((v) => {
      if (v.class_name.toUpperCase() === cleanClass && v.student_id) {
        existingIds.add(v.student_id.toUpperCase());
      }
    });

    let maxNum = 0;
    for (const id of existingIds) {
      if (id.startsWith(prefix)) {
        const numPart = id.slice(prefix.length);
        const parsed = parseInt(numPart, 10);
        if (!isNaN(parsed) && parsed > maxNum) {
          maxNum = parsed;
        }
      }
    }

    let nextNum = maxNum > 0 ? maxNum + 1 : 1;
    let candidate = `${prefix}${String(nextNum).padStart(2, '0')}`;
    while (existingIds.has(candidate)) {
      nextNum++;
      candidate = `${prefix}${String(nextNum).padStart(2, '0')}`;
    }

    return { className: cleanClass, nextId: candidate };
  },

  async addStudent(student: { id: string; name: string; grade: number; className: string }): Promise<Student> {
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(student)
      });
      if (res.ok) return res.json();
    } catch {}
    return { ...student, isActive: true };
  },

  async getViolations(params?: Record<string, string>): Promise<ViolationRecord[]> {
    try {
      const url = new URL('/api/violations', window.location.origin);
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          if (v) url.searchParams.set(k, v);
        });
      }
      const res = await fetch(url.toString(), { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        saveClientViolations(data);
        return data;
      }
    } catch {}

    // Fallback: filter client-stored violations
    let list = getClientViolations();
    if (params) {
      if (params.class_name) list = list.filter((v) => v.class_name === params.class_name);
      if (params.month_key) list = list.filter((v) => v.month_key === params.month_key);
      if (params.violation_code) list = list.filter((v) => v.violation_code === params.violation_code);
      if (params.search) {
        const q = params.search.toLowerCase().trim();
        list = list.filter(
          (v) =>
            v.student_name.toLowerCase().includes(q) ||
            v.student_id.toLowerCase().includes(q) ||
            v.description.toLowerCase().includes(q) ||
            v.violation_id.toLowerCase().includes(q)
        );
      }
    }
    return list;
  },

  async createViolation(payload: any): Promise<ViolationRecord> {
    const authUser = getStoredUser();
    const config = getClientConfig();
    const teacher = getClientTeachers().find((t) => t.className === payload.class_name);
    const teacherEmail = teacher?.email || '';

    // 1. Try sending to backend (passes client config so backend has latest webhook settings)
    try {
      const res = await fetch('/api/violations', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...payload,
          makeWebhookUrl: config.makeWebhookUrl,
          googleSheetId: config.googleSheetId,
          senderEmail: config.senderEmail
        })
      });
      if (res.ok) {
        const record = await res.json();

        // If backend did not succeed in sending to webhook, client dispatches to ensure Google Sheet gets data!
        if (config.makeWebhookUrl && config.makeWebhookUrl.trim() && record.sync_status !== 'DA_GHI_SHEET') {
          try {
            const webhookPayload = buildClientWebhookPayload(record, teacher, config);
            const wRes = await fetch(config.makeWebhookUrl.trim(), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(webhookPayload)
            });
            if (wRes.ok) {
              record.sync_status = 'DA_GHI_SHEET';
              record.email_status = teacherEmail ? 'DA_GUI' : 'THIEU_EMAIL';
            }
          } catch (e) {
            console.warn('Fallback direct dispatch notice:', e);
          }
        }

        const list = getClientViolations();
        list.unshift(record);
        saveClientViolations(list);
        return record;
      }
    } catch {
      // Backend not running (e.g. Netlify static hosting)
    }

    // 2. Client-side handling & direct Make Webhook dispatch for Netlify
    const occurredDateParts = parseToVietnamParts(payload.occurred_at || new Date());
    const recordedDateParts = parseToVietnamParts(new Date());
    const definition = VIOLATION_DEFINITIONS[payload.violation_code as ViolationCode] || VIOLATION_DEFINITIONS.VEHICLE_ON_CAMPUS;
    const grade = parseInt(payload.class_name.slice(0, 2), 10) || 10;

    const newRecord: ViolationRecord = {
      violation_id: payload.client_violation_id || `v-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      request_id: `req-${Date.now()}`,
      student_id: String(payload.student_id).trim(),
      student_name: String(payload.student_name).trim(),
      grade,
      class_name: payload.class_name,
      occurred_at: occurredDateParts.isoWithOffset,
      recorded_at: recordedDateParts.isoWithOffset,
      updated_at: recordedDateParts.isoWithOffset,
      violation_date: occurredDateParts.violation_date,
      violation_time: occurredDateParts.violation_time,
      month: occurredDateParts.month,
      year: occurredDateParts.year,
      month_key: occurredDateParts.month_key,
      violation_code: payload.violation_code,
      violation_label: definition.label,
      description: payload.description || '',
      location: payload.location || 'Trong trường',
      recorded_by_id: authUser.id,
      recorded_by_name: authUser.name,
      verification_status: 'DA_XAC_NHAN',
      handling_rule: definition.defaultRule,
      proposed_downgrade_steps: definition.defaultSteps,
      approved_downgrade_steps: definition.defaultSteps,
      decision_status: 'CHUA_XU_LY',
      handling_result: definition.defaultSteps > 0 ? `Đề xuất hạ ${definition.defaultSteps} bậc hạnh kiểm tháng` : 'Theo quy định',
      teacher_name: teacher?.teacherName || `GVCN ${payload.class_name}`,
      teacher_email: teacherEmail,
      email_status: teacherEmail ? 'DA_GUI' : 'THIEU_EMAIL',
      sync_status: 'CHUA_GUI',
      attachment_urls: [],
      notes: payload.notes || '',
      history: [
        {
          timestamp: recordedDateParts.isoWithOffset,
          action: 'CREATE',
          actor_id: authUser.id,
          actor_name: authUser.name,
          details: 'Ghi nhận vi phạm trực tiếp'
        }
      ]
    };

    // 3. Direct Webhook Dispatch to Make / Google Sheet if Webhook is configured
    if (config.makeWebhookUrl && config.makeWebhookUrl.trim()) {
      try {
        const webhookPayload = buildClientWebhookPayload(newRecord, teacher, config);
        const webhookRes = await fetch(config.makeWebhookUrl.trim(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookPayload)
        });

        if (webhookRes.ok) {
          newRecord.sync_status = 'DA_GHI_SHEET';
        }
      } catch (err) {
        console.error('Direct Make Webhook dispatch error:', err);
      }
    }

    // Save record to client cache
    const list = getClientViolations();
    list.unshift(newRecord);
    saveClientViolations(list);

    return newRecord;
  },

  async updateViolation(id: string, payload: any): Promise<ViolationRecord> {
    const list = getClientViolations();
    const idx = list.findIndex((v) => v.violation_id === id);
    let updated: ViolationRecord;
    if (idx !== -1) {
      updated = { ...list[idx], ...payload, updated_at: new Date().toISOString() };
      list[idx] = updated;
      saveClientViolations(list);
    }

    try {
      const res = await fetch(`/api/violations/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      if (res.ok) return res.json();
    } catch {}

    if (idx !== -1) return list[idx];
    throw new Error('Không tìm thấy vi phạm');
  },

  async cancelViolation(id: string, reason: string): Promise<void> {
    const list = getClientViolations();
    const idx = list.findIndex((v) => v.violation_id === id);
    if (idx !== -1) {
      list[idx] = {
        ...list[idx],
        verification_status: 'DA_HUY',
        decision_status: 'DA_XU_LY',
        approved_downgrade_steps: 0,
        handling_result: `Đã hủy vụ việc. Lý do: ${reason}`
      };
      saveClientViolations(list);
    }

    try {
      await fetch(`/api/violations/${id}/cancel`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason })
      });
    } catch {}
  },

  async deleteViolation(id: string): Promise<void> {
    const list = getClientViolations().filter((v) => v.violation_id !== id);
    saveClientViolations(list);

    try {
      await fetch(`/api/violations/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
    } catch {}
  },

  async retryEmail(id: string): Promise<ViolationRecord> {
    try {
      const res = await fetch(`/api/violations/${id}/retry-email`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) return res.json();
    } catch {}
    const list = getClientViolations();
    const record = list.find((v) => v.violation_id === id);
    if (record) return record;
    throw new Error('Gửi lại email thất bại');
  },

  async getConductEvaluations(className: string, monthKey: string): Promise<MonthlyConductEvaluation[]> {
    try {
      const url = new URL('/api/conduct-evaluations', window.location.origin);
      url.searchParams.set('className', className);
      url.searchParams.set('monthKey', monthKey);
      const res = await fetch(url.toString(), { headers: getAuthHeaders() });
      if (res.ok) return res.json();
    } catch {}
    return [];
  },

  async approveConduct(evaluations: MonthlyConductEvaluation[]): Promise<void> {
    try {
      await fetch('/api/conduct-evaluations/approve', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ evaluations })
      });
    } catch {}
  },

  async runTestSuite(): Promise<{
    timestamp: string;
    total: number;
    passed: number;
    failed: number;
    results: TestCaseResult[];
  }> {
    try {
      const res = await fetch('/api/test-suite/run', {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) return res.json();
    } catch {}
    return {
      timestamp: new Date().toISOString(),
      total: 0,
      passed: 0,
      failed: 0,
      results: []
    };
  }
};
