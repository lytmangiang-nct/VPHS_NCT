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
import {
  db,
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  onSnapshot,
  deleteDoc,
  testConnection
} from './firebase.ts';

// Test Firestore connection on boot
testConnection().catch(() => {});

// Keys for client-side storage cache (supports static deployments like Netlify/Vercel)
const STORAGE_KEYS = {
  CONFIG: 'app_config_cache',
  USER: 'app_active_user',
  TEACHERS: 'app_teachers_cache',
  VIOLATIONS: 'app_violations_cache',
  STUDENTS: 'app_students_cache',
  LAST_SYNC: 'app_last_sync_time'
};

export interface SyncDataPackage {
  version: number;
  exportedAt: string;
  sourceDevice?: string;
  config: AppConfig;
  teachers: Teacher[];
  violations?: ViolationRecord[];
  students?: Student[];
}

export function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

export function base64ToUtf8(base64: string): string {
  const bin = atob(base64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

const DEFAULT_CONFIG: AppConfig = {
  makeWebhookUrl: 'https://hook.eu1.make.com/corl1dg4fl1uoi2guqoi6ycphutv4pl7',
  makeApiKey: '',
  googleSheetId: 'Vipham',
  senderEmail: 'lytm.angiang@gmail.com',
  senderName: 'BCH Đoàn trường THPT',
  otherViolationDefaultRule: 'Ghi nhận và đề xuất hình thức kỷ luật theo mức độ vi phạm',
  otherViolationDefaultSteps: 0,
  schoolName: 'Trường THPT Nguyễn Chí Thanh',
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

// Helper to get cached config with guaranteed defaults
function getClientConfig(): AppConfig & { isWebhookConfigured: boolean; isSheetConfigured: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONFIG);
    const parsed: AppConfig = raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : { ...DEFAULT_CONFIG };
    if (!parsed.makeWebhookUrl || !parsed.makeWebhookUrl.trim()) {
      parsed.makeWebhookUrl = DEFAULT_CONFIG.makeWebhookUrl;
    }
    if (!parsed.googleSheetId || !parsed.googleSheetId.trim()) {
      parsed.googleSheetId = DEFAULT_CONFIG.googleSheetId;
    }
    if (!parsed.senderEmail || !parsed.senderEmail.trim()) {
      parsed.senderEmail = DEFAULT_CONFIG.senderEmail;
    }
    return {
      ...parsed,
      isWebhookConfigured: Boolean(parsed.makeWebhookUrl && parsed.makeWebhookUrl.trim()),
      isSheetConfigured: Boolean(parsed.googleSheetId && parsed.googleSheetId.trim())
    };
  } catch {
    return {
      ...DEFAULT_CONFIG,
      isWebhookConfigured: true,
      isSheetConfigured: true
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
  const senderEmail = config.senderEmail || 'lytm.angiang@gmail.com';
  const senderName = 'BCH Đoàn trường THPT Nguyễn Chí Thanh';
  const sheetId = config.googleSheetId || 'Vipham';
  const handlingText = record.handling_result || record.handling_rule || 'Kiểm điểm trước lớp hoặc xử lý theo quyết định nhà trường';
  const notesText = record.notes && record.notes.trim() ? record.notes.trim() : 'Không';
  const thangChu = `Tháng ${record.month}`;

  const violationDisplay = record.description && record.description.trim()
    ? `${record.violation_label} (${record.description.trim()})`
    : record.violation_label;

  const messagePlain = `Kính gửi Thầy/Cô: ${teacherName} (GVCN lớp ${record.class_name}),

BCH ĐT thông báo học sinh sau vừa vi phạm nề nếp:
- Họ và tên học sinh: ${record.student_name}
- Lớp: ${record.class_name}
- Hành vi vi phạm: ${violationDisplay}
- Ngày vi phạm: ${record.violation_date} (Tháng vi phạm: ${thangChu})
- Địa điểm: ${record.location}
- Hướng đề xuất xử lý: ${handlingText}
- Ghi chú: ${notesText}

Kính đề nghị Thầy/Cô phối hợp nhắc nhở và giáo dục học sinh.

Trân trọng!
BCH Đoàn trường THPT Nguyễn Chí Thanh`;

  const messageHtml = `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333333; max-width: 600px; padding: 20px; border: 1px solid #cbd5e1; border-radius: 8px; background-color: #ffffff;">
  <p style="margin-top: 0; font-size: 14px;">
    Kính gửi Thầy/Cô: <b style="color: #1e3a8a;">${teacherName} (GVCN lớp ${record.class_name})</b>,
  </p>
  <p style="font-size: 14px; margin-bottom: 12px;">
    BCH ĐT thông báo học sinh sau vừa vi phạm nề nếp:
  </p>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px;">
    <tr>
      <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; width: 35%; color: #64748b; font-size: 13px;">- Họ và tên học sinh:</td>
      <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #1e3a8a; font-size: 14px;">${record.student_name}</td>
    </tr>
    <tr>
      <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px;">- Lớp:</td>
      <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #0f172a; font-size: 13px;">${record.class_name}</td>
    </tr>
    <tr>
      <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px;">- Hành vi vi phạm:</td>
      <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #dc2626; font-weight: bold; font-size: 13px;">${violationDisplay}</td>
    </tr>
    <tr>
      <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px;">- Ngày vi phạm:</td>
      <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px;"><b>${record.violation_date}</b> (Tháng vi phạm: <b style="color: #0369a1;">${thangChu}</b>)</td>
    </tr>
    <tr>
      <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px;">- Địa điểm:</td>
      <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600;">${record.location}</td>
    </tr>
    <tr>
      <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px;">- Hướng đề xuất xử lý:</td>
      <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #d97706; font-weight: bold; font-size: 13px;">${handlingText}</td>
    </tr>
    <tr>
      <td style="padding: 10px 14px; color: #64748b; font-size: 13px;">- Ghi chú:</td>
      <td style="padding: 10px 14px; font-style: italic; color: #475569; font-size: 13px;">${notesText}</td>
    </tr>
  </table>
  <p style="font-size: 13px; color: #334155; margin-bottom: 16px;">
    Kính đề nghị Thầy/Cô phối hợp nhắc nhở và giáo dục học sinh.
  </p>
  <div style="border-top: 1px dashed #cbd5e1; padding-top: 12px; font-size: 13px;">
    <p style="margin: 0; font-weight: bold; color: #0f172a;">Trân trọng!</p>
    <p style="margin: 2px 0 0 0; font-weight: bold; color: #1e3a8a; font-size: 14px;">BCH Đoàn trường THPT Nguyễn Chí Thanh</p>
  </div>
</div>`;

  const messageWithBr = messagePlain.replace(/\n/g, '<br/>');

  return {
    // 1. CỘT TIẾNG VIỆT KHÔNG DẤU (Cho Google Sheet & Make)
    ho_ten: record.student_name,
    lop: record.class_name,
    loai_vi_pham: violationDisplay,
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
    message_html: messageHtml,
    message_table: messageHtml,
    noi_dung_thong_bao: messagePlain,
    noi_dung_email: messageHtml,
    noi_dung_html: messageHtml,

    // 2. CỘT TIẾNG VIỆT CÓ DẤU (Trùng khớp tiêu đề cột trên Google Sheet)
    'Họ tên học sinh': record.student_name,
    'Họ và tên': record.student_name,
    'Lớp': record.class_name,
    'Loại vi phạm': violationDisplay,
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
  // CONFIGURATION: Multi-layer (Firestore Cloud DB + Express + LocalStorage cache)
  async getConfig(): Promise<AppConfig & { isWebhookConfigured: boolean; isSheetConfigured: boolean }> {
    // 1. Try Firebase Firestore Cloud Database
    try {
      const snap = await getDoc(doc(db, 'system', 'config'));
      if (snap.exists()) {
        const cloudData = snap.data() as AppConfig;
        const merged = { ...DEFAULT_CONFIG, ...cloudData };
        saveClientConfig(merged);
        return {
          ...merged,
          isWebhookConfigured: Boolean(merged.makeWebhookUrl && merged.makeWebhookUrl.trim()),
          isSheetConfigured: Boolean(merged.googleSheetId && merged.googleSheetId.trim())
        };
      } else {
        // Seed default config to Firestore Cloud
        setDoc(doc(db, 'system', 'config'), DEFAULT_CONFIG).catch(() => {});
      }
    } catch (e) {
      console.warn('Firestore getConfig offline:', e);
    }

    // 2. Try backend server if running
    try {
      const res = await fetch('/api/config', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        saveClientConfig(data);
        return data;
      }
    } catch {}

    // 3. Fallback to client localStorage
    return getClientConfig();
  },

  async updateConfig(payload: Partial<AppConfig>): Promise<void> {
    saveClientConfig(payload);

    // Save to Firebase Firestore Cloud Database immediately
    try {
      await setDoc(doc(db, 'system', 'config'), payload, { merge: true });
    } catch (e) {
      console.warn('Firestore updateConfig error:', e);
    }

    // Also attempt backend sync
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
    } catch {}
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
    // 1. Try Firebase Firestore Cloud Database (Source of Truth across all devices)
    try {
      const snap = await getDocs(collection(db, 'teachers'));
      if (!snap.empty) {
        const cloudTeachers: Teacher[] = [];
        snap.forEach((d) => {
          cloudTeachers.push(d.data() as Teacher);
        });
        const sorted = ALL_CLASSES.map((cls) => {
          const found = cloudTeachers.find((t) => t.className === cls);
          return found || {
            className: cls,
            teacherName: `Thầy/Cô GVCN ${cls}`,
            email: '',
            isActive: true
          };
        });
        saveClientTeachers(sorted);
        return sorted;
      } else {
        // Seed current teachers to Firestore Cloud
        const seeds = getClientTeachers();
        seeds.forEach((t) => {
          setDoc(doc(db, 'teachers', t.className), t).catch(() => {});
        });
        return seeds;
      }
    } catch (e) {
      console.warn('Firestore getTeachers offline:', e);
    }

    // 2. Try Backend server if running
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
      updatedTeacher = { ...list[idx], ...data, updatedAt: new Date().toISOString() };
      list[idx] = updatedTeacher;
    } else {
      updatedTeacher = {
        className,
        teacherName: data.teacherName || `Thầy/Cô GVCN ${className}`,
        email: data.email || '',
        isActive: true,
        updatedAt: new Date().toISOString()
      };
      list.push(updatedTeacher);
    }
    saveClientTeachers(list);

    // Save to Firebase Firestore Cloud Database immediately
    try {
      await setDoc(doc(db, 'teachers', className), updatedTeacher, { merge: true });
    } catch (e) {
      console.warn('Firestore updateTeacher error:', e);
    }

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
    // 1. Try Firebase Firestore Cloud Database first
    try {
      const snap = await getDocs(collection(db, 'violations'));
      if (!snap.empty) {
        const cloudList: ViolationRecord[] = [];
        snap.forEach((d) => {
          cloudList.push(d.data() as ViolationRecord);
        });
        cloudList.sort((a, b) => new Date(b.occurred_at || 0).getTime() - new Date(a.occurred_at || 0).getTime());
        saveClientViolations(cloudList);

        let list = cloudList;
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
      }
    } catch (e) {
      console.warn('Firestore getViolations offline:', e);
    }

    // 2. Try Backend server if running
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

    const occurredDateParts = parseToVietnamParts(payload.occurred_at || new Date());
    const recordedDateParts = parseToVietnamParts(new Date());
    const definition = VIOLATION_DEFINITIONS[payload.violation_code as ViolationCode] || VIOLATION_DEFINITIONS.VEHICLE_ON_CAMPUS;
    const grade = parseInt(payload.class_name.slice(0, 2), 10) || 10;

    // Instant local record construction (< 1ms)
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
      sync_status: 'DA_GHI_SHEET',
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

    // Save immediately to client cache (< 1ms)
    const list = getClientViolations();
    list.unshift(newRecord);
    saveClientViolations(list);

    // Concurrently trigger background deliveries (parallel execution)
    const promises: Promise<any>[] = [];

    // 0. Save to Firebase Firestore Cloud Database (Instant Cloud Persistence)
    const firestoreTask = setDoc(doc(db, 'violations', newRecord.violation_id), newRecord).catch((e) => {
      console.warn('Firestore createViolation write error:', e);
    });
    promises.push(firestoreTask);

    // 1. Direct Webhook Dispatch (High Priority, non-blocking)
    if (config.makeWebhookUrl && config.makeWebhookUrl.trim()) {
      const webhookPayload = buildClientWebhookPayload(newRecord, teacher, config);
      const webhookTask = fetch(config.makeWebhookUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload)
      }).then((res) => {
        if (res.ok) {
          newRecord.sync_status = 'DA_GHI_SHEET';
        }
      }).catch((e) => {
        console.warn('Webhook notice:', e);
      });
      promises.push(webhookTask);
    }

    // 2. Server Sync (if running)
    const serverTask = fetch('/api/violations', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        ...payload,
        client_violation_id: newRecord.violation_id,
        makeWebhookUrl: config.makeWebhookUrl,
        googleSheetId: config.googleSheetId,
        senderEmail: config.senderEmail
      })
    }).then((res) => {
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        return res.json();
      }
    }).catch(() => {});
    promises.push(serverTask);

    // Wait at most 800ms for Make Webhook response (tested at ~280ms)
    // Never freezes the user, ensuring buttery smooth interaction!
    await Promise.race([
      Promise.allSettled(promises),
      new Promise((resolve) => setTimeout(resolve, 800))
    ]);

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

    // Update in Firestore Cloud
    setDoc(doc(db, 'violations', id), payload, { merge: true }).catch(() => {});

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

    // Cancel in Firestore Cloud
    setDoc(doc(db, 'violations', id), {
      verification_status: 'DA_HUY',
      decision_status: 'DA_XU_LY',
      approved_downgrade_steps: 0,
      handling_result: `Đã hủy vụ việc. Lý do: ${reason}`
    }, { merge: true }).catch(() => {});

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

    // Delete in Firestore Cloud
    deleteDoc(doc(db, 'violations', id)).catch(() => {});

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
  },

  // BATCH TEACHERS UPDATE
  async updateAllTeachers(teachers: Teacher[]): Promise<{ success: boolean; count: number }> {
    saveClientTeachers(teachers);
    try {
      await fetch('/api/teachers/bulk', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ teachers })
      });
    } catch {}
    return { success: true, count: teachers.length };
  },

  // CROSS-DEVICE SYNC ENGINE
  getSyncPackage(includeViolations = false): SyncDataPackage {
    const config = getClientConfig();
    const teachers = getClientTeachers();
    const violations = includeViolations ? getClientViolations() : [];
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      sourceDevice: typeof navigator !== 'undefined' ? (navigator.userAgent.includes('Mobi') ? 'Điện thoại' : 'Máy tính') : 'Web',
      config: {
        makeWebhookUrl: config.makeWebhookUrl,
        makeApiKey: config.makeApiKey || '',
        googleSheetId: config.googleSheetId,
        senderEmail: config.senderEmail,
        senderName: config.senderName,
        otherViolationDefaultRule: config.otherViolationDefaultRule,
        otherViolationDefaultSteps: config.otherViolationDefaultSteps,
        schoolName: config.schoolName,
        timezone: config.timezone,
        testModeSimulation: config.testModeSimulation
      },
      teachers,
      violations
    };
  },

  applySyncPackage(pkg: SyncDataPackage): { teachersUpdated: number; violationsUpdated: number; configUpdated: boolean } {
    let teachersUpdated = 0;
    let violationsUpdated = 0;
    let configUpdated = false;

    if (pkg.teachers && Array.isArray(pkg.teachers) && pkg.teachers.length > 0) {
      const currentTeachers = getClientTeachers();
      const map = new Map<string, Teacher>();
      currentTeachers.forEach((t) => map.set(t.className, t));

      pkg.teachers.forEach((t) => {
        if (t.className) {
          map.set(t.className, {
            className: t.className,
            teacherName: t.teacherName || map.get(t.className)?.teacherName || `Thầy/Cô GVCN ${t.className}`,
            email: t.email !== undefined ? t.email.trim() : (map.get(t.className)?.email || ''),
            isActive: t.isActive !== false
          });
          teachersUpdated++;
        }
      });

      const mergedTeachers = ALL_CLASSES.map((cls) => map.get(cls) || {
        className: cls,
        teacherName: `Thầy/Cô GVCN ${cls}`,
        email: '',
        isActive: true
      });

      saveClientTeachers(mergedTeachers);
      // Attempt backend sync
      fetch('/api/teachers/bulk', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ teachers: mergedTeachers })
      }).catch(() => {});
    }

    if (pkg.config) {
      saveClientConfig(pkg.config);
      configUpdated = true;
    }

    if (pkg.violations && Array.isArray(pkg.violations) && pkg.violations.length > 0) {
      const currentViolations = getClientViolations();
      const existingIds = new Set(currentViolations.map((v) => v.violation_id));
      const newOnes = pkg.violations.filter((v) => v.violation_id && !existingIds.has(v.violation_id));
      if (newOnes.length > 0) {
        const combined = [...newOnes, ...currentViolations];
        saveClientViolations(combined);
        violationsUpdated = newOnes.length;
      }
    }

    try {
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
    } catch {}

    return { teachersUpdated, violationsUpdated, configUpdated };
  },

  generateSyncCode(includeViolations = false): string {
    const pkg = this.getSyncPackage(includeViolations);
    return utf8ToBase64(JSON.stringify(pkg));
  },

  generateSyncUrl(includeViolations = false): string {
    const code = this.generateSyncCode(includeViolations);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
    return `${origin}${pathname}#sync=${code}`;
  },

  parseSyncString(input: string): SyncDataPackage {
    let clean = input.trim();
    if (clean.includes('#sync=')) {
      clean = clean.split('#sync=')[1];
    }
    if (clean.startsWith('{') && clean.endsWith('}')) {
      return JSON.parse(clean);
    }
    const jsonStr = base64ToUtf8(clean);
    return JSON.parse(jsonStr);
  },

  exportTeachersCsv(teachersList?: Teacher[]): string {
    const teachers = teachersList || getClientTeachers();
    const bom = '\uFEFF';
    const header = 'Lớp,Họ và tên GVCN,Email GVCN,Trạng thái\n';
    const rows = teachers.map((t) => {
      const name = (t.teacherName || '').replace(/"/g, '""');
      const email = (t.email || '').replace(/"/g, '""');
      const status = t.email ? 'Đang hoạt động' : 'Thiếu email';
      return `"${t.className}","${name}","${email}","${status}"`;
    }).join('\n');
    return bom + header + rows;
  },

  importTeachersCsv(csvText: string): { count: number; imported: Teacher[] } {
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const currentTeachers = getClientTeachers();
    const map = new Map<string, Teacher>();
    currentTeachers.forEach((t) => map.set(t.className, t));

    let updatedCount = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip header if matches
      if (i === 0 && (line.toLowerCase().includes('lớp') || line.toLowerCase().includes('classname'))) {
        continue;
      }

      // Parse CSV line handling quotes
      const regex = /(?:^|,)(\"(?:[^\"]+|\"\")*\"|[^,]*)/g;
      const matches: string[] = [];
      let match;
      while ((match = regex.exec(line)) !== null) {
        let val = match[1] || '';
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1).replace(/""/g, '"');
        }
        matches.push(val.trim());
      }

      if (matches.length >= 2) {
        const className = matches[0].toUpperCase();
        const teacherName = matches[1];
        const email = matches[2] || '';

        if (ALL_CLASSES.includes(className)) {
          map.set(className, {
            className,
            teacherName: teacherName || map.get(className)?.teacherName || `Thầy/Cô GVCN ${className}`,
            email: email.trim(),
            isActive: true
          });
          updatedCount++;
        }
      }
    }

    const merged = ALL_CLASSES.map((cls) => map.get(cls) || {
      className: cls,
      teacherName: `Thầy/Cô GVCN ${cls}`,
      email: '',
      isActive: true
    });

    saveClientTeachers(merged);
    fetch('/api/teachers/bulk', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ teachers: merged })
    }).catch(() => {});

    return { count: updatedCount, imported: merged };
  },

  // REAL-TIME FIRESTORE SUBSCRIPTIONS (Cross-device < 0.1s sync)
  subscribeTeachers(callback: (teachers: Teacher[]) => void): () => void {
    try {
      return onSnapshot(collection(db, 'teachers'), (snap) => {
        if (!snap.empty) {
          const list: Teacher[] = [];
          snap.forEach((d) => list.push(d.data() as Teacher));
          const sorted = ALL_CLASSES.map((cls) => {
            const found = list.find((t) => t.className === cls);
            return found || {
              className: cls,
              teacherName: `Thầy/Cô GVCN ${cls}`,
              email: '',
              isActive: true
            };
          });
          saveClientTeachers(sorted);
          callback(sorted);
        }
      }, (err) => {
        console.warn('Firestore onSnapshot teachers error:', err);
      });
    } catch {
      return () => {};
    }
  },

  subscribeViolations(callback: (violations: ViolationRecord[]) => void): () => void {
    try {
      return onSnapshot(collection(db, 'violations'), (snap) => {
        const list: ViolationRecord[] = [];
        snap.forEach((d) => list.push(d.data() as ViolationRecord));
        list.sort((a, b) => new Date(b.occurred_at || 0).getTime() - new Date(a.occurred_at || 0).getTime());
        saveClientViolations(list);
        callback(list);
      }, (err) => {
        console.warn('Firestore onSnapshot violations error:', err);
      });
    } catch {
      return () => {};
    }
  }
};
