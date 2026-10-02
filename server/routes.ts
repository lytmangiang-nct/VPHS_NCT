import express, { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { db } from './db.ts';
import {
  ALL_CLASSES,
  CLASSES_BY_GRADE,
  MonthlyConductEvaluation,
  Teacher,
  User,
  VIOLATION_DEFINITIONS,
  ViolationCode,
  ViolationRecord
} from '../src/types/index.ts';
import { htmlInputToVietnamISO, parseToVietnamParts } from '../src/utils/datetime.ts';
import { calculateMonthlyConduct } from './services/conduct.ts';
import { generateCsvForTab } from './services/sheetsExport.ts';
import { runAllAutomatedTests } from './services/testRunner.ts';
import { dispatchWebhook } from './services/webhook.ts';

export const router = express.Router();

// Helper to get active user from request header
function getAuthUser(req: Request): User {
  const userId = req.headers['x-user-id'] as string;
  const userRole = (req.headers['x-user-role'] as string) || 'admin';
  const assignedClass = req.headers['x-assigned-class'] as string;
  const userName = req.headers['x-user-name'] as string;

  const dbData = db.getDb();
  if (userId) {
    const found = dbData.users.find((u) => u.id === userId);
    if (found) return found;
  }

  return {
    id: userId || 'usr_admin',
    name: (userName ? decodeURIComponent(userName) : 'Quản trị viên Đoàn trường'),
    role: (userRole as any) || 'admin',
    assignedClass: assignedClass || undefined
  };
}

// Health check
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// App configuration
router.get('/config', (_req: Request, res: Response) => {
  const dbData = db.getDb();
  // Mask sensitive parts if any, but let admin see configured status
  res.json({
    ...dbData.config,
    isWebhookConfigured: !!(dbData.config.makeWebhookUrl && dbData.config.makeWebhookUrl.trim()),
    isSheetConfigured: !!(dbData.config.googleSheetId && dbData.config.googleSheetId.trim())
  });
});

router.post('/config', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Chỉ Quản trị viên mới có quyền thay đổi cấu hình hệ thống' });
  }

  const dbData = db.getDb();
  const {
    makeWebhookUrl,
    makeApiKey,
    googleSheetId,
    otherViolationDefaultRule,
    otherViolationDefaultSteps,
    schoolName,
    senderEmail,
    senderName
  } = req.body;

  if (makeWebhookUrl !== undefined) dbData.config.makeWebhookUrl = String(makeWebhookUrl).trim();
  if (makeApiKey !== undefined) dbData.config.makeApiKey = String(makeApiKey).trim();
  if (googleSheetId !== undefined) dbData.config.googleSheetId = String(googleSheetId).trim();
  if (otherViolationDefaultRule !== undefined) dbData.config.otherViolationDefaultRule = String(otherViolationDefaultRule).trim();
  if (otherViolationDefaultSteps !== undefined) dbData.config.otherViolationDefaultSteps = Number(otherViolationDefaultSteps) || 0;
  if (schoolName !== undefined) dbData.config.schoolName = String(schoolName).trim();
  if (senderEmail !== undefined) dbData.config.senderEmail = String(senderEmail).trim();
  if (senderName !== undefined) dbData.config.senderName = String(senderName).trim();

  db.save();
  res.json({ success: true, config: dbData.config });
});

// Available users (for switching demo profiles)
router.get('/users', (_req: Request, res: Response) => {
  const dbData = db.getDb();
  res.json(dbData.users);
});

// Classes list
router.get('/classes', (_req: Request, res: Response) => {
  res.json({
    all: ALL_CLASSES,
    byGrade: CLASSES_BY_GRADE
  });
});

// Teachers (GVCN)
router.get('/teachers', (_req: Request, res: Response) => {
  const dbData = db.getDb();
  res.json(dbData.teachers);
});

router.put('/teachers/:className', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Chỉ Quản trị viên mới có quyền cập nhật danh sách GVCN' });
  }

  const { className } = req.params;
  const { teacherName, email, isActive } = req.body;
  const dbData = db.getDb();

  const idx = dbData.teachers.findIndex((t) => t.className === className);
  if (idx === -1) {
    dbData.teachers.push({
      className,
      teacherName: teacherName || '',
      email: email ? String(email).trim() : '',
      isActive: isActive !== false
    });
  } else {
    dbData.teachers[idx] = {
      ...dbData.teachers[idx],
      teacherName: teacherName !== undefined ? teacherName : dbData.teachers[idx].teacherName,
      email: email !== undefined ? String(email).trim() : dbData.teachers[idx].email,
      isActive: isActive !== undefined ? !!isActive : dbData.teachers[idx].isActive
    };
  }

  db.save();
  res.json({ success: true, teacher: dbData.teachers.find((t) => t.className === className) });
});

