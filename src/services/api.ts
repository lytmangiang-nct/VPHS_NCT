import {
  AppConfig,
  MonthlyConductEvaluation,
  Student,
  Teacher,
  TestCaseResult,
  User,
  ViolationRecord
} from '../types/index.ts';

// Stores active user in localStorage for role simulation
export function getStoredUser(): User {
  try {
    const raw = localStorage.getItem('app_active_user');
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
  localStorage.setItem('app_active_user', JSON.stringify(user));
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

export const api = {
  async getConfig(): Promise<AppConfig & { isWebhookConfigured: boolean; isSheetConfigured: boolean }> {
    const res = await fetch('/api/config', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Không thể tải cấu hình');
    return res.json();
  },

  async updateConfig(payload: Partial<AppConfig>): Promise<void> {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Cập nhật cấu hình thất bại');
    }
  },

  async getUsers(): Promise<User[]> {
    const res = await fetch('/api/users', { headers: getAuthHeaders() });
    return res.json();
  },

  async getClasses(): Promise<{ all: string[]; byGrade: Record<number, string[]> }> {
    const res = await fetch('/api/classes', { headers: getAuthHeaders() });
    return res.json();
  },

  async getTeachers(): Promise<Teacher[]> {
    const res = await fetch('/api/teachers', { headers: getAuthHeaders() });
    return res.json();
  },

  async updateTeacher(className: string, data: Partial<Teacher>): Promise<{ success: boolean; teacher: Teacher }> {
    const res = await fetch(`/api/teachers/${className}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Cập nhật GVCN thất bại');
    }
    return res.json();
  },

  async getStudents(params?: { className?: string; grade?: number; query?: string }): Promise<Student[]> {
    const url = new URL('/api/students', window.location.origin);
    if (params?.className) url.searchParams.set('className', params.className);
    if (params?.grade) url.searchParams.set('grade', String(params.grade));
    if (params?.query) url.searchParams.set('query', params.query);
    const res = await fetch(url.toString(), { headers: getAuthHeaders() });
    return res.json();
  },

  async getNextStudentId(className: string): Promise<{ className: string; nextId: string }> {
    const url = new URL('/api/students/next-id', window.location.origin);
    url.searchParams.set('className', className);
    const res = await fetch(url.toString(), { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Không thể tạo mã học sinh');
    return res.json();
  },

  async addStudent(student: { id: string; name: string; grade: number; className: string }): Promise<Student> {
    const res = await fetch('/api/students', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(student)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Thêm học sinh thất bại');
    }
    return res.json();
  },

  async getViolations(params?: Record<string, string>): Promise<ViolationRecord[]> {
    const url = new URL('/api/violations', window.location.origin);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v) url.searchParams.set(k, v);
      });
    }
    const res = await fetch(url.toString(), { headers: getAuthHeaders() });
    return res.json();
  },

  async createViolation(payload: any): Promise<ViolationRecord> {
    const res = await fetch('/api/violations', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Ghi nhận vi phạm thất bại');
    }
    return res.json();
  },

  async updateViolation(id: string, payload: any): Promise<ViolationRecord> {
    const res = await fetch(`/api/violations/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Cập nhật vi phạm thất bại');
    }
    return res.json();
  },

  async cancelViolation(id: string, reason: string): Promise<void> {
    const res = await fetch(`/api/violations/${id}/cancel`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Hủy vi phạm thất bại');
    }
  },

  async deleteViolation(id: string): Promise<void> {
    const res = await fetch(`/api/violations/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Xóa vi phạm thất bại');
    }
  },

  async retryEmail(id: string): Promise<ViolationRecord> {
    const res = await fetch(`/api/violations/${id}/retry-email`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Gửi lại email thất bại');
    }
    return res.json();
  },

  async getConductEvaluations(className: string, monthKey: string): Promise<MonthlyConductEvaluation[]> {
    const url = new URL('/api/conduct-evaluations', window.location.origin);
    url.searchParams.set('className', className);
    url.searchParams.set('monthKey', monthKey);
    const res = await fetch(url.toString(), { headers: getAuthHeaders() });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Không thể tải bảng hạnh kiểm');
    }
    return res.json();
  },

  async approveConduct(evaluations: MonthlyConductEvaluation[]): Promise<void> {
    const res = await fetch('/api/conduct-evaluations/approve', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ evaluations })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Phê duyệt hạnh kiểm thất bại');
    }
  },

  async runTestSuite(): Promise<{
    timestamp: string;
    total: number;
    passed: number;
    failed: number;
    results: TestCaseResult[];
  }> {
    const res = await fetch('/api/test-suite/run', {
      method: 'POST',
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Chạy kiểm thử thất bại');
    }
    return res.json();
  }
};
