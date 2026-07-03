// Jalali/Shamsi Date utility functions for Iranian Calendar conversion

export function g_to_j(gy: number, gm: number, gd: number): [number, number, number] {
  const date = new Date(Date.UTC(gy, gm - 1, gd));
  const formatter = new Intl.DateTimeFormat('en-US-u-ca-persian', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });
  const parts = formatter.formatToParts(date);
  let jy = 1405;
  let jm = 4;
  let jd = 12;
  for (const part of parts) {
    if (part.type === 'year') jy = parseInt(part.value, 10);
    if (part.type === 'month') jm = parseInt(part.value, 10);
    if (part.type === 'day') jd = parseInt(part.value, 10);
  }
  return [jy, jm, jd];
}

export function j_to_g(jy: number, jm: number, jd: number): [number, number, number] {
  // Approximate the number of days from start of Jalali year (Farvardin 1)
  let jDays = 0;
  if (jm <= 6) {
    jDays = (jm - 1) * 31 + jd;
  } else {
    jDays = 6 * 31 + (jm - 7) * 30 + jd;
  }
  
  // Farvardin 1 is approx March 20/21. Let's start from March 18 of gy (jy + 621)
  const gy = jy + 621;
  const baseDate = new Date(Date.UTC(gy, 2, 18)); // March is index 2
  const approxDate = new Date(baseDate.getTime() + (jDays - 1) * 24 * 60 * 60 * 1000);

  // Search in a window of +/- 10 days for exact match
  for (let offset = -10; offset <= 10; offset++) {
    const d = new Date(approxDate.getTime() + offset * 24 * 60 * 60 * 1000);
    const [ry, rm, rd] = g_to_j(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    if (ry === jy && rm === jm && rd === jd) {
      return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
    }
  }
  return [approxDate.getUTCFullYear(), approxDate.getUTCMonth() + 1, approxDate.getUTCDate()];
}

export const JALALI_MONTH_NAMES = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند'
];

export const WEEKDAYS_SHORT = [
  'ش',
  'ی',
  'د',
  'س',
  'چ',
  'پ',
  'ج'
];

export function getJalaliMonthDays(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  // Month 12: Esfand is 30 days in leap years, 29 in regular years
  const dates = [
    new Date(Date.UTC(jy + 622, 2, 19)),
    new Date(Date.UTC(jy + 622, 2, 20)),
    new Date(Date.UTC(jy + 622, 2, 21)),
  ];
  for (const d of dates) {
    const [ry, rm, rd] = g_to_j(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    if (ry === jy && rm === 12 && rd === 30) {
      return 30;
    }
  }
  return 29;
}

export function getPersianWeekdayIndex(gDay: number): number {
  // Map JS getDay() (0=Sun, 1=Mon, ..., 6=Sat) to Persian weekday (0=Sat, 1=Sun, ..., 6=Fri)
  return (gDay + 1) % 7;
}

// Convert a Gregorian YYYY-MM-DD string to Jalali YYYY-MM-DD string
export function parseGregorianToJalali(gDateStr: string): string {
  if (!gDateStr) return '';
  const parts = gDateStr.split('-');
  if (parts.length !== 3) return '';
  const gy = parseInt(parts[0], 10);
  const gm = parseInt(parts[1], 10);
  const gd = parseInt(parts[2], 10);
  if (isNaN(gy) || isNaN(gm) || isNaN(gd)) return '';
  const [jy, jm, jd] = g_to_j(gy, gm, gd);
  return `${jy}-${String(jm).padStart(2, '0')}-${String(jd).padStart(2, '0')}`;
}

// Convert a Jalali YYYY-MM-DD string to Gregorian YYYY-MM-DD string
export function parseJalaliToGregorian(jDateStr: string): string {
  if (!jDateStr) return '';
  const parts = jDateStr.split('-');
  if (parts.length !== 3) return '';
  const jy = parseInt(parts[0], 10);
  const jm = parseInt(parts[1], 10);
  const jd = parseInt(parts[2], 10);
  if (isNaN(jy) || isNaN(jm) || isNaN(jd)) return '';
  const [gy, gm, gd] = j_to_g(jy, jm, jd);
  return `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
}

export function toPersianDigits(str: string | number): string {
  const id = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return str.toString().replace(/[0-9]/g, (w) => id[+w]);
}

// Format Jalali Date as a string like "۱۲ تیر ۱۴۰۵"
export function formatJalaliReadable(jDateStr: string): string {
  if (!jDateStr) return '';
  const parts = jDateStr.split('-');
  if (parts.length !== 3) return jDateStr;
  const jy = parseInt(parts[0], 10);
  const jm = parseInt(parts[1], 10);
  const jd = parseInt(parts[2], 10);
  if (isNaN(jy) || isNaN(jm) || isNaN(jd)) return jDateStr;
  const monthName = JALALI_MONTH_NAMES[jm - 1] || '';
  return `${toPersianDigits(jd)} ${monthName} ${toPersianDigits(jy)}`;
}
