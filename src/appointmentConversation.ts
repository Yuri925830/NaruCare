import type { AppointmentPreference, HospitalAppointmentSlot } from "./hospitalAppointments";

export interface ParsedAppointmentPreference {
  preference: AppointmentPreference;
  hasDate: boolean;
  hasTime: boolean;
}

const DAY_NAMES: Array<{ day: number; pattern: RegExp }> = [
  { day: 0, pattern: /일요일|星期日|星期天|周日|周天|\bsunday\b/i },
  { day: 1, pattern: /월요일|星期一|周一|\bmonday\b/i },
  { day: 2, pattern: /화요일|星期二|周二|\btuesday\b/i },
  { day: 3, pattern: /수요일|星期三|周三|\bwednesday\b/i },
  { day: 4, pattern: /목요일|星期四|周四|\bthursday\b/i },
  { day: 5, pattern: /금요일|星期五|周五|\bfriday\b/i },
  { day: 6, pattern: /토요일|星期六|周六|\bsaturday\b/i },
];

const PERIODS = {
  morning: /오전|아침|上午|早上|\bmorning\b|\bam\b/i,
  afternoon: /오후|下午|\bafternoon\b|\bpm\b/i,
  evening: /저녁|晚上|\bevening\b/i,
};

function localDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromParts(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return localDateString(date);
}

function parseDate(text: string, now: Date) {
  const explicit = text.match(/(\d{4})\s*(?:년|[./-])\s*(\d{1,2})\s*(?:월|[./-])\s*(\d{1,2})\s*일?/);
  if (explicit) return dateFromParts(Number(explicit[1]), Number(explicit[2]), Number(explicit[3]));

  const monthDay = text.match(/(?:^|\s)(\d{1,2})\s*(?:월|[./-])\s*(\d{1,2})\s*일?(?:\s|$)/);
  if (monthDay) {
    let year = now.getFullYear();
    const candidate = new Date(year, Number(monthDay[1]) - 1, Number(monthDay[2]));
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (candidate < today) year += 1;
    return dateFromParts(year, Number(monthDay[1]), Number(monthDay[2]));
  }

  let offset: number | null = null;
  if (/모레|后天|後天|day\s+after\s+tomorrow/i.test(text)) offset = 2;
  else if (/내일|明天|\btomorrow\b/i.test(text)) offset = 1;
  else if (/오늘|今天|\btoday\b/i.test(text)) offset = 0;
  if (offset !== null) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    date.setDate(date.getDate() + offset);
    return localDateString(date);
  }

  const weekday = DAY_NAMES.find((item) => item.pattern.test(text));
  if (weekday) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let days = (weekday.day - date.getDay() + 7) % 7;
    if (days === 0 && /다음|下周|\bnext\b/i.test(text)) days = 7;
    date.setDate(date.getDate() + days);
    return localDateString(date);
  }
  return null;
}

function meridiemFor(value?: string) {
  if (!value) return null;
  if (/오후|下午|저녁|晚上|pm|afternoon|evening/i.test(value)) return "pm";
  if (/오전|아침|上午|早上|am|morning/i.test(value)) return "am";
  return null;
}

