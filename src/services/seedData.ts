import { Teacher } from '../types/index.ts';

export const INITIAL_TEACHERS: Teacher[] = [
  { className: '10C1', teacherName: 'Thầy/Cô Nguyễn Văn An', email: 'lytm.angiang@gmail.com', isActive: true },
  { className: '10C2', teacherName: 'Thầy/Cô Trần Thị Mai', email: 'gvcn.10c2@thpt.edu.vn', isActive: true },
  { className: '10C3', teacherName: 'Thầy/Cô Lê Hoàng Long', email: 'gvcn.10c3@thpt.edu.vn', isActive: true },
  { className: '10C4', teacherName: 'Thầy/Cô Phạm Quốc Bảo', email: 'gvcn.10c4@thpt.edu.vn', isActive: true },
  { className: '10C5', teacherName: 'Thầy/Cô Hoàng Thu Trang', email: 'gvcn.10c5@thpt.edu.vn', isActive: true },
  { className: '10C6', teacherName: 'Thầy/Cô Đỗ Minh Tuấn', email: 'gvcn.10c6@thpt.edu.vn', isActive: true },
  { className: '10C7', teacherName: 'Thầy/Cô Vũ Hồng Hạnh', email: 'gvcn.10c7@thpt.edu.vn', isActive: true },
  { className: '10C8', teacherName: 'Thầy/Cô Bùi Văn Hưng', email: 'gvcn.10c8@thpt.edu.vn', isActive: true },
  { className: '10C9', teacherName: 'Thầy/Cô Đặng Thanh Thảo', email: '', isActive: true },
  { className: '11C1', teacherName: 'Thầy/Cô Ngô Kiến Huy', email: 'gvcn.11c1@thpt.edu.vn', isActive: true },
  { className: '11C2', teacherName: 'Thầy/Cô Dương Thúy Nga', email: 'gvcn.11c2@thpt.edu.vn', isActive: true },
  { className: '11C3', teacherName: 'Thầy/Cô Võ Đình Trí', email: 'gvcn.11c3@thpt.edu.vn', isActive: true },
  { className: '11C4', teacherName: 'Thầy/Cô Nguyễn Văn An', email: 'gvcn.11c4@thpt.edu.vn', isActive: true },
  { className: '11C5', teacherName: 'Thầy/Cô Trần Thị Mai', email: 'gvcn.11c5@thpt.edu.vn', isActive: true },
  { className: '11C6', teacherName: 'Thầy/Cô Lê Hoàng Long', email: 'gvcn.11c6@thpt.edu.vn', isActive: true },
  { className: '11C7', teacherName: 'Thầy/Cô Phạm Quốc Bảo', email: 'gvcn.11c7@thpt.edu.vn', isActive: true },
  { className: '11C8', teacherName: 'Thầy/Cô Hoàng Thu Trang', email: 'gvcn.11c8@thpt.edu.vn', isActive: true },
  { className: '11C9', teacherName: 'Thầy/Cô Đỗ Minh Tuấn', email: 'gvcn.11c9@thpt.edu.vn', isActive: true },
  { className: '12C1', teacherName: 'Thầy/Cô Vũ Hồng Hạnh', email: 'gvcn.12c1@thpt.edu.vn', isActive: true },
  { className: '12C2', teacherName: 'Thầy/Cô Bùi Văn Hưng', email: 'gvcn.12c2@thpt.edu.vn', isActive: true },
  { className: '12C3', teacherName: 'Thầy/Cô Đặng Thanh Thảo', email: 'gvcn.12c3@thpt.edu.vn', isActive: true },
  { className: '12C4', teacherName: 'Thầy/Cô Ngô Kiến Huy', email: 'gvcn.12c4@thpt.edu.vn', isActive: true },
  { className: '12C5', teacherName: 'Thầy/Cô Dương Thúy Nga', email: 'gvcn.12c5@thpt.edu.vn', isActive: true },
  { className: '12C6', teacherName: 'Thầy/Cô Võ Đình Trí', email: 'gvcn.12c6@thpt.edu.vn', isActive: true },
  { className: '12C7', teacherName: 'Thầy/Cô Nguyễn Văn An', email: 'gvcn.12c7@thpt.edu.vn', isActive: true },
  { className: '12C8', teacherName: 'Thầy/Cô Trần Thị Mai', email: 'gvcn.12c8@thpt.edu.vn', isActive: true },
  { className: '12C9', teacherName: 'Thầy/Cô Lê Hoàng Long', email: 'gvcn.12c9@thpt.edu.vn', isActive: true },
  { className: '12C10', teacherName: 'Thầy/Cô Phạm Quốc Bảo', email: 'gvcn.12c10@thpt.edu.vn', isActive: true }
];

