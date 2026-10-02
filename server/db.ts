import fs from 'fs';
import path from 'path';
import {
  ALL_CLASSES,
  AppConfig,
  CLASSES_BY_GRADE,
  MonthlyConductEvaluation,
  Student,
  Teacher,
  User,
  ViolationRecord,
  WebhookPayload
} from '../src/types/index.ts';
import { parseToVietnamParts } from '../src/utils/datetime.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

export interface DatabaseSchema {
  config: AppConfig;
  teachers: Teacher[];
  students: Student[];
  violations: ViolationRecord[];
  conductEvaluations: MonthlyConductEvaluation[];
  users: User[];
}

const DEFAULT_USERS: User[] = [
  { id: 'usr_admin', name: 'Thầy Nguyễn Văn Nam (Bí thư Đoàn)', role: 'admin', email: 'bithu.doan@thpt.edu.vn' },
  { id: 'usr_recorder', name: 'Nguyễn Minh Quân (Ban Trật tự Sao đỏ)', role: 'recorder', email: 'saodo@thpt.edu.vn' },
  { id: 'usr_approver', name: 'Cô Trần Thị Hương (Phó Hiệu trưởng)', role: 'approver', email: 'bgh.huong@thpt.edu.vn' },
  { id: 'usr_gvcn_10c1', name: 'Thầy Lê Văn Hùng (GVCN 10C1)', role: 'homeroom_teacher', assignedClass: '10C1', email: 'gvcn.10c1@thpt.edu.vn' },
  { id: 'usr_gvcn_12c10', name: 'Cô Phạm Thị Lan (GVCN 12C10)', role: 'homeroom_teacher', assignedClass: '12C10', email: 'gvcn.12c10@thpt.edu.vn' }
];

function generateSeedTeachers(): Teacher[] {
  const teachers: Teacher[] = [];
  const teacherSampleNames = [
    'Nguyễn Văn An', 'Trần Thị Mai', 'Lê Hoàng Long', 'Phạm Quốc Bảo',
    'Hoàng Thu Trang', 'Đỗ Minh Tuấn', 'Vũ Hồng Hạnh', 'Bùi Văn Hưng',
    'Đặng Thanh Thảo', 'Ngô Kiến Huy', 'Dương Thúy Nga', 'Võ Đình Trí'
  ];

  ALL_CLASSES.forEach((cls, idx) => {
    // Leave 10C9 with empty email to test/demonstrate "Thiếu email GVCN" requirement
    const isMissingEmail = cls === '10C9';
    teachers.push({
      className: cls,
      teacherName: `Thầy/Cô ${teacherSampleNames[idx % teacherSampleNames.length]}`,
      email: isMissingEmail ? '' : `gvcn.${cls.toLowerCase()}@thpt.edu.vn`,
      isActive: true
    });
  });

  return teachers;
}

function generateSeedStudents(): Student[] {
  const students: Student[] = [];
  const firstNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ'];
  const middleNames = ['Văn', 'Thị', 'Đình', 'Hữu', 'Minh', 'Ngọc', 'Quốc', 'Thanh', 'Gia'];
  const lastNames = ['An', 'Bình', 'Cường', 'Dũng', 'Đạt', 'Hải', 'Huy', 'Khoa', 'Lâm', 'Nam', 'Phong', 'Quân', 'Sơn', 'Tâm', 'Việt', 'Yến', 'Trang', 'Phương', 'Linh', 'Hương'];

  let idCounter = 1000;
  ALL_CLASSES.forEach((cls) => {
    const grade = parseInt(cls.slice(0, 2), 10);
    // Generate 5 realistic students per class
    for (let i = 1; i <= 5; i++) {
      idCounter++;
      const fn = firstNames[(idCounter * 3) % firstNames.length];
      const mn = middleNames[(idCounter * 7) % middleNames.length];
      const ln = lastNames[(idCounter * 11) % lastNames.length];
      students.push({
        id: `HS${grade}${cls.slice(2)}${String(i).padStart(2, '0')}`,
        name: `${fn} ${mn} ${ln}`,
        grade,
        className: cls,
        isActive: true
      });
    }
  });

  // Add a specific student with identical name in two classes to test disambiguation requirement
  students.push({
    id: `HS100199`,
    name: 'Nguyễn Văn Minh',
    grade: 10,
    className: '10C1',
    isActive: true
  });
  students.push({
    id: `HS110299`,
    name: 'Nguyễn Văn Minh',
    grade: 11,
    className: '11C2',
    isActive: true
  });

  return students;
}