// Bulk update teachers
router.post('/teachers/bulk', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Chỉ Quản trị viên mới có quyền nhập danh sách GVCN' });
  }

  const { teachers } = req.body;
  if (!Array.isArray(teachers)) {
    return res.status(400).json({ error: 'Dữ liệu không đúng định dạng mảng' });
  }

  const dbData = db.getDb();
  teachers.forEach((item: any) => {
    if (item.className && ALL_CLASSES.includes(item.className)) {
      const idx = dbData.teachers.findIndex((t) => t.className === item.className);
      if (idx !== -1) {
        dbData.teachers[idx] = {
          className: item.className,
          teacherName: item.teacherName || dbData.teachers[idx].teacherName,
          email: item.email ? String(item.email).trim() : '',
          isActive: item.isActive !== false
        };
      }
    }
  });

  db.save();
  res.json({ success: true, count: dbData.teachers.length });
});

// Students
router.get('/students', (req: Request, res: Response) => {
  const { className, grade, query } = req.query;
  const dbData = db.getDb();
  let list = dbData.students;

  if (className) {
    list = list.filter((s) => s.className === className);
  } else if (grade) {
    list = list.filter((s) => s.grade === Number(grade));
  }

  if (query) {
    const q = String(query).toLowerCase().trim();
    list = list.filter((s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
  }

  res.json(list);
});

// Auto-generate next Student ID for a class
router.get('/students/next-id', (req: Request, res: Response) => {
  const className = String(req.query.className || '10C1').trim().toUpperCase();
  const dbData = db.getDb();
  const prefix = `HS${className}`;

  const existingIds = new Set<string>();
  dbData.students.forEach((s) => {
    if (s.className.toUpperCase() === className && s.id) {
      existingIds.add(s.id.toUpperCase());
    }
  });
  dbData.violations.forEach((v) => {
    if (v.class_name.toUpperCase() === className && v.student_id) {
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

  res.json({ className, nextId: candidate });
});

router.post('/students', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Chỉ Quản trị viên mới có quyền thêm/nhập học sinh' });
  }

  const { id, name, grade, className } = req.body;
  if (!id || !name || !className) {
    return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ: Mã HS, Họ tên, Lớp' });
  }

  const dbData = db.getDb();
  const existing = dbData.students.find((s) => s.id === id);
  if (existing) {
    return res.status(400).json({ error: `Mã học sinh ${id} đã tồn tại` });
  }

  const newStudent = {
    id: String(id).trim(),
    name: String(name).trim(),
    grade: Number(grade) || parseInt(className.slice(0, 2), 10),
    className: String(className).trim(),
    isActive: true
  };

  dbData.students.push(newStudent);
  db.save();
  res.status(201).json(newStudent);
});

// Bulk student import
router.post('/students/bulk', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Chỉ Quản trị viên mới có quyền thêm/nhập học sinh' });
  }

  const { students } = req.body;
  if (!Array.isArray(students)) {
    return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
  }

  const dbData = db.getDb();
  let added = 0;
  students.forEach((s) => {
    if (s.id && s.name && s.className) {
      const idx = dbData.students.findIndex((item) => item.id === s.id);
      if (idx === -1) {
        dbData.students.push({
          id: String(s.id).trim(),
          name: String(s.name).trim(),
          grade: Number(s.grade) || parseInt(s.className.slice(0, 2), 10),
          className: String(s.className).trim(),
          isActive: true
        });
        added++;
      }
    }
  });

  db.save();
  res.json({ success: true, added, total: dbData.students.length });
});

// Violations list
router.get('/violations', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  const dbData = db.getDb();
  let list = [...dbData.violations];

  // RBAC: If Homeroom Teacher, restrict to assigned class
  if (authUser.role === 'homeroom_teacher' && authUser.assignedClass) {
    list = list.filter((v) => v.class_name === authUser.assignedClass);
  }

  const {
    grade,
    class_name,
    student_id,
    violation_code,
    verification_status,
    email_status,
    month_key,
    search
  } = req.query;

  if (grade) list = list.filter((v) => v.grade === Number(grade));
  if (class_name) list = list.filter((v) => v.class_name === class_name);
  if (student_id) list = list.filter((v) => v.student_id === student_id);
  if (violation_code) list = list.filter((v) => v.violation_code === violation_code);
  if (verification_status) list = list.filter((v) => v.verification_status === verification_status);
  if (email_status) list = list.filter((v) => v.email_status === email_status);
  if (month_key) list = list.filter((v) => v.month_key === month_key);

  if (search) {
    const q = String(search).toLowerCase().trim();
    list = list.filter(
      (v) =>
        v.student_name.toLowerCase().includes(q) ||
        v.student_id.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q) ||
        v.violation_id.toLowerCase().includes(q)
    );
  }

  // Sort descending by occurred_at
  list.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

  res.json(list);
});