export interface SyncPayload {
  version: number;
  timestamp: string;
  teachers?: Teacher[];
  config?: {
    makeWebhookUrl?: string;
    googleSheetId?: string;
    senderEmail?: string;
    senderName?: string;
  };
}

export interface CompactSyncPayload {
  v: number;
  m?: Record<string, string>; // className -> email
  names?: Record<string, string>; // className -> teacherName (only if changed)
  cfg?: {
    h?: string; // webhook
    s?: string; // sheetId
    f?: string; // from/senderEmail
  };
}

// Encode sync payload into ultra-compact URL-safe Base64 string for QR codes
export function encodeSyncPayload(payload: SyncPayload): string {
  try {
    // Build ultra-compact object
    const emailMap: Record<string, string> = {};
    const nameMap: Record<string, string> = {};

    if (Array.isArray(payload.teachers)) {
      payload.teachers.forEach((t) => {
        if (t.email && t.email.trim()) {
          emailMap[t.className] = t.email.trim();
        }
        // Only include custom names that differ from default
        const defaultT = INITIAL_TEACHERS.find((d) => d.className === t.className);
        if (t.teacherName && defaultT && t.teacherName !== defaultT.teacherName) {
          nameMap[t.className] = t.teacherName;
        }
      });
    }

    const compact: CompactSyncPayload = {
      v: 2,
      m: emailMap
    };

    if (Object.keys(nameMap).length > 0) {
      compact.names = nameMap;
    }

    if (payload.config) {
      compact.cfg = {
        h: payload.config.makeWebhookUrl || undefined,
        s: payload.config.googleSheetId || undefined,
        f: payload.config.senderEmail || undefined
      };
    }

    const jsonStr = JSON.stringify(compact);
    return btoa(encodeURIComponent(jsonStr));
  } catch (e) {
    console.error('Failed to encode sync payload:', e);
    return '';
  }
}

// Decode sync payload from URL-safe Base64 string (supports both v1 full and v2 compact)
export function decodeSyncPayload(raw: string): SyncPayload | null {
  try {
    const decodedStr = decodeURIComponent(atob(raw.trim()));
    const parsed = JSON.parse(decodedStr);

    if (!parsed || typeof parsed !== 'object') return null;

    // Handle v2 Compact format
    if (parsed.v === 2 && (parsed.m || parsed.cfg)) {
      const emailMap: Record<string, string> = parsed.m || {};
      const nameMap: Record<string, string> = parsed.names || {};

      const reconstructedTeachers: Teacher[] = INITIAL_TEACHERS.map((base) => {
        const customEmail = emailMap[base.className];
        const customName = nameMap[base.className];
        return {
          ...base,
          email: customEmail !== undefined ? customEmail : base.email,
          teacherName: customName || base.teacherName
        };
      });

      return {
        version: 2,
        timestamp: new Date().toISOString(),
        teachers: reconstructedTeachers,
        config: parsed.cfg
          ? {
              makeWebhookUrl: parsed.cfg.h || '',
              googleSheetId: parsed.cfg.s || '',
              senderEmail: parsed.cfg.f || ''
            }
          : undefined
      };
    }

    // Handle v1 full object format (backward compatible)
    if (parsed.teachers || parsed.config) {
      return parsed as SyncPayload;
    }
  } catch (e) {
    console.error('Failed to decode sync payload:', e);
  }
  return null;
}
