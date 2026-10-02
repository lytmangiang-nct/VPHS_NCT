/**
 * DateTime utilities for Vietnam Timezone (Asia/Ho_Chi_Minh, UTC+07:00)
 */

export function getVietnamNow(): Date {
  return new Date();
}

/**
 * Returns formatted date parts in Asia/Ho_Chi_Minh timezone
 */
export function parseToVietnamParts(dateInput: string | Date | number) {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    throw new Error('Invalid date input');
  }

  // Use Intl.DateTimeFormat to reliably extract parts in Asia/Ho_Chi_Minh
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(d);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }

  const day = partMap.day.padStart(2, '0');
  const monthStr = partMap.month.padStart(2, '0');
  const yearStr = partMap.year;
  const hour = partMap.hour.padStart(2, '0');
  const minute = partMap.minute.padStart(2, '0');
  const second = partMap.second.padStart(2, '0');

  const month = parseInt(monthStr, 10);
  const year = parseInt(yearStr, 10);
  const violation_date = `${day}/${monthStr}/${yearStr}`;
  const violation_time = `${hour}:${minute}:${second}`;
  const month_key = `${monthStr}/${yearStr}`;
  const isoWithOffset = `${yearStr}-${monthStr}-${day}T${hour}:${minute}:${second}+07:00`;
  const htmlInputDateTime = `${yearStr}-${monthStr}-${day}T${hour}:${minute}`;

  return {
    day,
    month,
    year,
    monthStr,
    yearStr,
    hour,
    minute,
    second,
    violation_date,
    violation_time,
    month_key,
    isoWithOffset,
    htmlInputDateTime
  };
}

/**
 * Convert an HTML input datetime-local string (e.g. "2026-10-01T14:30")
 * assumed in Asia/Ho_Chi_Minh into an ISO string with +07:00
 */
export function htmlInputToVietnamISO(input: string): string {
  if (!input) return parseToVietnamParts(new Date()).isoWithOffset;
  // If it's already an ISO with timezone
  if (input.includes('+') || input.includes('Z')) {
    return parseToVietnamParts(input).isoWithOffset;
  }
  const [datePart, timePart] = input.split('T');
  const [year, month, day] = datePart.split('-');
  const timeChunks = (timePart || '00:00:00').split(':');
  const hour = (timeChunks[0] || '00').padStart(2, '0');
  const minute = (timeChunks[1] || '00').padStart(2, '0');
  const second = (timeChunks[2] || '00').padStart(2, '0');

  return `${year}-${month}-${day}T${hour}:${minute}:${second}+07:00`;
}

/**
 * Format timestamp display in Vietnamese UI
 */
export function formatVietnamDisplay(isoOrDate: string | Date | undefined): string {
  if (!isoOrDate) return '—';
  try {
    const parts = parseToVietnamParts(isoOrDate);
    return `${parts.violation_time} ${parts.violation_date}`;
  } catch {
    return String(isoOrDate);
  }
}