// Single violation details
router.get('/violations/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const authUser = getAuthUser(req);
  const dbData = db.getDb();
  const v = dbData.violations.find((item) => item.violation_id === id);

  if (!v) {
    return res.status(404).json({ error: 'Không tìm thấy vi phạm' });
  }

  // Role check
  if (authUser.role === 'homeroom_teacher' && authUser.assignedClass && v.class_name !== authUser.assignedClass) {
    return res.status(403).json({ error: 'Bạn chỉ có quyền xem dữ liệu của lớp mình chủ nhiệm' });
  }

  res.json(v);
});

// CREATE VIOLATION
router.post('/violations', async (req: Request, res: Response) => {
  const authUser = getAuthUser(req);

  // RBAC: Homeroom teacher cannot record violations for other classes
  if (authUser.role === 'homeroom_teacher' && authUser.assignedClass) {
    if (req.body.class_name && req.body.class_name !== authUser.assignedClass) {
      return res.status(403).json({ error: 'Bạn chỉ có thể thao tác với lớp được phân công' });
    }
  }

  const {
    student_id,
    student_name,
    class_name,
    violation_code,
    description,
    location,
    occurred_at,
    attachment_urls,
    notes,
    client_violation_id
  } = req.body;

  // Validation
  if (!student_id || !student_name || !class_name || !violation_code) {
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ các thông tin bắt buộc' });
  }

  if (!ALL_CLASSES.includes(class_name)) {
    return res.status(400).json({ error: `Lớp ${class_name} không hợp lệ trong danh mục 28 lớp` });
  }

  if (!['VEHICLE_ON_CAMPUS', 'PHONE_COMMITMENT', 'PHONE_REPORT', 'OTHER'].includes(violation_code)) {
    return res.status(400).json({ error: 'Mã vi phạm không hợp lệ' });
  }

  if (violation_code === 'OTHER' && (!description || !description.trim())) {
    return res.status(400).json({ error: 'Đối với Lỗi khác, bắt buộc phải có mô tả chi tiết lỗi' });
  }

  // Concurrency Lock & Idempotency check
  const violationId = client_violation_id || `v-${randomUUID()}`;
  const lockAcquired = db.acquireLock(violationId);
  if (!lockAcquired) {
    return res.status(429).json({ error: 'Yêu cầu đang được xử lý, vui lòng không gửi trùng lặp' });
  }

  try {
    const dbData = db.getDb();
    // Check if violation_id already exists (idempotency)
    const existing = dbData.violations.find((v) => v.violation_id === violationId);
    if (existing) {
      db.releaseLock(violationId);
      return res.status(200).json({
        ...existing,
        _isDuplicateResend: true,
        message: 'Vụ việc đã tồn tại, trả về trạng thái hiện tại (không tạo thêm dòng)'
      });
    }

    // Time calculations in Asia/Ho_Chi_Minh
    // Rule: "Tháng và năm phải được tính từ thời điểm xảy ra vi phạm, không lấy từ thời điểm gửi lại hoặc ghi bổ sung."
    const occurredDateParts = parseToVietnamParts(
      occurred_at ? htmlInputToVietnamISO(occurred_at) : new Date()
    );
    const recordedDateParts = parseToVietnamParts(new Date());

    const grade = parseInt(class_name.slice(0, 2), 10);
    const definition = VIOLATION_DEFINITIONS[violation_code as ViolationCode];

    // Determine proposed steps and handling rule
    let proposedSteps = definition.defaultSteps;
    let handlingRule = definition.defaultRule;
    let decisionStatus = 'CHUA_XU_LY';
    let handlingResult = '';

    if (violation_code === 'PHONE_REPORT') {
      decisionStatus = 'CHO_QUYET_DINH';
      handlingResult = 'Chờ xử lý theo quy định';
    } else if (violation_code === 'OTHER') {
      handlingRule = dbData.config.otherViolationDefaultRule || definition.defaultRule;
      proposedSteps = dbData.config.otherViolationDefaultSteps || 0;
      decisionStatus = proposedSteps > 0 ? 'CHUA_XU_LY' : 'CHO_QUYET_DINH';
      handlingResult = proposedSteps > 0 ? `Đề xuất hạ ${proposedSteps} bậc` : 'Chờ xử lý theo quy định';
    } else {
      handlingResult = 'Đề xuất hạ 1 bậc hạnh kiểm tháng';
    }

    // Lookup GVCN from configured teachers table
    const teacher = dbData.teachers.find((t) => t.className === class_name);
    const teacherEmail = teacher?.isActive && teacher.email ? teacher.email : '';

    const newRecord: ViolationRecord = {
      violation_id: violationId,
      request_id: `req-${randomUUID()}`,
      student_id: String(student_id).trim(),
      student_name: String(student_name).trim(),
      grade,
      class_name,
      occurred_at: occurredDateParts.isoWithOffset,
      recorded_at: recordedDateParts.isoWithOffset,
      updated_at: recordedDateParts.isoWithOffset,
      violation_date: occurredDateParts.violation_date,
      violation_time: occurredDateParts.violation_time,
      month: occurredDateParts.month,
      year: occurredDateParts.year,
      month_key: occurredDateParts.month_key,
      violation_code: violation_code as ViolationCode,
      violation_label: definition.label,
      description: description ? String(description).trim() : '',
      location: location ? String(location).trim() : 'Trong trường',
      recorded_by_id: authUser.id,
      recorded_by_name: authUser.name,
      verification_status: 'DA_XAC_NHAN', // Ban Đoàn / Sao đỏ ghi nhận mặc định đã xác thực tại hiện trường
      handling_rule: handlingRule,
      proposed_downgrade_steps: proposedSteps,
      approved_downgrade_steps: proposedSteps,
      decision_status: decisionStatus as any,
      handling_result: handlingResult,
      teacher_email: teacherEmail,
      email_status: 'CHUA_GUI',
      sync_status: 'CHUA_GUI',
      attachment_urls: Array.isArray(attachment_urls) ? attachment_urls : [],
      notes: notes ? String(notes).trim() : '',
      history: [
        {
          timestamp: recordedDateParts.isoWithOffset,
          action: 'CREATE',
          actor_id: authUser.id,
          actor_name: authUser.name,
          details: 'Ghi nhận vi phạm ban đầu'
        }
      ]
    };

    // Dispatch to Webhook Make
    const dispatchResult = await dispatchWebhook(
      newRecord,
      'create_violation',
      dbData.config.makeWebhookUrl,
      teacher,
      dbData.config.makeApiKey,
      dbData.config
    );

    newRecord.sync_status = dispatchResult.sync_status;
    newRecord.email_status = dispatchResult.email_status;
    newRecord.sync_error = dispatchResult.sync_error;
    newRecord.email_message_id = dispatchResult.email_message_id;
    newRecord.email_sent_at = dispatchResult.email_sent_at;
    // Auto-record new student in students list if not present
    const existingStudent = dbData.students.find((s) => s.id === newRecord.student_id);
    if (!existingStudent) {
      dbData.students.push({
        id: newRecord.student_id,
        name: newRecord.student_name,
        grade: newRecord.grade,
        className: newRecord.class_name,
        isActive: true
      });
    }

    dbData.violations.unshift(newRecord);
    db.save();

    res.status(201).json(newRecord);
  } finally {
    db.releaseLock(violationId);
  }
});