function toTime(hourValue: string, minuteValue?: string, meridiemValue?: string | null) {
  let hour = Number(hourValue);
  const minute = Number(minuteValue || 0);
  const meridiem = meridiemFor(meridiemValue || undefined);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour > 23 || minute > 59) return null;
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function addMinutes(time: string, minutes: number) {
  const [hour, minute] = time.split(":").map(Number);
  const total = Math.min(23 * 60 + 59, hour * 60 + minute + minutes);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function parseTimeRange(text: string): Pick<AppointmentPreference, "startTime" | "endTime"> | null {
  const eastAsianRange = text.match(
    /(오전|오후|아침|저녁|上午|下午|早上|晚上)?\s*(\d{1,2})(?:\s*[:시点點]\s*(\d{1,2})?\s*분?)?\s*(?:부터|에서|~|－|-|到|至)\s*(오전|오후|아침|저녁|上午|下午|早上|晚上)?\s*(\d{1,2})(?:\s*[:시点點]\s*(\d{1,2})?\s*분?)?/i,
  );
  if (eastAsianRange) {
    const startPeriod = eastAsianRange[1] || eastAsianRange[4];
    const endPeriod = eastAsianRange[4] || eastAsianRange[1];
    const startTime = toTime(eastAsianRange[2], eastAsianRange[3], startPeriod);
    const endTime = toTime(eastAsianRange[5], eastAsianRange[6], endPeriod);
    if (startTime && endTime && startTime < endTime) return { startTime, endTime };
  }

  const englishRange = text.match(
    /(?:\bfrom\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|until|through|~|－|-)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i,
  );
  if (englishRange) {
    const startTime = toTime(englishRange[1], englishRange[2], englishRange[3] || englishRange[6]);
    const endTime = toTime(englishRange[4], englishRange[5], englishRange[6] || englishRange[3]);
    if (startTime && endTime && startTime < endTime) return { startTime, endTime };
  }

  const twentyFourHourRange = text.match(/(?:^|\s)(\d{1,2}):(\d{2})\s*(?:~|－|-|to|until|부터|到|至)\s*(\d{1,2}):(\d{2})(?:\s|$)/i);
  if (twentyFourHourRange) {
    const startTime = toTime(twentyFourHourRange[1], twentyFourHourRange[2]);
    const endTime = toTime(twentyFourHourRange[3], twentyFourHourRange[4]);
    if (startTime && endTime && startTime < endTime) return { startTime, endTime };
  }

  const eastAsianSingle = text.match(/(오전|오후|아침|저녁|上午|下午|早上|晚上)?\s*(\d{1,2})(?:\s*[:시点點]\s*(\d{1,2})?\s*분?)/i);
  if (eastAsianSingle) {
    const startTime = toTime(eastAsianSingle[2], eastAsianSingle[3], eastAsianSingle[1]);
    if (startTime) return { startTime, endTime: addMinutes(startTime, 60) };
  }

  const englishSingle = text.match(/(?:\bat\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (englishSingle) {
    const startTime = toTime(englishSingle[1], englishSingle[2], englishSingle[3]);
    if (startTime) return { startTime, endTime: addMinutes(startTime, 60) };
  }

  if (PERIODS.morning.test(text)) return { startTime: "09:00", endTime: "12:00" };
  if (PERIODS.afternoon.test(text)) return { startTime: "12:00", endTime: "18:00" };
  if (PERIODS.evening.test(text)) return { startTime: "18:00", endTime: "21:00" };
  return null;
}

export function parseAppointmentPreference(
  text: string,
  base: AppointmentPreference,
  now = new Date(),
): ParsedAppointmentPreference | null {
  const date = parseDate(text, now);
  const time = parseTimeRange(text);
  if (!date && !time) return null;
  return {
    preference: {
      date: date || base.date,
      startTime: time?.startTime || base.startTime,
      endTime: time?.endTime || base.endTime,
    },
    hasDate: Boolean(date),
    hasTime: Boolean(time),
  };
}

function mentionedHourCandidates(text: string) {
  const match = text.match(/(오전|오후|아침|저녁|上午|下午|早上|晚上)?\s*(\d{1,2})(?:\s*[:시点點]\s*(\d{1,2})?\s*분?|\s*(am|pm)\b)/i);
  if (!match) return [];
  const period = match[1] || match[4];
  const exact = toTime(match[2], match[3], period);
  if (!exact) return [];
  if (period || Number(match[2]) > 12) return [exact];
  const afternoon = toTime(match[2], match[3], "pm");
  return afternoon && afternoon !== exact ? [exact, afternoon] : [exact];
}

export function findAppointmentSlotFromText(text: string, slots: HospitalAppointmentSlot[]) {
  const ordinalPatterns: Array<[RegExp, number]> = [
    [/첫\s*번째|1\s*번|第\s*一|第\s*1|\bfirst\b/i, 0],
    [/두\s*번째|둘째|2\s*번|第\s*二|第\s*2|\bsecond\b/i, 1],
    [/세\s*번째|셋째|3\s*번|第\s*三|第\s*3|\bthird\b/i, 2],
  ];
  const ordinal = ordinalPatterns.find(([pattern]) => pattern.test(text));
  if (ordinal) return slots[ordinal[1]] || null;
  const candidates = mentionedHourCandidates(text);
  return slots.find((slot) => candidates.includes(slot.startTime)) || null;
}