function generateSeedViolations(teachers: Teacher[]): ViolationRecord[] {
  // Pre-seed a few realistic violations in October 2026 and September 2026 to verify calendar rules
  const records: ViolationRecord[] = [
    {
      violation_id: 'v-seed-001',
      request_id: 'req-seed-001',
      student_id: 'HS100101',
      student_name: 'Nguyễn Văn An',
      grade: 10,
      class_name: '10C1',
      occurred_at: '2026-10-01T07:15:00+07:00',
      recorded_at: '2026-10-01T07:30:00+07:00',
      updated_at: '2026-10-01T07:30:00+07:00',
      violation_date: '01/10/2026',
      violation_time: '07:15:00',
      month: 10,
      year: 2026,
      month_key: '10/2026',
      violation_code: 'VEHICLE_ON_CAMPUS',
      violation_label: 'Chạy xe trong khuôn viên nhà trường',
      description: 'Chạy xe máy điện vào sâu sân trường giờ chào cờ',
      location: 'Khu vực tượng đài sân trước',
      recorded_by_id: 'usr_recorder',
      recorded_by_name: 'Nguyễn Minh Quân (Ban Trật tự Sao đỏ)',
      verification_status: 'DA_XAC_NHAN',
      handling_rule: 'Đề xuất hạ 1 bậc hạnh kiểm tháng cho mỗi lần vi phạm đã xác nhận.',
      proposed_downgrade_steps: 1,
      approved_downgrade_steps: 1,
      decision_status: 'DA_XU_LY',
      handling_result: 'Hạ 1 bậc hạnh kiểm tháng 10/2026',
      teacher_email: 'gvcn.10c1@thpt.edu.vn',
      email_status: 'DA_GUI',
      email_sent_at: '2026-10-01T07:31:00+07:00',
      email_message_id: 'msg-seed-1001',
      sync_status: 'DA_GHI_SHEET',
      sheet_synced_at: '2026-10-01T07:30:30+07:00',
      attachment_urls: [],
      notes: 'Học sinh đã thừa nhận vi phạm'
    },
    {
      violation_id: 'v-seed-002',
      request_id: 'req-seed-002',
      student_id: 'HS100102',
      student_name: 'Trần Thị Mai',
      grade: 10,
      class_name: '10C1',
      occurred_at: '2026-10-01T08:45:00+07:00',
      recorded_at: '2026-10-01T09:00:00+07:00',
      updated_at: '2026-10-01T09:00:00+07:00',
      violation_date: '01/10/2026',
      violation_time: '08:45:00',
      month: 10,
      year: 2026,
      month_key: '10/2026',
      violation_code: 'PHONE_REPORT',
      violation_label: 'Sử dụng điện thoại (Biên bản)',
      description: 'Chơi game trong tiết Toán có lập biên bản tịch thu tạm giữ',
      location: 'Phòng học 10C1 tầng 2',
      recorded_by_id: 'usr_recorder',
      recorded_by_name: 'Nguyễn Minh Quân (Ban Trật tự Sao đỏ)',
      verification_status: 'DA_XAC_NHAN',
      handling_rule: 'Xử lý theo quy định nhà trường. Không tự quy đổi hạ bậc. Chờ người có thẩm quyền quyết định.',
      proposed_downgrade_steps: 0,
      approved_downgrade_steps: 0,
      decision_status: 'CHO_QUYET_DINH',
      handling_result: 'Chờ xử lý theo quy định',
      teacher_email: 'gvcn.10c1@thpt.edu.vn',
      email_status: 'DA_GUI',
      email_sent_at: '2026-10-01T09:01:00+07:00',
      email_message_id: 'msg-seed-1002',
      sync_status: 'DA_GHI_SHEET',
      sheet_synced_at: '2026-10-01T09:00:30+07:00',
      attachment_urls: [],
      notes: 'Đã lập biên bản gửi Ban Giám hiệu'
    }
  ];

  return records;
}

class Database {
  private data: DatabaseSchema;
  private inFlightLock: Set<string> = new Set();

  constructor() {
    this.data = this.load();
  }

  private load(): DatabaseSchema {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const content = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(content);
      }
    } catch (e) {
      console.error('Error loading db file, reinitializing default:', e);
    }

    const teachers = generateSeedTeachers();
    const students = generateSeedStudents();
    const violations = generateSeedViolations(teachers);

    const initialDb: DatabaseSchema = {
      config: {
        makeWebhookUrl: process.env.MAKE_WEBHOOK_URL || '',
        googleSheetId: process.env.GOOGLE_SHEET_ID || '',
        otherViolationDefaultRule: 'Kiểm điểm trước lớp hoặc xử lý theo quyết định nhà trường.',
        otherViolationDefaultSteps: 0,
        schoolName: 'Trường THPT Chuyên Đoàn Trường',
        timezone: 'Asia/Ho_Chi_Minh',
        testModeSimulation: true
      },
      teachers,
      students,
      violations,
      conductEvaluations: [],
      users: DEFAULT_USERS
    };

    this.saveData(initialDb);
    return initialDb;
  }

  private saveData(data: DatabaseSchema) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save database:', e);
    }
  }

  public getDb(): DatabaseSchema {
    return this.data;
  }

  public save() {
    this.saveData(this.data);
  }

  public acquireLock(id: string): boolean {
    if (this.inFlightLock.has(id)) {
      return false;
    }
    this.inFlightLock.add(id);
    return true;
  }

  public releaseLock(id: string) {
    this.inFlightLock.delete(id);
  }
}

export const db = new Database();