// UPDATE VIOLATION (DECISION / APPROVAL / VERIFICATION)
router.put('/violations/:id', async (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  const { id } = req.params;
  const dbData = db.getDb();

  const record = dbData.violations.find((v) => v.violation_id === id);
  if (!record) {
    return res.status(404).json({ error: 'Không tìm thấy vi phạm' });
  }

  // RBAC check: Only approver or admin can change decisions
  const {
    verification_status,
    decision_status,
    approved_downgrade_steps,
    handling_result,
    notes,
    reason
  } = req.body;

  if (
    (decision_status !== undefined || approved_downgrade_steps !== undefined) &&
    authUser.role !== 'admin' &&
    authUser.role !== 'approver'
  ) {
    return res.status(403).json({ error: 'Chỉ Ban Giám Hiệu / Người duyệt mới có quyền phê duyệt kết quả xử lý' });
  }

  const nowIso = parseToVietnamParts(new Date()).isoWithOffset;

  if (verification_status) record.verification_status = verification_status;
  if (decision_status) record.decision_status = decision_status;
  if (approved_downgrade_steps !== undefined) {
    record.approved_downgrade_steps = Number(approved_downgrade_steps) || 0;
  }
  if (handling_result !== undefined) record.handling_result = String(handling_result).trim();
  if (notes !== undefined) record.notes = String(notes).trim();
  record.updated_at = nowIso;

  if (!record.history) record.history = [];
  record.history.push({
    timestamp: nowIso,
    action: 'UPDATE_DECISION',
    actor_id: authUser.id,
    actor_name: authUser.name,
    reason: reason || 'Cập nhật quyết định xử lý',
    details: `Trạng thái: ${record.decision_status}, Bậc hạ duyệt: ${record.approved_downgrade_steps}`
  });

  // Re-dispatch update event to webhook
  const teacher = dbData.teachers.find((t) => t.className === record.class_name);
  if (dbData.config.makeWebhookUrl) {
    try {
      await dispatchWebhook(record, 'update_violation', dbData.config.makeWebhookUrl, teacher, dbData.config.makeApiKey, dbData.config);
    } catch (e) {
      console.error('Update webhook dispatch failed:', e);
    }
  }

  db.save();
  res.json(record);
});

