import {
  EmailStatus,
  SyncStatus,
  Teacher,
  ViolationRecord,
  WebhookPayload
} from '../../src/types/index.ts';

export interface DispatchResult {
  sync_status: SyncStatus;
  email_status: EmailStatus;
  sync_error?: string;
  email_message_id?: string;
  email_sent_at?: string;
  sheet_synced_at?: string;
}

export function buildWebhookPayload(
  record: ViolationRecord,
  eventType: 'create_violation' | 'update_violation',
  teacher?: Teacher,
  config?: { schoolName?: string; googleSheetId?: string; senderEmail?: string; senderName?: string }
): WebhookPayload {
  const teacherName = teacher?.teacherName || '';
  const teacherEmail = teacher?.email || record.teacher_email || '';
  const schoolName = config?.schoolName || 'Trường THPT Nguyễn Chí Thanh';
  const sheetId = config?.googleSheetId || '';
  const senderEmail = config?.senderEmail || 'doantruong.thpt@gmail.com';
  const senderName = config?.senderName || 'BCH Đoàn trường THPT Nguyễn Chí Thanh';

  const thangViPham = record.month; // 10
  const thangChu = `Tháng ${record.month}`; // Tháng 10
  const ngayThangNam = record.violation_date; // 02/10/2026
  const teacherDisplayName = teacherName || `Chủ nhiệm ${record.class_name}`;
  const notesText = record.notes && record.notes.trim() ? record.notes.trim() : 'Không';
  const handlingText = record.handling_result || record.handling_rule || 'Theo quy định nhà trường';

  const attachments = Array.isArray(record.attachment_urls) ? record.attachment_urls : [];
  const hasImages = attachments.length > 0;

  // Mô tả ảnh trong văn bản thuần
  let imagesPlainInfo = '';
  if (hasImages) {
    const httpUrls = attachments.filter(u => u.startsWith('http://') || u.startsWith('https://'));
    if (httpUrls.length > 0) {
      imagesPlainInfo = `\n- Hình ảnh nhận diện/minh chứng: ${httpUrls.join(', ')}`;
    } else {
      imagesPlainInfo = `\n- Hình ảnh nhận diện/minh chứng: Đã đính kèm ${attachments.length} ảnh trong email`;
    }
  }

  // Khối HTML hiển thị ảnh trực tiếp trong email để GVCN nhìn thấy ngay
  const imageHtmlSnippet = hasImages ? `
    <div style="margin: 16px 0; padding: 14px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #cbd5e1;">
      <p style="margin: 0 0 10px 0; font-weight: bold; color: #1e3a8a; font-size: 13px;">
        📷 Hình ảnh nhận diện học sinh vi phạm:
      </p>
      <div style="text-align: center;">
        ${attachments.map((imgUrl, idx) => `
          <div style="display: inline-block; margin: 6px; text-align: center; max-width: 100%;">
            <img src="${imgUrl}" alt="Ảnh nhận diện học sinh ${idx + 1}" style="max-width: 100%; max-height: 380px; border-radius: 8px; border: 1px solid #94a3b8; box-shadow: 0 2px 4px rgba(0,0,0,0.08); display: block; margin: 0 auto; object-fit: contain;" />
            ${imgUrl.startsWith('http') ? `<a href="${imgUrl}" target="_blank" style="display: inline-block; margin-top: 6px; font-size: 12px; color: #2563eb; text-decoration: underline;">👉 Bấm vào đây để mở ảnh gốc</a>` : ''}
          </div>
        `).join('')}
      </div>
    </div>` : '';

  // NỘI DUNG THÔNG BÁO BỐ CỤC RÕ RÀNG THEO YÊU CẦU ĐỂ GVCN DỄ ĐỌC
  const messagePlain = `Kính gửi Thầy/Cô: ${teacherDisplayName} (GVCN lớp ${record.class_name}),

BCH ĐT thông báo học sinh sau vừa vi phạm nề nếp:
- Họ và tên học sinh: ${record.student_name}
- Lớp: ${record.class_name}
- Hành vi vi phạm: ${record.violation_label}
- Ngày vi phạm: ${ngayThangNam} (Tháng vi phạm: ${thangChu})
- Địa điểm: ${record.location}
- Hướng đề xuất xử lý: ${handlingText}
- Ghi chú: ${notesText}${imagesPlainInfo}

Kính đề nghị Thầy/Cô phối hợp nhắc nhở và giáo dục học sinh.

Trân trọng!
BCH Đoàn trường THPT Nguyễn Chí Thanh`;

  const messageHtml = `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333333; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
    <p style="margin-top: 0; font-size: 14px;">
      Kính gửi Thầy/Cô: <b>${teacherDisplayName}</b> — Giáo viên Chủ nhiệm lớp <b>${record.class_name}</b>,
    </p>
    <p style="font-size: 14px; margin-bottom: 12px;">
      BCH ĐT xin thông báo trường hợp học sinh của lớp vừa được ghi nhận vi phạm nề nếp với thông tin chi tiết như sau:
    </p>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px;">
      <tr>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; width: 35%; color: #64748b; font-size: 13px;">Họ và tên học sinh:</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #1e3a8a; font-size: 14px;">${record.student_name}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px;">Lớp:</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #0f172a; font-size: 13px;">${record.class_name}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px;">Hành vi vi phạm:</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #b91c1c; font-weight: bold; font-size: 13px;">${record.violation_label}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px;">Thời gian vi phạm:</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">Ngày <b>${ngayThangNam}</b> (Tính vào nề nếp <b>${thangChu}</b>)</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px;">Địa điểm:</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">${record.location}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px;">Đề xuất hướng xử lý:</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #c2410c; font-weight: bold; font-size: 13px;">${handlingText}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; color: #64748b; font-size: 13px;">Ghi chú thêm:</td>
        <td style="padding: 10px 14px; font-style: italic; color: #475569; font-size: 13px;">${notesText}</td>
      </tr>
    </table>
    ${imageHtmlSnippet}
    <p style="font-size: 13px; color: #475569; margin-bottom: 20px;">
      👉 Kính đề nghị Thầy/Cô nắm bắt thông tin, nhắc nhở và phối hợp cùng gia đình giáo dục học sinh nhằm nâng cao ý thức chấp hành nội quy nhà trường.
    </p>
    <div style="border-top: 1px dashed #cbd5e1; padding-top: 12px; font-size: 13px;">
      <p style="margin: 0; font-size: 14px;"><b>BCH Đoàn trường THPT Nguyễn Chí Thanh</b></p>
      <p style="margin: 4px 0 0 0; color: #64748b; font-size: 12px;">Email này được gửi tự động từ Hệ thống Quản lý Nề nếp học sinh.</p>
    </div>
</div>`;

  const messageWithBr = messagePlain.replace(/\n/g, '<br/>') + (imageHtmlSnippet ? `<br/>${imageHtmlSnippet}` : '');
  const messagePreLine = `<div style="white-space: pre-wrap; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b;">${messagePlain}</div>${imageHtmlSnippet}`;

  const firstImageUrl = hasImages ? attachments[0] : '';

  return {
    // CỘT DỮ LIỆU MESSAGE BỐ CỤC ĐẦY ĐỦ RÕ RÀNG THEO YÊU CẦU (CÓ CHỨA ẢNH NHẬN DIỆN)
    message: messagePlain,                     // Dành cho Sheets hoặc Gmail Plain text
    message_plain: messagePlain,
    message_html: messageHtml,                 // Mẫu bảng HTML chuẩn, có nhúng ảnh nhận diện to rõ
    message_br: messageWithBr,                 // Có thẻ <br/> và ảnh nhận diện
    message_email: messagePreLine,             // Tự xuống dòng và kèm ảnh nhận diện
    noi_dung_thong_bao: messagePlain,
    noi_dung_email: messageWithBr,             // Xuống dòng ngay lập tức trong Gmail HTML kèm ảnh
    noi_dung_html: messageHtml,
    'Message': messagePlain,
    'Message HTML': messageHtml,
    'Nội dung thông báo': messagePlain,
    'Nội dung email': messageWithBr,
    'Nội dung HTML': messageHtml,

    // CÁC TRƯỜNG HÌNH ẢNH NHẬN DIỆN RIÊNG BIỆT ĐỂ MAKE / GOOGLE SHEET TRÍCH XUẤT
    has_image: hasImages,
    co_hinh_anh: hasImages ? 'Có' : 'Không',
    image_url: firstImageUrl,
    hinh_anh: firstImageUrl,
    hinh_anh_1: firstImageUrl,
    anh_nhan_dien: firstImageUrl,
    anh_minh_chung: firstImageUrl,
    'Hình ảnh': firstImageUrl,
    'Ảnh nhận diện': firstImageUrl,

    // 1. CÁC TRƯỜNG TIẾNG VIỆT DỄ ĐỌC GHI VÀO GOOGLE SHEET (Theo đúng yêu cầu)
    ho_ten: record.student_name,               // Họ tên học sinh
    lop: record.class_name,                    // Lớp
    loai_vi_pham: record.violation_label,      // Loại vi phạm
    ngay_thang_nam: ngayThangNam,              // Ngày tháng năm (dd/MM/yyyy)
    thang: thangViPham,                        // TÁCH CỘT THÁNG RIÊNG ĐỂ LỌC DỮ LIỆU THEO THÁNG (vd: 10)
    thang_chu: thangChu,                       // Tháng dạng chữ (vd: "Tháng 10")
    nam: record.year,                          // Năm (vd: 2026)
    dia_diem: record.location,                 // Địa điểm vi phạm
    huong_xu_ly: handlingText,                 // Hướng xử lý
    email_gvcn: teacherEmail,                  // EMAIL GIÁO VIÊN CHỦ NHIỆM THEO LỚP
    email_chu_nhiem: teacherEmail,             // Email chủ nhiệm
    ten_gvcn: teacherName,                     // Họ tên GVCN

    // CÁC TRƯỜNG FROM (NGƯỜI GỬI) - KHẮC PHỤC TRIỆT ĐỂ LỖI TRỐNG PHẦN FROM TRÊN MAKE
    from: senderEmail,                         // Email người gửi (đoàn trường)
    from_email: senderEmail,
    from_name: senderName,
    email_nguoi_gui: senderEmail,
    ten_nguoi_gui: senderName,
    sender_email: senderEmail,
    sender_name: senderName,

    ghi_chu: record.notes || '',               // Ghi chú thêm
    ma_vi_pham: record.violation_id,           // Mã vi phạm
    ma_hoc_sinh: record.student_id,            // Mã học sinh

    // 2. KHÓA TIẾNG VIỆT CÓ DẤU (Để Google Sheet / Make bắt trực tiếp)
    'Họ tên học sinh': record.student_name,
    'Họ và tên': record.student_name,
    'Lớp': record.class_name,
    'Loại vi phạm': record.violation_label,
    'Ngày tháng năm': ngayThangNam,
    'Tháng': thangViPham,                      // Cột tháng riêng
    'Tháng vi phạm': thangChu,
    'Địa điểm': record.location,
    'Hướng xử lý': record.handling_result || record.handling_rule,
    'Email GVCN': teacherEmail,                // Khóa có dấu cho Make / Gmail
    'Email chủ nhiệm': teacherEmail,
    'Tên GVCN': teacherName,
    'From': senderEmail,
    'Email người gửi': senderEmail,
    'Người gửi': senderName,
    'Ghi chú': record.notes || '',
    'Mã vi phạm': record.violation_id,

    // 3. CÁC TRƯỜNG KỸ THUẬT TIẾNG ANH & BỔ TRỢ HỆ THỐNG
    schema_version: '1.0.0',
    event_type: eventType,
    violation_id: record.violation_id,
    request_id: record.request_id,
    student_id: record.student_id,
    student_name: record.student_name,
    class_name: record.class_name,
    grade: record.grade,
    violation_code: record.violation_code,
    violation_label: record.violation_label,
    description: record.description,
    location: record.location,
    occurred_at: record.occurred_at,
    recorded_at: record.recorded_at,
    updated_at: record.updated_at || record.recorded_at,
    timezone: 'Asia/Ho_Chi_Minh',
    violation_date: record.violation_date,
    violation_time: record.violation_time,
    month: record.month,
    year: record.year,
    month_key: record.month_key,
    recorded_by_id: record.recorded_by_id,
    recorded_by_name: record.recorded_by_name,
    verification_status: record.verification_status,
    handling_rule: record.handling_rule,
    handling_result: record.handling_result || record.handling_rule,
    proposed_downgrade_steps: record.proposed_downgrade_steps,
    approved_downgrade_steps: record.approved_downgrade_steps,
    decision_status: record.decision_status,
    teacher_name: teacherName,
    teacher_email: teacherEmail,
    school_name: schoolName,
    google_sheet_id: sheetId,
    attachment_urls: record.attachment_urls || [],
    notes: record.notes || '',
    ho_va_ten: record.student_name,
    ngay_vi_pham: ngayThangNam,
    gio_vi_pham: record.violation_time,
    nguoi_ghi_nhan: record.recorded_by_name
  };
}