// DELETE VIOLATION
router.delete('/violations/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const dbData = db.getDb();
  const index = dbData.violations.findIndex((v) => v.violation_id === id || (v as any).client_violation_id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Không tìm thấy vi phạm để xóa' });
  }

  const deletedRecord = dbData.violations.splice(index, 1)[0];
  db.save();

  res.json({
    success: true,
    message: 'Đã xóa bản ghi vi phạm thành công',
    deleted_id: id,
    student_name: deletedRecord.student_name
  });
});

// CANCEL VIOLATION
router.post('/violations/:id/cancel', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (authUser.role !== 'admin' && authUser.role !== 'approver') {
    return res.status(403).json({ error: 'Chỉ Quản trị viên hoặc Người duyệt mới có quyền hủy vụ việc' });
  }

  const { id } = req.params;
  const { reason } = req.body;
  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'Bắt buộc phải nhập lý do hủy vụ việc để lưu lịch sử' });
  }

  const dbData = db.getDb();
  const record = dbData.violations.find((v) => v.violation_id === id);
  if (!record) {
    return res.status(404).json({ error: 'Không tìm thấy vi phạm' });
  }

  const nowIso = parseToVietnamParts(new Date()).isoWithOffset;
  record.verification_status = 'DA_HUY';
  record.decision_status = 'DA_XU_LY';
  record.approved_downgrade_steps = 0;
  record.handling_result = `Đã hủy vụ việc. Lý do: ${reason.trim()}`;
  record.updated_at = nowIso;

  if (!record.history) record.history = [];
  record.history.push({
    timestamp: nowIso,
    action: 'CANCEL',
    actor_id: authUser.id,
    actor_name: authUser.name,
    reason: reason.trim(),
    details: 'Đã hủy vụ việc vi phạm và loại khỏi danh sách tính hạnh kiểm'
  });

  db.save();
  res.json({ success: true, record });
});