/**
 * Dispatch violation record to Make webhook with strict compliance
 */
export async function dispatchWebhook(
  record: ViolationRecord,
  eventType: 'create_violation' | 'update_violation',
  webhookUrl: string,
  teacher: Teacher | undefined,
  apiKey?: string,
  config?: { schoolName?: string; googleSheetId?: string; senderEmail?: string; senderName?: string }
): Promise<DispatchResult> {
  const now = new Date().toISOString();

  // Rule: Check teacher email
  if (!teacher || !teacher.email || !teacher.email.trim() || !teacher.isActive) {
    return {
      sync_status: webhookUrl ? 'CHUA_GUI' : 'CHUA_GUI',
      email_status: 'THIEU_EMAIL',
      sync_error: !teacher 
        ? `Lớp ${record.class_name} chưa có cấu hình GVCN` 
        : `Lớp ${record.class_name} chưa có email GVCN hợp lệ`
    };
  }

  // Rule: If webhook is not configured, do NOT fake success
  if (!webhookUrl || !webhookUrl.trim().startsWith('http')) {
    return {
      sync_status: 'CHUA_GUI',
      email_status: 'CHUA_GUI',
      sync_error: 'Chưa cấu hình MAKE_WEBHOOK_URL. Dữ liệu đã lưu cục bộ tại hệ thống trường.'
    };
  }

  const payload = buildWebhookPayload(record, eventType, teacher, config);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'SchoolViolationRecorder/1.0.0'
    };
    if (apiKey && apiKey.trim()) {
      headers['Authorization'] = apiKey.trim().startsWith('Bearer ') ? apiKey.trim() : `Bearer ${apiKey.trim()}`;
      headers['x-make-apikey'] = apiKey.trim();
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
      redirect: 'follow'
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      let errorMsg = `Make Webhook trả về mã lỗi HTTP ${response.status}: ${errText.slice(0, 150)}`;
      if (response.status === 401) {
        errorMsg = 'Lỗi 401 Unauthorized từ Make. Hãy kiểm tra cài đặt Webhook trên Make (tắt IP restriction / API Key hoặc tạo Custom Webhook thông thường).';
      }
      return {
        sync_status: 'LOI',
        email_status: 'THAT_BAI',
        sync_error: errorMsg
      };
    }

    let responseData: any = null;
    try {
      responseData = await response.json();
    } catch {
      // If response text was plain text or "Accepted"
    }

    // Notice: "Không hiển thị 'Đã gửi email' khi chỉ mới nhận phản hồi webhook 'Accepted'."
    // If webhook returns explicit confirmation of sheet + email:
    if (responseData && responseData.email_sent === true) {
      return {
        sync_status: 'DA_GHI_SHEET',
        email_status: 'DA_GUI',
        email_message_id: responseData.message_id || `msg-${Date.now()}`,
        email_sent_at: now,
        sheet_synced_at: now
      };
    } else if (responseData && responseData.sheet_synced === true) {
      return {
        sync_status: 'DA_GHI_SHEET',
        email_status: responseData.email_error ? 'THAT_BAI' : 'DANG_GUI',
        sheet_synced_at: now,
        sync_error: responseData.email_error
      };
    } else {
      // Normal webhook accepted
      return {
        sync_status: 'DA_TIEP_NHAN',
        email_status: 'DANG_GUI', // Webhook queued, waiting for scenario to finish
        sheet_synced_at: now
      };
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      // "Nếu gửi email bị timeout và chưa biết nhà cung cấp đã gửi hay chưa, đánh dấu 'Cần đối soát', không tự gửi lại vô điều kiện."
      return {
        sync_status: 'LOI',
        email_status: 'CAN_DOI_SOAT',
        sync_error: 'Yêu cầu tới Make Webhook bị quá hạn thời gian (Timeout). Cần đối soát trạng thái trước khi gửi lại.'
      };
    }

    return {
      sync_status: 'LOI',
      email_status: 'THAT_BAI',
      sync_error: `Lỗi kết nối Webhook: ${err.message || String(err)}`
    };
  }
}