// RETRY EMAIL OR SYNC
router.post('/violations/:id/retry-email', async (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  const { id } = req.params;
  const dbData = db.getDb();

  const record = dbData.violations.find((v) => v.violation_id === id);
  if (!record) {
    return res.status(404).json({ error: 'Không tìm thấy vi phạm' });
  }

  const teacher = dbData.teachers.find((t) => t.className === record.class_name);
  if (teacher && teacher.email) {
    record.teacher_email = teacher.email;
  }

  const dispatchResult = await dispatchWebhook(
    record,
    'update_violation',
    dbData.config.makeWebhookUrl,
    teacher,
    dbData.config.makeApiKey,
    dbData.config
  );

  record.sync_status = dispatchResult.sync_status;
  record.email_status = dispatchResult.email_status;
  record.sync_error = dispatchResult.sync_error;
  if (dispatchResult.email_sent_at) record.email_sent_at = dispatchResult.email_sent_at;
  if (dispatchResult.email_message_id) record.email_message_id = dispatchResult.email_message_id;
  if (dispatchResult.sheet_synced_at) record.sheet_synced_at = dispatchResult.sheet_synced_at;
  record.updated_at = parseToVietnamParts(new Date()).isoWithOffset;

  if (!record.history) record.history = [];
  record.history.push({
    timestamp: record.updated_at,
    action: 'RETRY_EMAIL',
    actor_id: authUser.id,
    actor_name: authUser.name,
    details: `Thử lại gửi email/đồng bộ: Trạng thái email: ${record.email_status}`
  });

  db.save();
  res.json(record);
});

// CONDUCT EVALUATIONS
router.get('/conduct-evaluations', (req: Request, res: Response) => {
  const { className, monthKey } = req.query;
  if (!className || !monthKey) {
    return res.status(400).json({ error: 'Vui lòng cung cấp className và monthKey (vd: 10/2026)' });
  }

  const authUser = getAuthUser(req);
  if (authUser.role === 'homeroom_teacher' && authUser.assignedClass && authUser.assignedClass !== className) {
    return res.status(403).json({ error: 'Bạn chỉ có quyền xem hạnh kiểm của lớp mình phụ trách' });
  }

  const dbData = db.getDb();
  const evals = calculateMonthlyConduct(
    dbData.students,
    dbData.violations,
    dbData.conductEvaluations,
    String(className),
    String(monthKey)
  );

  res.json(evals);
});

// APPROVE CONDUCT EVALUATIONS
router.post('/conduct-evaluations/approve', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (authUser.role !== 'admin' && authUser.role !== 'approver') {
    return res.status(403).json({ error: 'Chỉ Ban Giám Hiệu / Người duyệt mới có quyền duyệt kết quả hạnh kiểm' });
  }

  const { evaluations } = req.body;
  if (!Array.isArray(evaluations)) {
    return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
  }

  const dbData = db.getDb();
  const now = parseToVietnamParts(new Date()).isoWithOffset;

  evaluations.forEach((item: MonthlyConductEvaluation) => {
    const key = `${item.month_key}_${item.student_id}`;
    const idx = dbData.conductEvaluations.findIndex((e) => `${e.month_key}_${e.student_id}` === key);

    const approvedItem: MonthlyConductEvaluation = {
      ...item,
      id: key,
      approved_grade: item.approved_grade || item.proposed_grade,
      approved_by: authUser.name,
      approved_at: now
    };

    if (idx !== -1) {
      dbData.conductEvaluations[idx] = approvedItem;
    } else {
      dbData.conductEvaluations.push(approvedItem);
    }
  });

  db.save();
  res.json({ success: true, count: evaluations.length });
});

// SHEETS EXPORT
router.get('/sheets-export/:tab', (req: Request, res: Response) => {
  const tab = req.params.tab as any;
  if (!['NHAT_KY_VI_PHAM', 'GVCN', 'HOC_SINH', 'XET_HANH_KIEM_THANG'].includes(tab)) {
    return res.status(400).json({ error: 'Tên tab không hợp lệ' });
  }

  const dbData = db.getDb();
  const csvContent = generateCsvForTab(tab, {
    violations: dbData.violations,
    teachers: dbData.teachers,
    students: dbData.students,
    evaluations: dbData.conductEvaluations
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${tab}_${Date.now()}.csv"`);
  res.send(csvContent);
});

// AUTOMATED TEST SUITE RUNNER
router.post('/test-suite/run', async (_req: Request, res: Response) => {
  try {
    const testResults = await runAllAutomatedTests(db);
    res.json({
      timestamp: parseToVietnamParts(new Date()).isoWithOffset,
      total: testResults.length,
      passed: testResults.filter((t) => t.passed).length,
      failed: testResults.filter((t) => !t.passed).length,
      results: testResults
    });
  } catch (err: any) {
    res.status(500).json({ error: `Kiểm thử thất bại: ${err.message}` });
  }
});
